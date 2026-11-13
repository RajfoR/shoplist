import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth, useList, type ConnectionStatus } from "@shoplist/core";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InviteSheet } from "../components/InviteSheet";
import { ItemRow } from "../components/ItemRow";
import { joinUrl } from "../config";
import { describeError } from "../errors";
import type { RootStackParamList } from "../navigation";
import { useColors, type Colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "List">;

const TOAST_MS = 5000;

export function ListScreen({ route, navigation }: Props) {
  const { listId } = route.params;
  const { user } = useAuth();
  const c = useColors();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Cała logika: snapshot, WebSocket, optimistic update, rollback.
  const {
    list, status, connection, error, clearError, resync,
    addItem, toggleItem, updateItem, deleteItem, deleteList,
  } = useList(listId);

  const [inviteOpen, setInviteOpen] = useState(false);

  // Nagłówek: tytuł nadąża za zmianą nazwy (także zrobioną przez kogoś innego),
  // a po prawej przycisk zaproszenia, gdy lista jest już wczytana.
  const listName = list?.name;
  const loaded = list !== null;
  useLayoutEffect(() => {
    navigation.setOptions({
      ...(listName ? { title: listName } : {}),
      headerRight: loaded
        ? () => (
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.headerButton, { color: c.ink }]}>Zaproś</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, listName, loaded, c.ink]);

  // Toast z błędem znika sam po kilku sekundach.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (status === "loading" || (status === "error" && !list)) {
    return (
      <StatusView
        colors={c}
        title={status === "loading" ? undefined : "Nie udało się wczytać listy"}
        body={status === "loading" ? undefined : "Sprawdź połączenie z internetem."}
        action={status === "error" ? { label: "Spróbuj ponownie", onPress: () => void resync() } : undefined}
        onBack={() => navigation.goBack()}
      />
    );
  }
  if (status === "not_found") {
    return (
      <StatusView
        colors={c}
        title="Nie masz dostępu do tej listy"
        body="Lista nie istnieje albo nie jesteś jej członkiem."
        onBack={() => navigation.goBack()}
      />
    );
  }
  if (status === "deleted" || !list || !user) {
    return (
      <StatusView
        colors={c}
        title="Ta lista została usunięta"
        body="Właściciel usunął ją dla wszystkich."
        onBack={() => navigation.goBack()}
      />
    );
  }

  // Do kupienia na górze (w kolejności dodania), kupione zjeżdżają niżej.
  const toBuy = list.items.filter((i) => !i.checked);
  const inCart = list.items.filter((i) => i.checked);
  const sections = [
    { key: "toBuy", title: null, data: toBuy },
    { key: "inCart", title: `W koszyku: ${inCart.length}`, data: inCart },
  ].filter((s) => s.data.length > 0);

  const isOwner = list.owner_id === user.id;
  const confirmDelete = () =>
    Alert.alert("Usunąć listę?", `„${list.name}” zniknie u wszystkich osób.`, [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: () => void deleteList() },
    ]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <SectionList
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.meta}>
            <LiveBadge status={connection} colors={c} />
            <Text style={[styles.metaText, { color: c.muted }]}>
              {list.members.length === 1 ? "Tylko ty" : `Osoby na liście: ${list.members.length}`}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text style={[styles.sectionTitle, { color: c.muted }]}>{section.title}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: c.paper }}>
            <ItemRow
              item={item}
              onToggle={(id) => void toggleItem(id)}
              onUpdate={(id, patch) => void updateItem(id, patch)}
              onDelete={(id) => void deleteItem(id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.muted }]}>
            Lista jest pusta. Wpisz pierwszą rzecz w polu na dole ekranu.
          </Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {list.items.length > 0 && (
              <Text style={[styles.hint, { color: c.muted }]}>
                Dotknij produktu, żeby go odhaczyć. Przytrzymaj, żeby edytować.
              </Text>
            )}
            {isOwner && (
              <Pressable onPress={confirmDelete} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.deleteList, { color: c.muted }]}>Usuń listę</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12), borderColor: c.line }]}>
        {error && (
          <Pressable
            onPress={clearError}
            accessibilityRole="alert"
            style={[styles.toast, { backgroundColor: c.ink }]}
          >
            <Text style={[styles.toastText, { color: c.paper }]}>{describeError(error)}</Text>
          </Pressable>
        )}
        <AddItemForm colors={c} onAdd={(name, qty) => void addItem(name, qty)} />
      </View>

      <InviteSheet
        visible={inviteOpen}
        listName={list.name}
        url={joinUrl(list.share_token)}
        onClose={() => setInviteOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function AddItemForm({ colors: c, onAdd }: { colors: Colors; onAdd: (name: string, qty: string | null) => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, quantity.trim() || null);
    setName("");
    setQuantity("");
    // Fokus zostaje w polu nazwy: kilka produktów pod rząd bez dotykania ekranu.
    nameRef.current?.focus();
  };

  const field = [styles.field, { color: c.ink, backgroundColor: c.paper, borderColor: c.line }];

  return (
    <View style={styles.addRow}>
      <TextInput
        ref={nameRef}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        submitBehavior="submit"
        returnKeyType="done"
        placeholder="Co kupić?"
        placeholderTextColor={c.muted}
        maxLength={120}
        accessibilityLabel="Co kupić?"
        style={[field, styles.flex]}
      />
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        onSubmitEditing={submit}
        placeholder="ile?"
        placeholderTextColor={c.muted}
        maxLength={40}
        accessibilityLabel="Ilość"
        style={[field, styles.qty]}
      />
      <Pressable
        onPress={submit}
        disabled={!name.trim()}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: c.ink, opacity: !name.trim() ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.addButtonText, { color: c.paper }]}>Dodaj</Text>
      </Pressable>
    </View>
  );
}

