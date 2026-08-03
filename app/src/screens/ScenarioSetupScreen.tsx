import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Briefcase, Car, FileText, House, Plus, Stethoscope, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, radius, shadow, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioSetup">;

const SUGGESTIONS = [
  { icon: House, text: "Talking to my landlord about lease renewal" },
  { icon: Car, text: "DMV appointment for a driver's license" },
  { icon: Stethoscope, text: "First appointment with a new doctor" },
  { icon: Briefcase, text: "Job interview for an entry-level role" },
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
          <FileText size={13} color={colors.primaryDark} strokeWidth={2} />
          <Text style={styles.documentBadgeText}>Using your {documentType} document</Text>
          <Pressable onPress={() => setDocumentId(undefined)} hitSlop={8}>
            <X size={14} color={colors.primaryDark} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.link} onPress={() => navigation.navigate("DocumentUpload")}>
          <Plus size={14} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.linkText}>Attach a document (lease, form, letter)</Text>
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
            <s.icon
              size={18}
              color={situationType === s.text ? colors.primary : colors.textSecondary}
              strokeWidth={2}
              style={styles.suggestionIcon}
            />
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
  title: { ...typography.h1, marginBottom: spacing.lg },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.lg },
  linkText: { ...typography.bodyBold, color: colors.primary, fontSize: 14 },
  documentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "space-between",
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  documentBadgeText: { ...typography.caption, flex: 1, fontFamily: typography.bodyBold.fontFamily, color: colors.primaryDark },
  suggestionsLabel: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary, marginBottom: spacing.md },
  suggestionList: { marginBottom: spacing.xl, gap: spacing.sm },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.subtle,
  },
  suggestionActive: {
    backgroundColor: colors.surfaceWarm,
  },
  suggestionIcon: { marginRight: spacing.md },
  suggestionText: { ...typography.body, flex: 1 },
  input: {
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  button: { marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
