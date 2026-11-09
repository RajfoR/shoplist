// Integracja: prawdziwy ShoplistProvider i hooki z core, fałszywy fetch i socket.
import type { ListSocketOptions } from "@shoplist/api-client";
import { memoryStorage, SESSION_KEY, ShoplistProvider, type ShoplistConfig } from "@shoplist/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/App";
import { groceries, item, listDetail, ME, myLists } from "../src/fixtures";

function json(status: number, body: unknown) {
  return { status, ok: status < 400, json: async () => body } as Response;
}

function setup(routes: Record<string, (body: unknown) => Response>, session?: object) {
  const storage = memoryStorage();
  if (session) void storage.setItem(SESSION_KEY, JSON.stringify(session));
  const calls: string[] = [];
  const fetchMock = async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.replace("http://api", "")}`;
    calls.push(key);
    const route = routes[key];
    if (!route) throw new Error(`Brak trasy: ${key}`);
    return route(init?.body ? JSON.parse(String(init.body)) : undefined);
  };
  const config: ShoplistConfig = {
    apiUrl: "http://api",
    wsUrl: "ws://api",
    storage,
    generateId: () => "new-id",
    fetch: fetchMock as unknown as typeof fetch,
    createSocket: (opts: ListSocketOptions) => ({
      start: () => {
        opts.onStatus?.("open");
        opts.onReady();
      },
      stop: () => undefined,
    }),
  };
  render(
    <ShoplistProvider config={config}>
      <App />
    </ShoplistProvider>,
  );
  return { calls, storage, user: userEvent.setup() };
}

const SESSION = { token: "jwt", user: ME };

beforeEach(() => window.history.replaceState(null, "", "/"));

test("nowy użytkownik podaje imię i widzi swoje listy", async () => {
  const { user, storage } = setup({
    "POST /auth/guest": (body) =>
      json(201, { access_token: "jwt", token_type: "bearer", user: { ...ME, ...(body as object) } }),
    "GET /lists": () => json(200, myLists),
  });

  await user.type(await screen.findByRole("textbox", { name: "Jak masz na imię?" }), "Rafał");
  await user.click(screen.getByRole("button", { name: "Wejdź" }));

  expect(await screen.findByRole("heading", { name: "Twoje listy" })).toBeTruthy();
  expect(await screen.findByText("Biedronka w sobotę")).toBeTruthy();
  expect(await storage.getItem(SESSION_KEY)).toContain("jwt");
});

test("link z QR: logowanie, dołączenie i przekierowanie na listę", async () => {
  const detail = listDetail(groceries());
  window.history.replaceState(null, "", "/join/k3J9xQ2mTq8wZ1aB");
  const { user, calls } = setup({
    "POST /auth/guest": () => json(201, { access_token: "jwt", token_type: "bearer", user: ME }),
    "POST /lists/join": (body) =>
      (body as { share_token: string }).share_token === "k3J9xQ2mTq8wZ1aB" ? json(200, detail) : json(404, {}),
    [`GET /lists/${detail.id}`]: () => json(200, detail),
  });

  expect(await screen.findByRole("button", { name: "Dołącz do listy" })).toBeTruthy();
  await user.type(screen.getByRole("textbox", { name: "Jak masz na imię?" }), "Rafał");
  await user.click(screen.getByRole("button", { name: "Dołącz do listy" }));

  expect(await screen.findByRole("button", { name: /Zmień nazwę listy: Biedronka/ })).toBeTruthy();
  expect(window.location.pathname).toBe(`/lists/${detail.id}`);
  expect(screen.getByRole("status").textContent).toBe("Na żywo");
  expect(calls.filter((c) => c === "POST /lists/join")).toHaveLength(1);
});

test("dodanie produktu pojawia się od razu (optimistic) z id z generateId", async () => {
  const detail = listDetail([]);
  window.history.replaceState(null, "", `/lists/${detail.id}`);
  let posted: unknown;
  const { user } = setup(
    {
      [`GET /lists/${detail.id}`]: () => json(200, detail),
      [`POST /lists/${detail.id}/items`]: (body) => {
        posted = body;
        return json(201, item("Kawa", { id: "new-id", list_id: detail.id }));
      },
    },
    SESSION,
  );

  await user.type(await screen.findByRole("textbox", { name: "Co kupić?" }), "Kawa{Enter}");
  expect(await screen.findByText("Kawa")).toBeTruthy();
  expect(posted).toEqual({ id: "new-id", name: "Kawa", quantity: null });
});

test("lista bez dostępu pokazuje komunikat zamiast pustego ekranu", async () => {
  window.history.replaceState(null, "", "/lists/obca");
  setup({ "GET /lists/obca": () => json(404, { detail: "Not found" }) }, SESSION);
  expect(await screen.findByRole("heading", { name: "Nie masz dostępu do tej listy" })).toBeTruthy();
});
