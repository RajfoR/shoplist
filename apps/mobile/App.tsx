import { ShoplistProvider, useAuth, type ShoplistConfig } from "@shoplist/core";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { apiUrl, wsUrl } from "./src/config";
import { secureStorage } from "./src/secureStorage";

// Poza komponentem: nowy obiekt przy każdym renderze odtwarzałby
// połączenia i stan w providerze.
const config: ShoplistConfig = {
  apiUrl,
  wsUrl,
  storage: secureStorage,
  generateId: () => Crypto.randomUUID(),
};

export default function App() {
  return (
    <ShoplistProvider config={config}>
      <ConnectionCheck />
      <StatusBar style="auto" />
    </ShoplistProvider>
  );
}

// TYMCZASOWE: sprawdza ścieżkę telefon → API → SecureStore.
// W następnym kroku zastąpi go prawdziwy ekran logowania.
function ConnectionCheck() {
  const { status, user, loginAsGuest, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    try {
      await loginAsGuest("Test z telefonu");
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>API: {apiUrl}</Text>

      {status === "loading" && <ActivityIndicator size="large" />}

      {status === "anonymous" && (
        <Pressable style={styles.button} onPress={login}>
          <Text style={styles.buttonText}>Zaloguj jako gość</Text>
        </Pressable>
      )}

      {status === "authenticated" && user && (
        <>
          <Text style={styles.title}>Zalogowany: {user.display_name}</Text>
          <Pressable style={styles.button} onPress={() => void logout()}>
            <Text style={styles.buttonText}>Wyloguj</Text>
          </Pressable>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  label: { color: "#5d6c65" },
  title: { fontSize: 22, fontWeight: "700" },
  button: { backgroundColor: "#17231d", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#e5402a", textAlign: "center" },
});
