import { ApiError, NetworkError } from "../src/api";
import { ListStore } from "../src/listStore";
import {
  deferred,
  event,
  fakeApi,
  fakeSocket,
  flush,
  item,
  LIST_ID,
  listDetail,
  ME,
} from "./fixtures";

function setup(initialItems = [item("a")]) {
  const api = fakeApi();
  api.getList.mockResolvedValue(listDetail(initialItems));
  const socket = fakeSocket();
  const onUnauthorized = jest.fn();
  let n = 0;
  const store = new ListStore({
    api,
    listId: LIST_ID,
    token: "t",
    userId: ME,
    wsUrl: "ws://test",
    generateId: () => `new-${++n}`,
    createSocket: socket.factory,
    onUnauthorized,
  });
  return { api, socket, store, onUnauthorized };
}

async function started(initialItems?: Parameters<typeof setup>[0]) {
  const ctx = setup(initialItems);
  ctx.store.start();
  await flush();
  return ctx;
}

const ids = (store: ListStore) => store.getState().list?.items.map((i) => i.id);

describe("ListStore — synchronizacja", () => {
  test("start ładuje snapshot bez czekania na WebSocket", async () => {
    const { store, socket } = await started();
    expect(store.getState().status).toBe("ready");
    expect(ids(store)).toEqual(["a"]);
    expect(socket.sockets[0]!.started).toBe(true);
  });

  test("onReady (reconnect) robi resync", async () => {
    const { store, api, socket } = await started();
    api.getList.mockResolvedValue(listDetail([item("a"), item("b")]));
    socket.current.onReady();
    await flush();
    expect(ids(store)).toEqual(["a", "b"]);
  });

  test("eventy z WS trafiają do stanu, a własne echo nic nie psuje", async () => {
    const { store, socket } = await started();
    socket.current.onEvent(event("item.updated", item("a", { version: 2, checked: true })));
    expect(store.getState().list!.items[0]).toMatchObject({ checked: true, version: 2 });

    socket.current.onEvent(event("item.updated", item("a", { version: 2, checked: false })));
    expect(store.getState().list!.items[0]!.checked).toBe(true);
  });

  test("eventy, które przyszły w trakcie snapshotu, są aplikowane po nim", async () => {
    const { store, api, socket } = await started();
    const snapshot = deferred<ReturnType<typeof listDetail>>();
    api.getList.mockReturnValue(snapshot.promise);

    socket.current.onReady();
    socket.current.onEvent(event("item.created", item("b")));
    // Snapshot został zrobiony przed utworzeniem "b", więc go nie zawiera.
    snapshot.resolve(listDetail([item("a")]));
    await flush();

    expect(ids(store)).toEqual(["a", "b"]);
  });

  test("list.deleted → status deleted", async () => {
    const { store, socket } = await started();
    socket.current.onEvent(event("list.deleted", { id: LIST_ID }));
    expect(store.getState()).toMatchObject({ status: "deleted", list: null });
  });

  test("4404 → not_found, 4401 → wylogowanie", async () => {
    const { store, socket, onUnauthorized } = await started();
    socket.current.onFatal!(4401);
    expect(onUnauthorized).toHaveBeenCalled();
    socket.current.onFatal!(4404);
    expect(store.getState().status).toBe("not_found");
  });

  test("404 przy snapshocie → not_found", async () => {
    const { store, api } = setup();
    api.getList.mockRejectedValue(new ApiError(404, null));
    store.start();
    await flush();
    expect(store.getState().status).toBe("not_found");
  });

  test("po stop() spóźniony snapshot nie zmienia stanu", async () => {
    const { store, api } = setup();
    const snapshot = deferred<ReturnType<typeof listDetail>>();
    api.getList.mockReturnValue(snapshot.promise);
    store.start();
    store.stop();
    snapshot.resolve(listDetail());
    await flush();
    expect(store.getState().status).toBe("loading");
  });
});

