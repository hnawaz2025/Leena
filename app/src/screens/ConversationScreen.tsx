import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import { Drama, Mic, Send, Square } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { ChatBubble } from "../components/ChatBubble";
import { TextField } from "../components/TextField";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import type { RootStackParamList } from "../navigation/types";
import { colors, gradients, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

// Turn-based voice loop: tap the mic to record, tap again to stop -> Whisper
// transcribes it into the text input for review -> send as normal -> the
// agent's reply is read aloud with on-device TTS (expo-speech, free, no
// API cost) so the practice actually feels spoken, not just typed.
export function ConversationScreen({ route, navigation }: Props) {
  const { sessionId, targetLanguage, scenarioId } = route.params;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceRecording();

  const { data: scenario } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => api.getScenario(scenarioId),
  });

  const { data: turns, refetch } = useQuery({
    queryKey: ["turns", sessionId],
    queryFn: () => api.listTurns(sessionId),
  });

  async function handleMicPress() {
    setError(null);
    if (voice.state === "idle") {
      await voice.startRecording();
    } else if (voice.state === "recording") {
      const text = await voice.stopRecordingAndTranscribe();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    setSending(true);
    setError(null);
    const text = input.trim();
    setInput("");
    try {
      await api.sendTurn(sessionId, text, targetLanguage);
      const { data: updatedTurns } = await refetch();
      const lastTurn = updatedTurns?.[updatedTurns.length - 1];
      if (lastTurn?.speaker === "agent") {
        Speech.speak(lastTurn.text, { language: "en-US" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    Speech.stop();
    setEnding(true);
    setError(null);
    try {
      await api.endSession(sessionId);
      navigation.replace("Feedback", { sessionId, scenarioId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setEnding(false);
    }
  }

  const isRecording = voice.state === "recording";
  const isTranscribing = voice.state === "transcribing";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scenario ? (
        <View style={styles.personaHeader}>
          <LinearGradient
            colors={gradients.secondary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.personaAvatar}
          >
            <Drama size={18} color={colors.white} strokeWidth={2} />
          </LinearGradient>
          <View style={styles.personaTextGroup}>
            <Text style={styles.personaTitle} numberOfLines={1}>
              {scenario.title}
            </Text>
            <Text style={styles.personaSubtitle} numberOfLines={1}>
              {scenario.personaDescription}
            </Text>
          </View>
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={turns ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble text={item.text} speaker={item.speaker} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Say something to start the conversation.</Text>
        }
        ListFooterComponent={sending ? <BreathingDot /> : null}
      />

      {isRecording ? <Text style={styles.listeningNote}>Listening…</Text> : null}
      {(error || voice.error) ? <Text style={styles.error}>{error || voice.error}</Text> : null}

      <View style={styles.inputRow}>
        <Pressable
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={handleMicPress}
          disabled={isTranscribing || sending}
        >
          {isTranscribing ? (
            <BreathingDot size={16} />
          ) : isRecording ? (
            <Square size={16} color={colors.white} strokeWidth={2} fill={colors.white} />
          ) : (
            <Mic size={18} color={colors.textSecondary} strokeWidth={2} />
          )}
        </Pressable>
        <TextField
          style={styles.input}
          placeholder={`Type or speak in ${targetLanguage}…`}
          value={input}
          onChangeText={setInput}
          editable={!sending}
        />
        <Pressable onPress={handleSend} disabled={sending || !input.trim()}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sendButton, (sending || !input.trim()) && styles.sendButtonDisabled]}
          >
            <Send size={18} color={colors.white} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable style={styles.endButton} onPress={handleEnd} disabled={ending}>
        <Text style={styles.endButtonText}>
          {ending ? "Wrapping up…" : "End conversation & get feedback"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  personaHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  personaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  personaTextGroup: { flex: 1 },
  personaTitle: { ...typography.h2, fontSize: 15 },
  personaSubtitle: { ...typography.caption },
  list: { flex: 1 },
  listContent: { padding: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxxl },
  listeningNote: {
    ...typography.caption,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  micButtonActive: {
    backgroundColor: colors.error,
  },
  input: { flex: 1 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.4 },
  endButton: { paddingVertical: spacing.md, alignItems: "center" },
  endButtonText: { ...typography.caption, color: colors.textSecondary, fontFamily: typography.bodyBold.fontFamily },
  error: { ...typography.caption, color: colors.error, textAlign: "center", marginTop: spacing.sm },
});
