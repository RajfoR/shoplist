import type * as ExpoCrypto from "expo-crypto";

// expo-crypto ładujemy dopiero przy pierwszym użyciu, a nie przy starcie aplikacji.
// W Expo Go import na samej górze App.tsx szukał modułu natywnego w pierwszej
// milisekundzie startu, zanim środowisko było gotowe ("runtime not ready").
// Przy pierwszym dodaniu produktu aplikacja dawno już działa.
let crypto: typeof ExpoCrypto | null = null;

/** UUID v4 z kryptograficznego generatora liczb losowych systemu. */
export function generateId(): string {
  crypto ??= require("expo-crypto") as typeof ExpoCrypto;
  return crypto.randomUUID();
}