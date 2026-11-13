import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "../theme";

export interface InviteSheetProps {
  visible: boolean;
  listName: string;
  url: string;
  onClose: () => void;
}

/** Arkusz zaproszenia: kod QR z linkiem do listy i przycisk udostępniania. */
export function InviteSheet({ visible, listName, url, onClose }: InviteSheetProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  const share = () => {
    // Systemowy panel Androida: SMS, Messenger, mail, schowek…
    void Share.share({ message: `Dołącz do mojej listy zakupów „${listName}”: ${url}` }).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Dotknięcie tła zamyka arkusz; onRequestClose obsługuje systemowe „Wstecz”. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij">
        <Pressable
          style={[styles.sheet, { backgroundColor: c.paper, paddingBottom: Math.max(insets.bottom, 20) }]}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: c.ink }]}>Zaproś do listy</Text>
          <Text style={[styles.lead, { color: c.muted }]}>
            Zeskanuj aparatem telefonu. Każdy, kto ma ten kod, może dołączyć do „{listName}” i edytować listę.
          </Text>

          {/* QR zawsze czarny na białym, także w trybie ciemnym: tak skanery czytają najpewniej. */}
          <View style={styles.qr}>
            <QRCode value={url} size={240} color="#000000" backgroundColor="#ffffff" ecl="M" />
          </View>

          <Text selectable style={[styles.url, { color: c.muted }]} numberOfLines={2}>
            {url}
          </Text>

          <Pressable
            onPress={share}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: c.ink, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: c.paper }]}>Udostępnij link</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.close, { color: c.muted }]}>Zamknij</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,16,13,0.5)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14,
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700", alignSelf: "flex-start" },
  lead: { fontSize: 15, lineHeight: 21, alignSelf: "flex-start" },
  qr: { padding: 14, backgroundColor: "#ffffff", borderRadius: 14 },
  url: { fontSize: 13, textAlign: "center" },
  button: { alignSelf: "stretch", minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  close: { fontSize: 15, fontWeight: "600", paddingVertical: 4 },
});