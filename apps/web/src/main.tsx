import "@fontsource-variable/bricolage-grotesque";
import "./styles.css";

import { ShoplistProvider, type ShoplistConfig } from "@shoplist/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { runtimeConfig } from "./lib/config";

// Konfiguracja tworzona raz, poza komponentem: nowy obiekt przy każdym renderze
// odtwarzałby store listy i socket.
const config: ShoplistConfig = {
  ...runtimeConfig(),
  storage: window.localStorage,
  generateId: () => crypto.randomUUID(), // tylko HTTPS i localhost
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShoplistProvider config={config}>
      <App />
    </ShoplistProvider>
  </StrictMode>,
);
