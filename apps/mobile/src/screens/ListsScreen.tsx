import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth, useLists } from "@shoplist/core";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { RootStackParamList } from "../navigation";
import { useColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Lists">;

export function ListsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { lists, loading, error, refresh, createList } = useLists();
  const c = useColors();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Listy nie mają kanału na żywo: odświeżamy przy każdym powrocie na ekran.
  // Pierwsze wejście pomijamy, bo useLists pobiera listy przy starcie.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const list = await createList(trimmed);
      setName("");
      Keyboard.dismiss();
      navigation.navigate("List", { listId: list.id, name: list.name });
    } catch {
      setCreateError("Nie udało się utworzyć listy. Sprawdź połączenie.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      data={lists}
      keyExtractor={(list) => list.id}
      refreshing={loading && lists.length > 0}
      onRefresh={() => void refresh()}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Text style={[styles.hello, { color: c.muted }]}>Cześć, {user?.display_name}</Text>
            <Pressable onPress={() => void logout()} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.link, { color: c.muted }]}>Wyloguj</Text>
            </Pressable>
          </View>

          <View style={styles.newRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={create}
              placeholder="Nowa lista, np. Biedronka"
              placeholderTextColor={c.muted}
              maxLength={80}
              returnKeyType="done"
              accessibilityLabel="Nazwa nowej listy"
              style={[styles.input, { color: c.ink, backgroundColor: c.paper, borderColor: c.line }]}
            />
            <Pressable
              onPress={create}
              disabled={!name.trim() || creating}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.ink, opacity: !name.trim() || creating ? 0.45 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.paper }]}>Utwórz</Text>
            </Pressable>
          </View>

          {createError && <Text style={[styles.error, { color: c.marker }]}>{createError}</Text>}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={c.ink} style={styles.empty} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={{ color: c.ink }}>Nie udało się wczytać list. Sprawdź połączenie.</Text>
            <Pressable onPress={() => void refresh()} accessibilityRole="button">
              <Text style={[styles.link, { color: c.ink }]}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.ink }]}>Nie masz jeszcze żadnej listy.</Text>
            <Text style={{ color: c.muted }}>Utwórz pierwszą powyżej albo zeskanuj kod QR od znajomego.</Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("List", { listId: item.id, name: item.name })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { borderColor: c.line, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.chevron, { color: c.muted }]}>›</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  header: { gap: 14, marginBottom: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { fontSize: 15, fontWeight: "600" },
  link: { fontSize: 15, fontWeight: "600" },
  newRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  error: { fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
    borderBottomWidth: 1.5,
  },
  rowName: { flex: 1, fontSize: 19, fontWeight: "650" as "600" },
  chevron: { fontSize: 26, marginLeft: 12 },
  empty: { paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
});