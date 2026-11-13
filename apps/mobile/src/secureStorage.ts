import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "@shoplist/core";

// Adapter: @shoplist/core oczekuje interfejsu jak localStorage
// (getItem / setItem / removeItem). SecureStore ma te same operacje
// pod innymi nazwami, więc tylko je tłumaczymy.
export const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
