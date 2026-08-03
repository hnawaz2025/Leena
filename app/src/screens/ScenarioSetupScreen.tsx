import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioSetup">;

const SUGGESTIONS = [
  { icon: "🏠", text: "Talking to my landlord about lease renewal" },
  { icon: "🚗", text: "DMV appointment for a driver's license" },
  { icon: "🩺", text: "First appointment with a new doctor" },
  { icon: "💼", text: "Job interview for an entry-level role" },
];

export function ScenarioSetupScreen({ route, navigation }: Props) {
  const documentType = route.params?.documentType;
  const [documentId, setDocumentId] = useState(route.params?.documentId);
  const [situationType, setSituationType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetLanguage = useAppStore((s) => s.targetLanguage);

  async function handleStart() {
    if (!situationType.trim()) {
      setError("Describe the situation you want to practice.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scenario = await api.createScenario(situationType.trim(), documentId);
      const session = await api.createSession(scenario.id);
      navigation.replace("Conversation", { sessionId: session.id, targetLanguage, scenarioId: scenario.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What are you preparing for?</Text>

      {documentId ? (
        <View style={styles.documentBadge}>
          <Text style={styles.documentBadgeText}>📄 Using your {documentType} document</Text>
          <Pressable onPress={() => setDocumentId(undefined)} hitSlop={8}>
            <Text style={styles.documentBadgeDismiss}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.link} onPress={() => navigation.navigate("DocumentUpload")}>
          <Text style={styles.linkText}>+ Attach a document (lease, form, letter)</Text>
        </Pressable>
      )}

      <Text style={styles.suggestionsLabel}>Pick a common situation</Text>
      <View style={styles.suggestionList}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.text}
            style={[styles.suggestion, situationType === s.text && styles.suggestionActive]}
            onPress={() => setSituationType(s.text)}
          >
            <Text style={styles.suggestionIcon}>{s.icon}</Text>
            <Text style={styles.suggestionText}>{s.text}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.suggestionsLabel}>Or describe your own</Text>
      <TextField
        style={styles.input}
        placeholder="e.g. Talking to my landlord about a lease renewal"
        value={situationType}
        onChangeText={setSituationType}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Let's rehearse this" onPress={handleStart} loading={loading} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.h1, fontSize: 22, marginBottom: spacing.lg },
  link: { marginBottom: spacing.lg },
  linkText: { ...typography.bodyBold, color: colors.primary, fontSize: 14 },
  documentBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  documentBadgeText: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.primaryDark },
  documentBadgeDismiss: { ...typography.caption, color: colors.primaryDark, fontFamily: typography.bodyBold.fontFamily, paddingLeft: spacing.md },
  suggestionsLabel: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary, marginBottom: spacing.md },
  suggestionList: { marginBottom: spacing.xl, gap: spacing.sm },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  suggestionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceWarm,
  },
  suggestionIcon: { fontSize: 18, marginRight: spacing.md },
  suggestionText: { ...typography.body, flex: 1 },
  input: {
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  button: { marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
