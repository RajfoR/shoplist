// Stan jednej listy: snapshot z REST + eventy z WS + zmiany optymistyczne.
// Zwykła klasa bez Reacta: łatwo ją testować, a hook `useList` to tylko
// cienka nakładka przez useSyncExternalStore.
import {
  applyEvent,
  CLOSE_UNAUTHORIZED,
  ListSocket,
  type Item,
  type ItemUpdate,
  type ListDetail,
  type ListEvent,
  type ListSocketOptions,
} from "@shoplist/api-client";

import { ApiError, NetworkError, type Api } from "./api";
import {
  optimisticCreate,
  optimisticDelete,
  optimisticUpdate,
  rollbackCreate,
  rollbackDelete,
  rollbackUpdate,
  UNCONFIRMED_VERSION,
  withServerItem,
} from "./optimistic";

export type ListStatus = "loading" | "ready" | "not_found" | "deleted" | "error";
export type ConnectionStatus = "connecting" | "open" | "closed";

export interface ListState {
  list: ListDetail | null;
  status: ListStatus;
  /** Stan WebSocketu, np. do kropki „na żywo” w nagłówku. */
  connection: ConnectionStatus;
  /** Ostatni błąd operacji (do toasta). Czyść przez `clearError()`. */
  error: Error | null;
}

export interface SocketLike {
  start(): void;
  stop(): void;
}

export type SocketFactory = (opts: ListSocketOptions) => SocketLike;

export interface ListStoreDeps {
  api: Api;
  listId: string;
  token: string;
  userId: string;
  wsUrl: string;
  generateId: () => string;
  createSocket?: SocketFactory;
  onUnauthorized?: () => void;
}

const defaultSocketFactory: SocketFactory = (opts) => new ListSocket(opts);

export class ListStore {
  private state: ListState = { list: null, status: "loading", connection: "connecting", error: null };
  private readonly listeners = new Set<() => void>();
  private socket: SocketLike | null = null;
  private stopped = true;

  /** Eventy, które przyszły w trakcie pobierania snapshotu (kontrakt, pkt 6). */
  private snapshotsInFlight = 0;
  private buffered: ListEvent[] = [];

  /** Usunięte id: spóźniony `item.updated` nie może „wskrzesić” produktu. */
  private readonly tombstones = new Set<string>();

  /** Operacje na tym samym produkcie idą po kolei (np. dodaj i od razu odhacz). */
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(private readonly deps: ListStoreDeps) {}

  // ---- integracja z useSyncExternalStore ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): ListState => this.state;

