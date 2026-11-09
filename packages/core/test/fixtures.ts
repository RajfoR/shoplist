import type { Item, ListDetail, ListEvent, ListSocketOptions } from "@shoplist/api-client";

import type { Api } from "../src/api";
import type { SocketFactory } from "../src/listStore";

export const LIST_ID = "list-1";
export const ME = "user-me";
export const OTHER = "user-other";

export function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    list_id: LIST_ID,
    name: id,
    quantity: null,
    checked: false,
    version: 1,
    created_by: OTHER,
    created_at: "2026-11-08T10:00:00Z",
    updated_at: "2026-11-08T10:00:00Z",
    ...overrides,
  };
}

export function listDetail(items: Item[] = []): ListDetail {
  return {
    id: LIST_ID,
    name: "Biedronka",
    owner_id: ME,
    created_at: "2026-11-08T09:00:00Z",
    updated_at: "2026-11-08T09:00:00Z",
    share_token: "tok",
    items,
    members: [{ id: ME, display_name: "Ja", is_guest: true }],
  };
}

export function event<T extends ListEvent["type"]>(
  type: T,
  data: Extract<ListEvent, { type: T }>["data"],
  actor = OTHER,
): ListEvent {
  return { type, list_id: LIST_ID, actor_id: actor, ts: "2026-11-08T10:00:00Z", data } as ListEvent;
}

/** Promise sterowany ręcznie: test decyduje, kiedy „odpowiada serwer”. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function fakeApi(overrides: Partial<Record<keyof Api, jest.Mock>> = {}) {
  const api = {
    loginAsGuest: jest.fn(),
    me: jest.fn(),
    getLists: jest.fn(),
    createList: jest.fn(),
    getList: jest.fn(),
    renameList: jest.fn(),
    deleteList: jest.fn(),
    joinList: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    ...overrides,
  };
  return api as typeof api & Api;
}

export function fakeSocket() {
  const sockets: { opts: ListSocketOptions; started: boolean; stopped: boolean }[] = [];
  const factory: SocketFactory = (opts) => {
    const s = { opts, started: false, stopped: false };
    sockets.push(s);
    return {
      start: () => {
        s.started = true;
      },
      stop: () => {
        s.stopped = true;
      },
    };
  };
  return {
    factory,
    get current() {
      const s = sockets.at(-1);
      if (!s) throw new Error("socket not created");
      return s.opts;
    },
    sockets,
  };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
