import * as Speech from "expo-speech";
import { RotateCcw, Volume2, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { toLanguageCode } from "../utils/languageCodes";
import { BreathingDot } from "./BreathingDot";
import { Button } from "./Button";
import { Card } from "./Card";
import { MicButton } from "./MicButton";
import { TextField } from "./TextField";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { colors, spacing, typography } from "../theme";

interface Suggestion {
  eventId: string;
  suggestedText: string;
}

interface HelpMeSayThisPanelProps {
  sessionId: string;
  nativeLanguage: string;
  onUse: (englishText: string) => void;
  onClose: () => void;
}

// Inline section (not a modal/screen) opened from the Conversation screen when
// the user is stuck mid-roleplay. Never creates a Turn and never calls
// chatTurn -- the persona must never see this until the user reviews the
// suggestion and explicitly sends it themselves via the normal Send button.
export function HelpMeSayThisPanel({
  sessionId,
  nativeLanguage,
  onUse,
  onClose,
}: HelpMeSayThisPanelProps) {
  const [nativeText, setNativeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const voice = useVoiceRecording();

  async function handleMicPress() {
    setError(null);
    if (voice.state === "idle") {
      await voice.startRecording();
    } else if (voice.state === "recording") {
      const text = await voice.stopRecordingAndTranscribe(toLanguageCode(nativeLanguage));
      if (text) setNativeText((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  async function handleTranslate() {
    if (!nativeText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.requestHelpPhrase(nativeText.trim(), nativeLanguage, sessionId);
      setSuggestion({ eventId: result.id, suggestedText: result.suggestedText });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleUse() {
    if (!suggestion) return;
    try {
      await api.markHelpPhraseUsed(suggestion.eventId);
    } catch {
      // Non-critical usage tracking -- don't block the user from continuing.
    }
    onUse(suggestion.suggestedText);
  }

  function handleTryAgain() {
    setSuggestion(null);
    setNativeText("");
    setError(null);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Help me say this</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      {!suggestion ? (
        <>
          <Text style={styles.hint}>Say or type it in {nativeLanguage || "your language"}</Text>
          <View style={styles.inputRow}>
            <MicButton state={voice.state} onPress={handleMicPress} disabled={loading} />
            <TextField
              style={[styles.input, styles.inputFlex]}
              placeholder="What do you want to say?"
              value={nativeText}
              onChangeText={setNativeText}
              multiline
            />
          </View>
          {voice.error ? <Text style={styles.error}>{voice.error}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? (
            <View style={styles.loadingRow}>
              <BreathingDot size={16} />
            </View>
          ) : (
            <Button
              label="Translate"
              onPress={handleTranslate}
              disabled={!nativeText.trim()}
              style={styles.button}
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionText}>{suggestion.suggestedText}</Text>
            <Pressable
              onPress={() => Speech.speak(suggestion.suggestedText, { language: "en-US" })}
              hitSlop={8}
            >
              <Volume2 size={18} color={colors.primary} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.actionsRow}>
            <Pressable style={styles.tryAgainButton} onPress={handleTryAgain}>
              <RotateCcw size={14} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.tryAgainText}>Try again</Text>
            </Pressable>
            <Button label="Use this" onPress={handleUse} style={styles.useButton} />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { ...typography.bodyBold, fontSize: 15 },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  input: { minHeight: 56, textAlignVertical: "top" },
  inputFlex: { flex: 1 },
  button: { marginTop: spacing.md },
  loadingRow: { alignItems: "center", marginTop: spacing.md },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  suggestionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 14,
    padding: spacing.lg,
  },
  suggestionText: { ...typography.body, flex: 1 },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  tryAgainButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tryAgainText: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily },
  useButton: { flex: 1 },
});
