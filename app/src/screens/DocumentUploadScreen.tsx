import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Briefcase, FileText, House, Lock, Stethoscope } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DocumentUpload">;

const DOCUMENT_TYPES = [
  { value: "lease", label: "Lease", icon: House },
  { value: "medical", label: "Medical", icon: Stethoscope },
  { value: "job-letter", label: "Job letter", icon: Briefcase },
  { value: "other", label: "Other", icon: FileText },
] as const;

// MVP: the user pastes the document text directly. Camera capture + on-device
// OCR is planned for the document-upload milestone; this screen already
// produces the same downstream shape (a Document row with extractedText) so
// swapping in OCR later doesn't change anything past this screen.
export function DocumentUploadScreen({ navigation }: Props) {
  const [type, setType] = useState<(typeof DOCUMENT_TYPES)[number]["value"]>("lease");
  const [text, setText] = useState("");
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<"scenario" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureSaved(): Promise<string> {
    if (savedDocumentId) return savedDocumentId;
    const document = await api.createDocument(type, text.trim());
    setSavedDocumentId(document.id);
    return document.id;
  }

  async function handleUseForScenario() {
    if (!text.trim()) {
      setError("Paste the document text first.");
      return;
    }
    setLoading("scenario");
    setError(null);
    try {
      const documentId = await ensureSaved();
      navigation.navigate("ScenarioSetup", { documentId, documentType: type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleExplainInstead() {
    if (!text.trim()) {
      setError("Paste the document text first.");
      return;
    }
    setLoading("explain");
    setError(null);
    try {
      const documentId = await ensureSaved();
      navigation.navigate("DocumentExplanation", { documentId, documentType: type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add a document</Text>
      <Text style={styles.subtitle}>
        Paste the text of a lease, form, or letter — to practice a conversation about it, or just
        have it explained in plain language.
      </Text>
      <View style={styles.trustNoteRow}>
        <Lock size={13} color={colors.textMuted} strokeWidth={2} />
        <Text style={styles.trustNote}>Only used for what you ask below — never shared.</Text>
      </View>

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

      <Button
        label="Practice a conversation about it"
        onPress={handleUseForScenario}
        loading={loading === "scenario"}
        disabled={loading === "explain"}
        style={styles.button}
      />
      <Button
        label="Just explain it to me"
        variant="secondary"
        onPress={handleExplainInstead}
        loading={loading === "explain"}
        disabled={loading === "scenario"}
        style={styles.button}
      />
      <Button
        label="Skip for now"
        variant="secondary"
        onPress={() => navigation.navigate("ScenarioSetup", undefined)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.h1, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  trustNoteRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xl },
  trustNote: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textPrimary, marginBottom: spacing.md },
  typeRow: { marginBottom: spacing.lg },
  typeRowContent: { flexDirection: "row", gap: spacing.sm },
  textArea: {
    minHeight: 180,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  button: { marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
