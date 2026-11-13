import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

import { ListScreen } from "./screens/ListScreen";
import { ListsScreen } from "./screens/ListsScreen";
import { useColors } from "./theme";

// Jakie ekrany istnieją i jakie dane dostaje każdy z nich.
// TypeScript pilnuje, że navigate("List", ...) zawsze dostanie listId.
export type RootStackParamList = {
  Lists: undefined;
  List: { listId: string; name?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const c = useColors();
  const scheme = useColorScheme();

  // Motyw nawigacji (nagłówek, tło) z naszej palety, z obsługą trybu ciemnego.
  const theme = useMemo<Theme>(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.ink, background: c.bg, card: c.bg, text: c.ink, border: c.line },
    };
  }, [scheme, c]);

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: "700" } }}>
        <Stack.Screen name="Lists" component={ListsScreen} options={{ title: "Twoje listy" }} />
        <Stack.Screen
          name="List"
          component={ListScreen}
          options={({ route }) => ({ title: route.params.name ?? "Lista" })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}