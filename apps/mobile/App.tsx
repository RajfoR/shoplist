import { ShoplistProvider, useAuth, type ShoplistConfig } from "@shoplist/core";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { apiUrl, wsUrl } from "./src/config";
import { LoginScreen } from "./src/screens/LoginScreen";
import { secureStorage } from "./src/secureStorage";
import { useColors } from "./src/theme";

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
    <SafeAreaProvider>
      <ShoplistProvider config={config}>
        <Root />
        <StatusBar style="auto" />
      </ShoplistProvider>
    </SafeAreaProvider>
  );
}

// Bramka logowania: ekrany wymagające sesji renderujemy dopiero po zalogowaniu.
function Root() {
  const { status, user, logout } = useAuth();
  const c = useColors();

  if (status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.ink} />
      </View>
    );
  }

  if (status === "anonymous") return <LoginScreen />;

  // TYMCZASOWE: w kroku 3 zastąpi to nawigacja z ekranem „Moje listy”.
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Text style={[styles.hello, { color: c.ink }]}>Cześć, {user?.display_name}</Text>
      <Pressable onPress={() => void logout()}>
        <Text style={{ color: c.muted }}>Wyloguj</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  hello: { fontSize: 24, fontWeight: "700" },
});