describe("ListStore — dodawanie", () => {
  test("produkt pojawia się od razu, a odpowiedź serwera go potwierdza", async () => {
    const { store, api } = await started([]);
    const response = deferred<ReturnType<typeof item>>();
    api.addItem.mockReturnValue(response.promise);

    const done = store.addItem("  Mleko ", "2 l");
    expect(store.getState().list!.items).toEqual([
      expect.objectContaining({ id: "new-1", name: "Mleko", quantity: "2 l", version: 0, created_by: ME }),
    ]);
    await flush(); // żądanie startuje w kolejnym mikrotasku (kolejka per produkt)
    expect(api.addItem).toHaveBeenCalledWith(LIST_ID, { id: "new-1", name: "Mleko", quantity: "2 l" });

    response.resolve(item("new-1", { name: "Mleko", version: 1 }));
    await expect(done).resolves.toBe(true);
    expect(store.getState().list!.items[0]!.version).toBe(1);
  });

  test("event z WS przed odpowiedzią REST nie robi duplikatu", async () => {
    const { store, api, socket } = await started([]);
    const response = deferred<ReturnType<typeof item>>();
    api.addItem.mockReturnValue(response.promise);

    const done = store.addItem("Mleko");
    socket.current.onEvent(event("item.created", item("new-1", { version: 1 }), ME));
    response.resolve(item("new-1", { version: 1 }));
    await done;

    expect(ids(store)).toEqual(["new-1"]);
  });

  test("błąd serwera → rollback i error", async () => {
    const { store, api } = await started([]);
    api.addItem.mockRejectedValue(new ApiError(500, null));
    await expect(store.addItem("Mleko")).resolves.toBe(false);
    expect(ids(store)).toEqual([]);
    expect(store.getState().error).toBeInstanceOf(ApiError);
  });

  test("409 (retry, produkt już jest) → bez rollbacku, resync", async () => {
    const { store, api } = await started([]);
    api.addItem.mockRejectedValue(new ApiError(409, null));
    api.getList.mockResolvedValue(listDetail([item("new-1")]));
    await expect(store.addItem("Mleko")).resolves.toBe(true);
    await flush();
    expect(ids(store)).toEqual(["new-1"]);
    expect(store.getState().error).toBeNull();
  });

  test("puste nazwy są ignorowane", async () => {
    const { store, api } = await started([]);
    await expect(store.addItem("   ")).resolves.toBe(false);
    expect(api.addItem).not.toHaveBeenCalled();
  });

  test("odhaczenie świeżo dodanego produktu czeka na POST", async () => {
    const { store, api } = await started([]);
    const response = deferred<ReturnType<typeof item>>();
    api.addItem.mockReturnValue(response.promise);
    api.updateItem.mockResolvedValue(item("new-1", { version: 2, checked: true }));

    void store.addItem("Mleko");
    const toggled = store.toggleItem("new-1");
    expect(store.getState().list!.items[0]!.checked).toBe(true); // optymistycznie od razu
    await flush();
    expect(api.updateItem).not.toHaveBeenCalled(); // ale PATCH dopiero po POST

    response.resolve(item("new-1", { version: 1 }));
    await toggled;
    expect(api.updateItem).toHaveBeenCalledWith("new-1", { checked: true });
    expect(store.getState().list!.items[0]).toMatchObject({ checked: true, version: 2 });
  });
});

describe("ListStore — edycja i usuwanie", () => {
  test("toggle: optymistycznie, potem wersja z serwera", async () => {
    const { store, api } = await started();
    api.updateItem.mockResolvedValue(item("a", { version: 2, checked: true }));
    const done = store.toggleItem("a");
    expect(store.getState().list!.items[0]).toMatchObject({ checked: true, version: 1 });
    await done;
    expect(store.getState().list!.items[0]).toMatchObject({ checked: true, version: 2 });
  });

  test("toggle: błąd → rollback", async () => {
    const { store, api } = await started();
    api.updateItem.mockRejectedValue(new NetworkError(new Error("offline")));
    await expect(store.toggleItem("a")).resolves.toBe(false);
    expect(store.getState().list!.items[0]!.checked).toBe(false);
    expect(store.getState().error).toBeInstanceOf(NetworkError);
    expect(api.getList).toHaveBeenCalledTimes(1); // bez sieci nie próbujemy resync
  });

  test("delete: spóźniony item.updated nie wskrzesza produktu", async () => {
    const { store, api, socket } = await started();
    api.deleteItem.mockResolvedValue(undefined);
    await store.deleteItem("a");
    socket.current.onEvent(event("item.updated", item("a", { version: 5 })));
    expect(ids(store)).toEqual([]);
  });

  test("delete: 404 (ktoś usunął pierwszy) to sukces", async () => {
    const { store, api } = await started();
    api.deleteItem.mockRejectedValue(new ApiError(404, null));
    await expect(store.deleteItem("a")).resolves.toBe(true);
    expect(ids(store)).toEqual([]);
  });

  test("delete: błąd → produkt wraca", async () => {
    const { store, api } = await started();
    api.deleteItem.mockRejectedValue(new ApiError(500, null));
    await store.deleteItem("a");
    expect(ids(store)).toEqual(["a"]);
  });

  test("rename: błąd → stara nazwa", async () => {
    const { store, api } = await started();
    api.renameList.mockRejectedValue(new ApiError(500, null));
    const done = store.renameList("Lidl");
    expect(store.getState().list!.name).toBe("Lidl");
    await done;
    expect(store.getState().list!.name).toBe("Biedronka");
  });

  test("deleteList: 403 dla nie-właściciela zostawia listę", async () => {
    const { store, api } = await started();
    api.deleteList.mockRejectedValue(new ApiError(403, null));
    await expect(store.deleteList()).resolves.toBe(false);
    expect(store.getState().status).toBe("ready");
  });
});
