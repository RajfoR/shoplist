import type {
  Item,
  ItemCreate,
  ItemUpdate,
  ListDetail,
  ShoppingList,
  TokenOut,
  User,
} from "@shoplist/api-client";

/** Serwer odpowiedział statusem błędu (4xx/5xx). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = "ApiError";
  }
}

/** Żądanie w ogóle nie doszło (brak sieci, DNS, CORS, timeout). */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super("Network error");
    this.name = "NetworkError";
  }
}

export interface ApiOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Wołane przy 401 na żądaniu z tokenem: sesja wygasła albo token jest zły. */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export function createApi(opts: ApiOptions) {
  const doFetch: typeof fetch = opts.fetch ?? ((...args) => fetch(...args));

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const token = opts.getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await doFetch(opts.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new NetworkError(err);
    }

    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && token) opts.onUnauthorized?.();
      throw new ApiError(res.status, data);
    }
    return data as T;
  }

  const id = encodeURIComponent;

  return {
    loginAsGuest: (display_name: string) => request<TokenOut>("POST", "/auth/guest", { display_name }),
    me: () => request<User>("GET", "/me"),
    getLists: () => request<ShoppingList[]>("GET", "/lists"),
    createList: (name: string) => request<ListDetail>("POST", "/lists", { name }),
    getList: (listId: string) => request<ListDetail>("GET", `/lists/${id(listId)}`),
    renameList: (listId: string, name: string) =>
      request<ShoppingList>("PATCH", `/lists/${id(listId)}`, { name }),
    deleteList: (listId: string) => request<void>("DELETE", `/lists/${id(listId)}`),
    joinList: (share_token: string) => request<ListDetail>("POST", "/lists/join", { share_token }),
    addItem: (listId: string, body: ItemCreate) =>
      request<Item>("POST", `/lists/${id(listId)}/items`, body),
    updateItem: (itemId: string, patch: ItemUpdate) =>
      request<Item>("PATCH", `/items/${id(itemId)}`, patch),
    deleteItem: (itemId: string) => request<void>("DELETE", `/items/${id(itemId)}`),
  };
}

export type Api = ReturnType<typeof createApi>;
