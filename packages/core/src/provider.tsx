import type { User } from "@shoplist/api-client";
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { createApi, type Api } from "./api";
import type { SocketFactory } from "./listStore";
import type { KeyValueStorage } from "./storage";

export interface ShoplistConfig {
  /** np. "https://api.example.com" */
  apiUrl: string;
  /** np. "wss://api.example.com" */
  wsUrl: string;
  storage: KeyValueStorage;
  /** UUID v4. Web: () => crypto.randomUUID(). Android: Crypto.randomUUID z expo-crypto. */
  generateId: () => string;
  /** Tylko do testów. */
  createSocket?: SocketFactory;
  fetch?: typeof fetch;
}

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; token: string; user: User };

interface Session {
  token: string;
  user: User;
}

export interface ShoplistContextValue {
  config: ShoplistConfig;
  api: Api;
  auth: AuthState;
  loginAsGuest: (displayName: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const SESSION_KEY = "shoplist.session";

export const ShoplistContext = createContext<ShoplistContextValue | null>(null);

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session>;
    return typeof value.token === "string" && value.user ? (value as Session) : null;
  } catch {
    return null;
  }
}

export function ShoplistProvider({ config, children }: { config: ShoplistConfig; children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const tokenRef = useRef<string | null>(null);
  const { storage } = config;

  const logout = useCallback(async () => {
    tokenRef.current = null;
    setAuth({ status: "anonymous" });
    await storage.removeItem(SESSION_KEY);
  }, [storage]);

  const api = useMemo(
    () =>
      createApi({
        baseUrl: config.apiUrl,
        getToken: () => tokenRef.current,
        onUnauthorized: () => void logout(),
        fetch: config.fetch,
      }),
    [config.apiUrl, config.fetch, logout],
  );

  // Sesję trzymamy razem z userem, więc start apki nie wymaga sieci.
  // Nieważny token wyjdzie przy pierwszym 401 i wtedy następuje wylogowanie.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = parseSession(await storage.getItem(SESSION_KEY));
      if (cancelled) return;
      if (session) {
        tokenRef.current = session.token;
        setAuth({ status: "authenticated", ...session });
      } else {
        setAuth({ status: "anonymous" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const loginAsGuest = useCallback(
    async (displayName: string) => {
      const res = await api.loginAsGuest(displayName.trim());
      const session: Session = { token: res.access_token, user: res.user };
      await storage.setItem(SESSION_KEY, JSON.stringify(session));
      tokenRef.current = session.token;
      setAuth({ status: "authenticated", ...session });
      return res.user;
    },
    [api, storage],
  );

  const value = useMemo(
    () => ({ config, api, auth, loginAsGuest, logout }),
    [config, api, auth, loginAsGuest, logout],
  );

  return <ShoplistContext.Provider value={value}>{children}</ShoplistContext.Provider>;
}
