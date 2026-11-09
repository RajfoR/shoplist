// Router na History API. Trzy trasy nie uzasadniają zależności, a react-router
// od v7 jest ESM-only, co komplikuje Jest (ts-jest/CommonJS).
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

export type Route =
  | { name: "lists" }
  | { name: "list"; id: string }
  | { name: "join"; token: string }
  | { name: "notFound" };

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "lists" };
  const list = /^\/lists\/([^/]+)$/.exec(path);
  if (list) return { name: "list", id: decodeURIComponent(list[1]!) };
  const join = /^\/join\/([^/]+)$/.exec(path);
  if (join) return { name: "join", token: decodeURIComponent(join[1]!) };
  return { name: "notFound" };
}

export const paths = {
  lists: () => "/",
  list: (id: string) => `/lists/${encodeURIComponent(id)}`,
  join: (token: string) => `/join/${encodeURIComponent(token)}`,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(to: string, { replace = false } = {}): void {
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  listeners.forEach((l) => l());
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );
  return matchRoute(pathname);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    // Ctrl/Cmd-klik i środkowy przycisk otwierają nową kartę jak zwykły link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handleClick} {...rest} />;
}
