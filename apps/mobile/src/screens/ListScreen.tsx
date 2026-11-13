import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../navigation";
import { useColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "List">;

// TYMCZASOWE: prawdziwy ekran listy na żywo w kroku 5.
export function ListScreen({ route }: Props) {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.muted }}>id listy: {route.params.listId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});