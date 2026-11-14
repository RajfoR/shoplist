import type { BarcodeScanningResult } from "expo-camera";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isValidBarcode, lookupProduct, type ScannedProduct } from "../products";
import { useColors, type Colors } from "../theme";
import { ScannerCamera } from "./ScannerCamera";

export interface ProductScannerProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string | null) => void;
}

type Phase =
  | { kind: "scanning" }
  | { kind: "loading"; code: string }
  | { kind: "found"; product: ScannedProduct }
  | { kind: "not_found"; code: string }
  | { kind: "error"; code: string; message: string };

/** Skaner kodów kreskowych produktów: kod → Open Food Facts → produkt na liście. */
export function ProductScanner({ visible, onClose, onAdd }: ProductScannerProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [manualName, setManualName] = useState("");
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Aparat zgłasza ten sam kod wiele razy na sekundę: ref blokuje od razu.
  const busy = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Gdy wysuwa się klawiatura (pole „Nazwa produktu”), przewijamy do karty z wynikiem,
  // żeby klawiatura jej nie zasłoniła.
  useEffect(() => {
    if (!visible) return;
    const sub = Keyboard.addListener("keyboardDidShow", () => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, [visible]);

  const lookup = async (code: string) => {
    setPhase({ kind: "loading", code });
    const result = await lookupProduct(code);
    if (result.status === "found") setPhase({ kind: "found", product: result.product });
    else if (result.status === "not_found") setPhase({ kind: "not_found", code });
    else setPhase({ kind: "error", code, message: result.message });
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    // Błędny odczyt (zła cyfra kontrolna) ignorujemy po cichu: aparat zaraz odczyta ponownie.
    if (busy.current || !isValidBarcode(data)) return;
    busy.current = true;
    setLastAdded(null);
    void lookup(data);
  };

  const scanAgain = () => {
    setManualName("");
    setPhase({ kind: "scanning" });
    busy.current = false;
  };

  const add = (name: string, quantity: string | null) => {
    onAdd(name, quantity);
    setLastAdded(name);
    scanAgain(); // od razu można skanować kolejny produkt
  };

  const close = () => {
    scanAgain();
    setLastAdded(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.ink }]}>Skanuj produkty</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.done, { color: c.ink }]}>Gotowe</Text>
          </Pressable>
        </View>

        {/* Modal to osobne okno: sami robimy miejsce na klawiaturę. */}
        <KeyboardAvoidingView style={styles.screen} behavior="padding">
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ScannerCamera
              barcodeTypes={["ean13", "ean8", "upc_a"]}
              hint="Skieruj aparat na kod kreskowy produktu"
              purpose="Aparat służy tylko do odczytania kodu kreskowego produktu."
              onScanned={onScanned}
              paused={phase.kind !== "scanning"}
            />

            {lastAdded && phase.kind === "scanning" && (
              <Text style={[styles.added, { color: c.live }]} accessibilityRole="alert">
                Dodano: {lastAdded}. Skanuj kolejny produkt.
              </Text>
            )}

            <ResultCard
              phase={phase}
              colors={c}
              manualName={manualName}
              onManualName={setManualName}
              onAdd={add}
              onRetry={(code) => void lookup(code)}
              onScanAgain={scanAgain}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface ResultCardProps {
  phase: Phase;
  colors: Colors;
  manualName: string;
  onManualName: (name: string) => void;
  onAdd: (name: string, quantity: string | null) => void;
  onRetry: (code: string) => void;
  onScanAgain: () => void;
}

/** Wynik skanu: szukanie, znaleziony produkt, brak w bazie albo błąd sieci. */
function ResultCard({ phase, colors: c, manualName, onManualName, onAdd, onRetry, onScanAgain }: ResultCardProps) {
  if (phase.kind === "scanning") return null;

  const card = [styles.card, { backgroundColor: c.paper, borderColor: c.line }];
  const secondary = (
    <Pressable onPress={onScanAgain} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.link, { color: c.muted }]}>Skanuj inny</Text>
    </Pressable>
  );

  if (phase.kind === "loading") {
    return (
      <View style={[card, styles.row]}>
        <ActivityIndicator color={c.ink} />
        <Text style={{ color: c.ink }}>Szukam produktu {phase.code}…</Text>
      </View>
    );
  }

  if (phase.kind === "found") {
    const { name, quantity } = phase.product;
    return (
      <View style={card}>
        <Text style={[styles.productName, { color: c.ink }]}>{name}</Text>
        {quantity && <Text style={{ color: c.muted }}>{quantity}</Text>}
        <View style={styles.actions}>
          {secondary}
          <PrimaryButton colors={c} label="Dodaj do listy" onPress={() => onAdd(name, quantity)} />
        </View>
      </View>
    );
  }

  if (phase.kind === "not_found") {
    return (
      <View style={card}>
        <Text style={[styles.cardTitle, { color: c.ink }]}>Nie znaleziono produktu</Text>
        <Text style={{ color: c.muted }}>
          Kodu {phase.code} nie ma w bazie Open Food Facts. Wpisz nazwę, a dodamy go ręcznie.
        </Text>
        <TextInput
          value={manualName}
          onChangeText={onManualName}
          placeholder="Nazwa produktu"
          placeholderTextColor={c.muted}
          maxLength={120}
          autoFocus
          accessibilityLabel="Nazwa produktu"
          style={[styles.input, { color: c.ink, backgroundColor: c.bg, borderColor: c.line }]}
        />
        <View style={styles.actions}>
          {secondary}
          <PrimaryButton
            colors={c}
            label="Dodaj do listy"
            disabled={!manualName.trim()}
            onPress={() => onAdd(manualName.trim(), null)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={card}>
      <Text style={[styles.cardTitle, { color: c.marker }]}>{phase.message}</Text>
      <View style={styles.actions}>
        {secondary}
        <PrimaryButton colors={c} label="Spróbuj ponownie" onPress={() => onRetry(phase.code)} />
      </View>
    </View>
  );
}

function PrimaryButton(props: { colors: Colors; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors: c, label, onPress, disabled } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: c.ink, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.primaryText, { color: c.paper }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: "700" },
  done: { fontSize: 16, fontWeight: "700" },
  content: { padding: 16, gap: 16 },
  added: { fontWeight: "700" },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  productName: { fontSize: 20, fontWeight: "700" },
  input: { minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  link: { fontSize: 16, fontWeight: "600" },
  primary: { minHeight: 48, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "700" },
});