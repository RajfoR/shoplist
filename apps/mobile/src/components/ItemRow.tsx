import type { Item, ItemUpdate } from "@shoplist/api-client";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors, type Colors } from "../theme";

export interface ItemRowProps {
  item: Item;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: ItemUpdate) => void;
  onDelete: (id: string) => void;
}

/** Jeden produkt: dotknięcie odhacza, przytrzymanie otwiera edycję. */
export function ItemRow({ item, onToggle, onUpdate, onDelete }: ItemRowProps) {
  const c = useColors();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ItemEditor
        item={item}
        colors={c}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          setEditing(false);
          if (Object.keys(patch).length > 0) onUpdate(item.id, patch);
        }}
        onDelete={() => onDelete(item.id)}
      />
    );
  }

  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      onLongPress={() => setEditing(true)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={item.quantity ? `${item.name}, ${item.quantity}` : item.name}
      accessibilityHint="Dotknij, żeby odhaczyć. Przytrzymaj, żeby edytować."
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.grid }]}
    >
      <View
        style={[
          styles.box,
          item.checked
            ? { backgroundColor: c.marker, borderColor: c.marker }
            : { backgroundColor: c.paper, borderColor: c.muted },
        ]}
      >
        {item.checked && <Text style={styles.tick}>✓</Text>}
      </View>

      <View style={styles.textWrap}>
        <View style={styles.text}>
          <Text style={[styles.name, { color: item.checked ? c.muted : c.ink }]}>{item.name}</Text>
          {item.quantity ? (
            <Text style={[styles.qty, { color: c.muted }]}>{item.quantity}</Text>
          ) : null}
          <Strike checked={item.checked} color={c.marker} />
        </View>
      </View>
    </Pressable>
  );
}

/** Skreślenie flamastrem: rośnie od lewej przy odhaczeniu, cofa się przy odznaczeniu. */
function Strike({ checked, color }: { checked: boolean; color: string }) {
  // Wartość 0..1 żyje poza stanem Reacta: animacja nie wywołuje renderów.
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 260,
      useNativeDriver: true, // animację liczy natywny wątek UI, nie JavaScript
    }).start();
  }, [checked, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.strike, { backgroundColor: color, transform: [{ scaleX: progress }] }]}
    />
  );
}

interface ItemEditorProps {
  item: Item;
  colors: Colors;
  onSave: (patch: ItemUpdate) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ItemEditor({ item, colors: c, onSave, onCancel, onDelete }: ItemEditorProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");

  // Wysyłamy tylko pola, które naprawdę się zmieniły.
  const save = () => {
    const patch: ItemUpdate = {};
    const trimmedName = name.trim();
    const trimmedQty = quantity.trim();
    if (trimmedName && trimmedName !== item.name) patch.name = trimmedName;
    if (trimmedQty !== (item.quantity ?? "")) patch.quantity = trimmedQty || null;
    onSave(patch);
  };

  const field = [styles.field, { color: c.ink, backgroundColor: c.paper, borderColor: c.line }];

  return (
    <View style={[styles.editor, { backgroundColor: c.grid }]}>
      <View style={styles.editorFields}>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={save}
          maxLength={120}
          autoFocus
          accessibilityLabel="Nazwa"
          style={[field, styles.fieldName]}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          onSubmitEditing={save}
          maxLength={40}
          placeholder="ile?"
          placeholderTextColor={c.muted}
          accessibilityLabel="Ilość"
          style={[field, styles.fieldQty]}
        />
      </View>
      <View style={styles.editorActions}>
        <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: c.marker }]}>Usuń</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: c.muted }]}>Anuluj</Text>
        </Pressable>
        <Pressable
          onPress={save}
          accessibilityRole="button"
          style={[styles.saveButton, { backgroundColor: c.ink }]}
        >
          <Text style={[styles.action, { color: c.paper }]}>Zapisz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingHorizontal: 18 },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: { color: "#fff", fontSize: 15, fontWeight: "800", lineHeight: 18 },
  textWrap: { flex: 1, paddingVertical: 12 },
  // alignSelf: kontener ma szerokość tekstu, więc skreślenie kończy się na tekście.
  text: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, alignSelf: "flex-start" },
  name: { fontSize: 18 },
  qty: { fontSize: 15 },
  strike: {
    position: "absolute",
    left: -5,
    right: -5,
    top: "50%",
    height: 9,
    marginTop: -3,
    borderRadius: 999,
    opacity: 0.75,
    transformOrigin: "left",
  },
  editor: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  editorFields: { flexDirection: "row", gap: 8 },
  field: { minHeight: 46, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  fieldName: { flex: 1 },
  fieldQty: { width: 88 },
  editorActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  action: { fontSize: 16, fontWeight: "600" },
  spacer: { flex: 1 },
  saveButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
});