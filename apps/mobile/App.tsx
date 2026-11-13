import { ShoplistProvider, useAuth, type ShoplistConfig } from "@shoplist/core";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { apiUrl, wsUrl } from "./src/config";
import { AppNavigator } from "./src/navigation";
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

// Bramka logowania: nawigacja (ekrany wymagające sesji) dopiero po zalogowaniu.
function Root() {
  const { status } = useAuth();
  const c = useColors();

  if (status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.ink} />
      </View>
    );
  }
  if (status === "anonymous") return <LoginScreen />;
  return <AppNavigator />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});