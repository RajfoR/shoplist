import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from "expo-camera";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "../theme";

export interface ScannerCameraProps {
  /** Jakie kody rozpoznawać: "qr" dla zaproszeń, EAN/UPC dla produktów. */
  barcodeTypes: BarcodeType[];
  /** Podpowiedź na podglądzie, np. „Skieruj aparat na kod QR”. */
  hint: string;
  /** Do czego służy aparat: pokazywane przed prośbą o uprawnienie. */
  purpose: string;
  onScanned: (result: BarcodeScanningResult) => void;
  /** Wstrzymuje rozpoznawanie, np. gdy pokazujemy wynik skanu. */
  paused?: boolean;
}

/**
 * Podgląd aparatu z rozpoznawaniem kodów albo prośba o uprawnienie.
 * Wspólny dla skanera zaproszeń (QR) i skanera produktów (kody kreskowe).
 */
export function ScannerCamera({ barcodeTypes, hint, purpose, onScanned, paused }: ScannerCameraProps) {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <View style={[styles.box, styles.center, { backgroundColor: c.paper }]}>
        <ActivityIndicator color={c.ink} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.box, styles.center, { backgroundColor: c.paper, borderColor: c.line }]}>
        <Text style={[styles.title, { color: c.ink }]}>Potrzebny dostęp do aparatu</Text>
        <Text style={[styles.body, { color: c.muted }]}>
          {permission.canAskAgain
            ? `${purpose} Nic nie jest nagrywane.`
            : "Dostęp został zablokowany. Włącz go w ustawieniach telefonu."}
        </Text>
        {permission.canAskAgain && (
          <Pressable
            onPress={() => void requestPermission()}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: c.ink }]}
          >
            <Text style={[styles.buttonText, { color: c.paper }]}>Zezwól na aparat</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes }}
        // undefined = aparat działa, ale nie rozpoznaje kodów
        onBarcodeScanned={paused ? undefined : onScanned}
      />
      {/* Ramka podpowiada, gdzie trzymać kod. pointerEvents: nie zasłania aparatu dla dotyku. */}
      <View pointerEvents="none" style={styles.frame} />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
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
    left: "12%",
    right: "12%",
    bottom: "18%",
    borderWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 18,
    opacity: 0.9,
  },
  hint: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    color: "#ffffff",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, textAlign: "center", lineHeight: 21 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
});