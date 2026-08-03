import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DocumentUpload">;

const DOCUMENT_TYPES = [
  { value: "lease", label: "Lease", icon: "🏠" },
  { value: "medical", label: "Medical", icon: "🩺" },
  { value: "job-letter", label: "Job letter", icon: "💼" },
  { value: "other", label: "Other", icon: "📄" },
] as const;

// MVP: the user pastes the document text directly. Camera capture + on-device
// OCR is planned for the document-upload milestone; this screen already
// produces the same downstream shape (a Document row with extractedText) so
// swapping in OCR later doesn't change anything past this screen.
export function DocumentUploadScreen({ navigation }: Props) {
  const [type, setType] = useState<(typeof DOCUMENT_TYPES)[number]["value"]>("lease");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!text.trim()) {
      setError("Paste the document text first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const document = await api.createDocument(type, text.trim());
      navigation.navigate("ScenarioSetup", { documentId: document.id, documentType: type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add a document</Text>
      <Text style={styles.subtitle}>
        Paste the text of a lease, form, or letter. Leena will build a practice conversation around it.
      </Text>
      <Text style={styles.trustNote}>
        🔒 Only used to build your practice scenario — never shared.
      </Text>

      <Text style={styles.label}>What kind of document?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeRow}
        contentContainerStyle={styles.typeRowContent}
      >
        {DOCUMENT_TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            icon={t.icon}
            selected={type === t.value}
            onPress={() => setType(t.value)}
          />
        ))}
      </ScrollView>

      <TextField
        style={styles.textArea}
        placeholder="Paste document text here…"
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={10}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Use this document" onPress={handleSave} loading={loading} style={styles.button} />
      <Button
        label="Skip for now"
        variant="secondary"
        onPress={() => navigation.navigate("ScenarioSetup", undefined)}
        style={styles.skipButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.h1, fontSize: 22, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  trustNote: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl },
  label: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textPrimary, marginBottom: spacing.md },
  typeRow: { marginBottom: spacing.lg },
  typeRowContent: { flexDirection: "row", gap: spacing.sm },
  textArea: {
    minHeight: 180,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  button: { marginBottom: spacing.md },
  skipButton: {},
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
