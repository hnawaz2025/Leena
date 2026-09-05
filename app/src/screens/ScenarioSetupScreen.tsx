import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FileText, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { MicButton } from "../components/MicButton";
import { TextField } from "../components/TextField";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, radius, spacing, typography } from "../theme";
import { getSituationExample, toLanguageCode } from "../utils/languageCodes";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioSetup">;

export function ScenarioSetupScreen({ route, navigation }: Props) {
  const [documentId, setDocumentId] = useState(route.params?.documentId);
  // Held in memory only, to ground the generated scenario. The server keeps
  // no copy of it -- see the Document model.
  const documentText = route.params?.documentText;
  const [situationNative, setSituationNative] = useState("");
  // Seeded when the user escalates from a quick lookup ("practice a
  // conversation like this") so they don't retype what they just asked about.
  const [situationEnglish, setSituationEnglish] = useState(route.params?.prefillEnglish ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);

  const nativeVoice = useVoiceRecording();
  const englishVoice = useVoiceRecording();

  async function handleNativeMicPress() {
    setError(null);
    if (nativeVoice.state === "idle") {
      await nativeVoice.startRecording();
    } else if (nativeVoice.state === "recording") {
      const text = await nativeVoice.stopRecordingAndTranscribe(toLanguageCode(nativeLanguage));
      if (text) setSituationNative((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  async function handleEnglishMicPress() {
    setError(null);
    if (englishVoice.state === "idle") {
      await englishVoice.startRecording();
    } else if (englishVoice.state === "recording") {
      const text = await englishVoice.stopRecordingAndTranscribe("en");
      if (text) setSituationEnglish((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  async function handleStart() {
    if (!situationNative.trim() && !situationEnglish.trim()) {
      setError("Please write what you want to practice. You can use either language.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Give the AI both versions when available -- it grounds the scenario
      // in whichever is clearer, and it's the same native-language-first
      // bridging the rest of the app is built around.
      const situationType = [
        situationNative.trim() ? `In ${nativeLanguage}: ${situationNative.trim()}` : null,
        situationEnglish.trim() ? `In English: ${situationEnglish.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const scenario = await api.createScenario(situationType, documentId, documentText);
      await api.createSession(scenario.id);
      navigation.replace("Conversation", { scenarioId: scenario.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not build your practice. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What do you need to talk about?</Text>

      {documentId ? (
        <View style={styles.documentBadge}>
          <FileText size={13} color={colors.primaryDark} strokeWidth={2} />
          <Text style={styles.documentBadgeText}>Using your attached document</Text>
          <Pressable onPress={() => setDocumentId(undefined)} hitSlop={8}>
            <X size={14} color={colors.primaryDark} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.link} onPress={() => navigation.navigate("DocumentUpload")}>
          <Plus size={14} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.linkText}>Attach a document</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Describe your situation in {nativeLanguage || "your language"}</Text>
      <View style={styles.inputRow}>
        <MicButton state={nativeVoice.state} onPress={handleNativeMicPress} disabled={loading} />
        <TextField
          style={[styles.input, styles.inputFlex]}
          placeholder={getSituationExample(nativeLanguage)}
          value={situationNative}
          onChangeText={setSituationNative}
          multiline
        />
      </View>
      {nativeVoice.error ? <Text style={styles.error}>{nativeVoice.error}</Text> : null}

      <Text style={styles.label}>Describe it in English</Text>
      <View style={styles.inputRow}>
        <MicButton state={englishVoice.state} onPress={handleEnglishMicPress} disabled={loading} />
        <TextField
          style={[styles.input, styles.inputFlex]}
          placeholder="e.g. Talking to my landlord about a lease renewal"
          value={situationEnglish}
          onChangeText={setSituationEnglish}
          multiline
        />
      </View>
      {englishVoice.error ? <Text style={styles.error}>{englishVoice.error}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Start practising" onPress={handleStart} loading={loading} style={styles.button} />
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
  label: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary, marginBottom: spacing.md },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.xs },
  input: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  inputFlex: { flex: 1 },
  button: { marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.lg },
});