  // ---- cykl życia ----

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const factory = this.deps.createSocket ?? defaultSocketFactory;
    this.socket = factory({
      baseUrl: this.deps.wsUrl,
      listId: this.deps.listId,
      token: this.deps.token,
      onReady: () => void this.resync(),
      onEvent: (event) => this.handleEvent(event),
      onFatal: (code) => this.handleFatal(code),
      onStatus: (connection) => this.set({ connection }),
    });
    this.socket.start();
    // Nie czekamy na WS: jeśli socket nie wstanie, lista i tak się załaduje.
    void this.resync();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.stop();
    this.socket = null;
  }

  // ---- synchronizacja ----

  resync = async (): Promise<void> => {
    this.snapshotsInFlight += 1;
    try {
      const snapshot = await this.deps.api.getList(this.deps.listId);
      if (this.stopped) return;
      let list: ListDetail | null = this.withoutTombstones(snapshot);
      for (const event of this.buffered) {
        if (list === null) break;
        if (!this.isTombstoned(event)) list = applyEvent(list, event);
      }
      if (list === null) this.set({ list: null, status: "deleted" });
      else this.set({ list, status: "ready" });
    } catch (err) {
      if (this.stopped) return;
      if (err instanceof ApiError && err.status === 404) {
        if (this.state.status !== "deleted") this.set({ list: null, status: "not_found" });
      } else {
        this.set({ error: asError(err), status: this.state.list ? this.state.status : "error" });
      }
    } finally {
      this.snapshotsInFlight -= 1;
      if (this.snapshotsInFlight === 0) this.buffered = [];
    }
  };

  private handleEvent(event: ListEvent): void {
    if (this.snapshotsInFlight > 0) this.buffered.push(event);
    if (event.type === "item.deleted") this.tombstones.add(event.data.id);
    if (this.isTombstoned(event)) return;
    this.updateList((list) => applyEvent(list, event));
  }

  private handleFatal(code: number): void {
    if (code === CLOSE_UNAUTHORIZED) {
      this.deps.onUnauthorized?.();
      return;
    }
    if (this.state.status !== "deleted") this.set({ list: null, status: "not_found" });
  }

  // ---- operacje ----

  addItem = (name: string, quantity?: string | null): Promise<boolean> => {
    const list = this.state.list;
    const trimmed = name.trim();
    if (!list || !trimmed) return Promise.resolve(false);

    const now = new Date().toISOString();
    const item: Item = {
      id: this.deps.generateId(),
      list_id: list.id,
      name: trimmed,
      quantity: quantity?.trim() || null,
      checked: false,
      version: UNCONFIRMED_VERSION,
      created_by: this.deps.userId,
      created_at: now,
      updated_at: now,
    };
    this.updateList((l) => optimisticCreate(l, item));

    return this.enqueue(item.id, async () => {
      try {
        const saved = await this.deps.api.addItem(list.id, {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
        });
        this.applyServerItem(saved);
        return true;
      } catch (err) {
        // 409 = produkt już jest na serwerze (retry po zerwanym połączeniu).
        if (err instanceof ApiError && err.status === 409) {
          void this.resync();
          return true;
        }
        this.updateList((l) => rollbackCreate(l, item.id));
        this.fail(err);
        return false;
      }
    });
  };

  updateItem = (itemId: string, patch: ItemUpdate): Promise<boolean> => {
    const previous = this.findItem(itemId);
    if (!previous) return Promise.resolve(false);
    this.updateList((l) => optimisticUpdate(l, itemId, patch));

    return this.enqueue(itemId, async () => {
      try {
        this.applyServerItem(await this.deps.api.updateItem(itemId, patch));
        return true;
      } catch (err) {
        this.updateList((l) => rollbackUpdate(l, previous));
        this.fail(err);
        return false;
      }
    });
  };

  toggleItem = (itemId: string): Promise<boolean> => {
    const item = this.findItem(itemId);
    if (!item) return Promise.resolve(false);
    return this.updateItem(itemId, { checked: !item.checked });
  };

  deleteItem = (itemId: string): Promise<boolean> => {
    const previous = this.findItem(itemId);
    if (!previous) return Promise.resolve(false);
    this.tombstones.add(itemId);
    this.updateList((l) => optimisticDelete(l, itemId));

    return this.enqueue(itemId, async () => {
      try {
        await this.deps.api.deleteItem(itemId);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return true; // ktoś usunął pierwszy
        this.tombstones.delete(itemId);
        this.updateList((l) => rollbackDelete(l, previous));
        this.fail(err);
        return false;
      }
    });
  };

  renameList = async (name: string): Promise<boolean> => {
    const list = this.state.list;
    const trimmed = name.trim();
    if (!list || !trimmed) return false;
    const previousName = list.name;
    this.updateList((l) => ({ ...l, name: trimmed }));
    try {
      const saved = await this.deps.api.renameList(list.id, trimmed);
      this.updateList((l) => ({ ...l, ...saved }));
      return true;
    } catch (err) {
      this.updateList((l) => (l.name === trimmed ? { ...l, name: previousName } : l));
      this.fail(err);
      return false;
    }
  };

  /** Nieoptymistyczne: operacja nieodwracalna, a nie-właściciel dostaje 403. */
  deleteList = async (): Promise<boolean> => {
    try {
      await this.deps.api.deleteList(this.deps.listId);
      this.set({ list: null, status: "deleted" });
      return true;
    } catch (err) {
      this.fail(err);
      return false;
    }
  };

  clearError = (): void => {
    if (this.state.error) this.set({ error: null });
  };

  // ---- pomocnicze ----

  private set(patch: Partial<ListState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private updateList(fn: (list: ListDetail) => ListDetail | null): void {
    const current = this.state.list;
    if (!current) return;
    const next = fn(current);
    if (next === null) this.set({ list: null, status: "deleted" });
    else if (next !== current) this.set({ list: next });
  }

  private applyServerItem(item: Item): void {
    if (this.tombstones.has(item.id)) return;
    this.updateList((l) => withServerItem(l, item));
  }

  private findItem(itemId: string): Item | undefined {
    return this.state.list?.items.find((i) => i.id === itemId);
  }

  private isTombstoned(event: ListEvent): boolean {
    return (
      (event.type === "item.created" || event.type === "item.updated") &&
      this.tombstones.has(event.data.id)
    );
  }

  private withoutTombstones(list: ListDetail): ListDetail {
    if (this.tombstones.size === 0) return list;
    return { ...list, items: list.items.filter((i) => !this.tombstones.has(i.id)) };
  }

  private enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const run = previous.then(op, op);
    this.chains.set(key, run);
    const cleanup = () => {
      if (this.chains.get(key) === run) this.chains.delete(key);
    };
    run.then(cleanup, cleanup);
    return run;
  }

  private fail(err: unknown): void {
    this.set({ error: asError(err) });
    // Po błędzie serwera dociągamy prawdę z serwera. Bez sieci nie ma sensu,
    // bo socket i tak zrobi resync po reconnect (onReady).
    if (!(err instanceof NetworkError)) void this.resync();
  }
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
