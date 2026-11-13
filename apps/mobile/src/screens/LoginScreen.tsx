import { useAuth } from "@shoplist/core";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "../theme";

export function LoginScreen() {
  const { loginAsGuest } = useAuth();
  const c = useColors();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const disabled = !trimmed || submitting;

  const submit = async () => {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await loginAsGuest(trimmed);
      // Sukces: App.tsx sam przełączy ekran, ten komponent zniknie.
    } catch {
      setError("Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={styles.content} behavior="padding">
        <Text style={[styles.title, { color: c.ink }]}>Shoplist</Text>
        <Text style={[styles.lead, { color: c.ink }]}>
          Jedna lista zakupów dla całego domu. Każde odhaczenie widać od razu u wszystkich.
        </Text>

        <Text style={[styles.label, { color: c.ink }]}>Jak masz na imię?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          editable={!submitting}
          maxLength={40}
          autoFocus
          autoCapitalize="words"
          autoComplete="given-name"
          returnKeyType="go"
          placeholder="np. Kasia"
          placeholderTextColor={c.muted}
          accessibilityLabel="Jak masz na imię?"
          style={[styles.input, { color: c.ink, backgroundColor: c.paper, borderColor: c.line }]}
        />

        {error && (
          <Text style={[styles.error, { color: c.marker }]} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.ink, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={c.paper} />
          ) : (
            <Text style={[styles.buttonText, { color: c.paper }]}>Wejdź</Text>
          )}
        </Pressable>

        <Text style={[styles.note, { color: c.muted }]}>
          Bez rejestracji i hasła. Imię widzą tylko osoby z twoich list.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  title: { fontSize: 52, fontWeight: "800", letterSpacing: -2 },
  lead: { fontSize: 18, lineHeight: 26, marginBottom: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, fontSize: 17 },
  error: { fontWeight: "600" },
  button: { minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 17, fontWeight: "700" },
  note: { fontSize: 14, marginTop: 4 },
});