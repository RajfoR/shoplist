import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJoinList } from "@shoplist/core";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { RootStackParamList } from "../navigation";
import { extractShareToken } from "../shareToken";
import { useColors, type Colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

export function ScanScreen({ navigation }: Props) {
  const c = useColors();
  const headerHeight = useHeaderHeight();
  const [permission, requestPermission] = useCameraPermissions();
  const { join, joining } = useJoinList();
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  // Aparat zgłasza ten sam kod kilka razy na sekundę. Ref blokuje kolejne
  // zgłoszenia od razu, bez czekania na przerysowanie komponentu.
  const busy = useRef(false);

  const tryJoin = async (input: string) => {
    if (busy.current) return;
    const token = extractShareToken(input);
    if (!token) {
      setMessage("To nie jest kod zaproszenia do Shoplist.");
      return;
    }
    busy.current = true;
    setMessage(null);
    const list = await join(token);
    if (list) {
      // replace: „Wstecz” z listy wraca do „Twoje listy”, a nie do skanera.
      navigation.replace("List", { listId: list.id, name: list.name });
      return;
    }
    setMessage("Ten kod nie działa. Lista mogła zostać usunięta. Poproś o nowy kod.");
    busy.current = false;
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    if (!extractShareToken(data)) {
      // Obcy kod QR: pokazujemy komunikat i na chwilę wstrzymujemy skanowanie,
      // żeby nie migał przy każdej klatce.
      busy.current = true;
      setMessage("To nie jest kod zaproszenia do Shoplist.");
      setTimeout(() => {
        busy.current = false;
      }, 2000);
      return;
    }
    void tryJoin(data);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CameraArea
          colors={c}
          granted={permission?.granted ?? false}
          canAskAgain={permission?.canAskAgain ?? true}
          loading={permission === null}
          onRequest={() => void requestPermission()}
          onScanned={onScanned}
        />

        {joining && (
          <View style={styles.row}>
            <ActivityIndicator color={c.ink} />
            <Text style={{ color: c.ink }}>Dołączam do listy…</Text>
          </View>
        )}
        {message && (
          <Text style={[styles.message, { color: c.marker }]} accessibilityRole="alert">
            {message}
          </Text>
        )}

        <Text style={[styles.label, { color: c.ink }]}>Albo wklej link lub kod zaproszenia</Text>
        <View style={styles.row}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            onSubmitEditing={() => void tryJoin(manual)}
            placeholder="https://…/join/…"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            accessibilityLabel="Link lub kod zaproszenia"
            style={[styles.input, { color: c.ink, backgroundColor: c.paper, borderColor: c.line }]}
          />
          <Pressable
            onPress={() => void tryJoin(manual)}
            disabled={!manual.trim() || joining}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: c.ink, opacity: !manual.trim() || joining ? 0.45 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: c.paper }]}>Dołącz</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface CameraAreaProps {
  colors: Colors;
  granted: boolean;
  canAskAgain: boolean;
  loading: boolean;
  onRequest: () => void;
  onScanned: (result: BarcodeScanningResult) => void;
}

/** Podgląd aparatu albo prośba o uprawnienie, zależnie od jego stanu. */
function CameraArea({ colors: c, granted, canAskAgain, loading, onRequest, onScanned }: CameraAreaProps) {
  if (loading) {
    return (
      <View style={[styles.camera, styles.center, { backgroundColor: c.paper }]}>
        <ActivityIndicator color={c.ink} />
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={[styles.camera, styles.center, { backgroundColor: c.paper, borderColor: c.line }]}>
        <Text style={[styles.permTitle, { color: c.ink }]}>Potrzebny dostęp do aparatu</Text>
        <Text style={[styles.permBody, { color: c.muted }]}>
          {canAskAgain
            ? "Aparat służy tylko do odczytania kodu QR zaproszenia. Nic nie jest nagrywane."
            : "Dostęp został zablokowany. Włącz go w ustawieniach telefonu albo wklej link poniżej."}
        </Text>
        {canAskAgain && (
          <Pressable onPress={onRequest} style={[styles.button, { backgroundColor: c.ink }]} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: c.paper }]}>Zezwól na aparat</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      {/* Ramka podpowiada, gdzie trzymać kod. pointerEvents: nie zasłania aparatu dla dotyku. */}
      <View pointerEvents="none" style={styles.frame} />
      <Text style={styles.cameraHint}>Skieruj aparat na kod QR zaproszenia</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  camera: {
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#000",
  },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  frame: {
    position: "absolute",
    top: "18%",
    left: "18%",
    right: "18%",
    bottom: "18%",
    borderWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 18,
    opacity: 0.9,
  },
  cameraHint: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    color: "#ffffff",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  permTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  permBody: { fontSize: 15, textAlign: "center", lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  message: { fontWeight: "600" },
  label: { fontSize: 15, fontWeight: "600" },
  input: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
});