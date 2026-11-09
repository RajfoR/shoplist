import type { ListDetail, ShoppingList } from "@shoplist/api-client";
import { useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ListStore, type ListState } from "./listStore";
import { ShoplistContext, type ShoplistContextValue } from "./provider";

export function useShoplist(): ShoplistContextValue {
  const ctx = useContext(ShoplistContext);
  if (!ctx) throw new Error("Hooki @shoplist/core wymagają <ShoplistProvider>");
  return ctx;
}

export function useAuth() {
  const { auth, loginAsGuest, logout } = useShoplist();
  return {
    status: auth.status,
    user: auth.status === "authenticated" ? auth.user : null,
    loginAsGuest,
    logout,
  };
}

function useAuthenticated() {
  const ctx = useShoplist();
  if (ctx.auth.status !== "authenticated") {
    throw new Error("Ten hook wymaga zalogowanego użytkownika — renderuj ekran dopiero po loginie");
  }
  return { ...ctx, auth: ctx.auth };
}

/** Moje listy. Bez real-time (nie ma kanału per użytkownik): odświeżaj przy wejściu na ekran. */
export function useLists() {
  const { api } = useAuthenticated();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await api.getLists());
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createList = useCallback(
    async (name: string): Promise<ListDetail> => {
      const created = await api.createList(name.trim());
      setLists((prev) => [created, ...prev]);
      return created;
    },
    [api],
  );

  return { lists, loading, error, refresh, createList };
}

export function useJoinList() {
  const { api } = useAuthenticated();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const join = useCallback(
    async (shareToken: string): Promise<ListDetail | null> => {
      setJoining(true);
      setError(null);
      try {
        return await api.joinList(shareToken.trim());
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setJoining(false);
      }
    },
    [api],
  );

  return { join, joining, error };
}

export interface UseListResult extends ListState {
  addItem: ListStore["addItem"];
  updateItem: ListStore["updateItem"];
  toggleItem: ListStore["toggleItem"];
  deleteItem: ListStore["deleteItem"];
  renameList: ListStore["renameList"];
  deleteList: ListStore["deleteList"];
  clearError: ListStore["clearError"];
  resync: ListStore["resync"];
}

/** Jedna lista na żywo: snapshot + WebSocket + optimistic update. */
export function useList(listId: string): UseListResult {
  const { api, config, auth, logout } = useAuthenticated();

  const store = useMemo(
    () =>
      new ListStore({
        api,
        listId,
        token: auth.token,
        userId: auth.user.id,
        wsUrl: config.wsUrl,
        generateId: config.generateId,
        createSocket: config.createSocket,
        onUnauthorized: () => void logout(),
      }),
    [api, listId, auth.token, auth.user.id, config, logout],
  );

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  return {
    ...state,
    addItem: store.addItem,
    updateItem: store.updateItem,
    toggleItem: store.toggleItem,
    deleteItem: store.deleteItem,
    renameList: store.renameList,
    deleteList: store.deleteList,
    clearError: store.clearError,
    resync: store.resync,
  };
}
