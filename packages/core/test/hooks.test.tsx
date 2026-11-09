/**
 * @jest-environment jsdom
 */
import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { useAuth, useList, useLists } from "../src/hooks";
import { SESSION_KEY, ShoplistProvider, type ShoplistConfig } from "../src/provider";
import { memoryStorage } from "../src/storage";
import { fakeSocket, item, LIST_ID, listDetail, ME } from "./fixtures";

const USER = { id: ME, display_name: "Ja", is_guest: true };

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

function setup(routes: Record<string, () => Response>, session?: object) {
  const storage = memoryStorage();
  if (session) void storage.setItem(SESSION_KEY, JSON.stringify(session));
  const socket = fakeSocket();
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.replace("http://api", "")}`;
    const route = routes[key];
    if (!route) throw new Error(`Brak trasy w teście: ${key}`);
    return route();
  });
  const config: ShoplistConfig = {
    apiUrl: "http://api",
    wsUrl: "ws://api",
    storage,
    generateId: () => "generated-id",
    createSocket: socket.factory,
    fetch: fetchMock as unknown as typeof fetch,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ShoplistProvider config={config}>{children}</ShoplistProvider>
  );
  // Wzorzec dla aplikacji: ekrany wymagające logowania renderuj dopiero po
  // odtworzeniu sesji (status "authenticated"), nie w stanie "loading".
  const authedWrapper = ({ children }: { children: ReactNode }) => (
    <ShoplistProvider config={config}>
      <AuthGate>{children}</AuthGate>
    </ShoplistProvider>
  );
  return { storage, socket, fetchMock, wrapper, authedWrapper };
}

test("login jako gość zapisuje sesję i wysyła token w kolejnych żądaniach", async () => {
  const { storage, fetchMock, wrapper } = setup({
    "POST /auth/guest": () => jsonResponse(201, { access_token: "jwt-1", token_type: "bearer", user: USER }),
    "GET /lists": () => jsonResponse(200, []),
  });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("anonymous"));

  await act(() => result.current.loginAsGuest("  Ja "));

  expect(result.current).toMatchObject({ status: "authenticated", user: USER });
  expect(JSON.parse((await storage.getItem(SESSION_KEY))!)).toEqual({ token: "jwt-1", user: USER });
  expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ display_name: "Ja" });
});

function AuthGate({ children }: { children: ReactNode }) {
  return useAuth().status === "authenticated" ? <>{children}</> : null;
}

test("sesja z pamięci przywraca się bez sieci, a 401 wylogowuje", async () => {
  const { storage, fetchMock, wrapper } = setup(
    { "GET /lists": () => jsonResponse(401, { detail: "Not authenticated" }) },
    { token: "stary-jwt", user: USER },
  );
  const seen: string[] = [];
  function StatusProbe() {
    const { status } = useAuth();
    if (seen.at(-1) !== status) seen.push(status);
    return status === "authenticated" ? <ListsScreen /> : null;
  }
  function ListsScreen() {
    useLists(); // pierwsze żądanie z tokenem dostaje 401
    return null;
  }

  render(<StatusProbe />, { wrapper });

  await waitFor(() => expect(seen).toEqual(["loading", "authenticated", "anonymous"]));
  expect(await storage.getItem(SESSION_KEY)).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1); // start bez /me — tylko /lists
  const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
  expect(headers.Authorization).toBe("Bearer stary-jwt");
});

test("useList: snapshot, optimistic add i event z WS", async () => {
  const { socket, authedWrapper } = setup(
    {
      [`GET /lists/${LIST_ID}`]: () => jsonResponse(200, listDetail([item("a")])),
      [`POST /lists/${LIST_ID}/items`]: () =>
        jsonResponse(201, item("generated-id", { name: "Kawa", created_by: ME })),
    },
    { token: "jwt", user: USER },
  );
  const { result } = renderHook(() => useList(LIST_ID), { wrapper: authedWrapper });
  await waitFor(() => expect(result.current?.status).toBe("ready"));
  expect(result.current.list!.items.map((i) => i.id)).toEqual(["a"]);

  await act(() => result.current.addItem("Kawa"));
  expect(result.current.list!.items.map((i) => i.name)).toEqual(["a", "Kawa"]);

  act(() => {
    socket.current.onStatus!("open");
    socket.current.onEvent({
      type: "item.updated",
      list_id: LIST_ID,
      actor_id: "ktoś",
      ts: "2026-11-08T10:00:00Z",
      data: item("a", { version: 2, checked: true }),
    });
  });
  expect(result.current.connection).toBe("open");
  expect(result.current.list!.items[0]!.checked).toBe(true);
});