const LIVE_LABEL: Record<ConnectionStatus, string> = {
  open: "Na żywo",
  connecting: "Łączę…",
  closed: "Brak połączenia",
};

function LiveBadge({ status, colors: c }: { status: ConnectionStatus; colors: Colors }) {
  return (
    <View style={styles.live} accessibilityRole="text" accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: status === "open" ? c.live : c.pending }]} />
      <Text style={[styles.metaText, { color: c.muted }]}>{LIVE_LABEL[status]}</Text>
    </View>
  );
}

interface StatusViewProps {
  colors: Colors;
  title?: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  onBack: () => void;
}

function StatusView({ colors: c, title, body, action, onBack }: StatusViewProps) {
  if (!title) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.ink} />
      </View>
    );
  }
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusTitle, { color: c.ink }]}>{title}</Text>
      {body && <Text style={[styles.statusBody, { color: c.muted }]}>{body}</Text>}
      {action && (
        <Pressable onPress={action.onPress} style={[styles.addButton, { backgroundColor: c.ink }]}>
          <Text style={[styles.addButtonText, { color: c.paper }]}>{action.label}</Text>
        </Pressable>
      )}
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.metaText, { color: c.muted }]}>Wróć do list</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButton: { fontSize: 16, fontWeight: "700" },
  listContent: { paddingBottom: 24 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
  },
  metaText: { fontSize: 14, fontWeight: "600" },
  live: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  sectionTitle: { fontSize: 14, fontWeight: "700", paddingHorizontal: 18, paddingTop: 20, paddingBottom: 6 },
  empty: { paddingHorizontal: 18, paddingVertical: 32, fontSize: 16 },
  footer: { alignItems: "center", gap: 18, paddingTop: 20 },
  hint: { fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  deleteList: { fontSize: 15, textDecorationLine: "underline" },
  dock: { gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  toast: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  toastText: { fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 8 },
  field: { minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  qty: { width: 72 },
  addButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, justifyContent: "center", alignItems: "center" },
  addButtonText: { fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  statusTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  statusBody: { fontSize: 16, textAlign: "center" },
});