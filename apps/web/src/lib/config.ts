declare global {
  interface Window {
    /** Ustawiane przez /config.js (na produkcji generuje go Caddy z env kontenera). */
    __SHOPLIST_CONFIG__?: { apiUrl: string; wsUrl: string };
  }
}

export function runtimeConfig(): { apiUrl: string; wsUrl: string } {
  const injected = window.__SHOPLIST_CONFIG__;
  if (injected?.apiUrl && injected.wsUrl) return injected;
  return {
    apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
    wsUrl: import.meta.env.VITE_WS_URL ?? "ws://localhost:8000",
  };
}
