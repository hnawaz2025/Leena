import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Drama, Languages, Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ScenarioSessionSummaryDTO, TurnDTO } from "@leena/shared";
import { api } from "../api/client";
import { AttemptDivider } from "../components/AttemptDivider";
import { BreathingDot } from "../components/BreathingDot";
import { Card } from "../components/Card";
import { ChatBubble } from "../components/ChatBubble";
import { Chip } from "../components/Chip";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { HelpMeSayThisPanel } from "../components/HelpMeSayThisPanel";
import { MicButton } from "../components/MicButton";
import { ScenarioInfoModal } from "../components/ScenarioInfoModal";
import { TextField } from "../components/TextField";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, gradients, spacing, typography } from "../theme";
import { relativeDate } from "../utils/relativeDate";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

type ThreadItem =
  | { type: "collapsed"; session: ScenarioSessionSummaryDTO }
  | { type: "divider"; attemptNumber: number }
  | { type: "turn"; turn: TurnDTO };

function threadItemKey(item: ThreadItem): string {
  if (item.type === "collapsed") return `collapsed-${item.session.id}`;
  if (item.type === "divider") return `divider-${item.attemptNumber}`;
  return `turn-${item.turn.id}`;
}

// Scenario-scoped, not session-scoped: "Practice this again" creates a new
// Session per attempt, and this screen stitches every attempt for the
// scenario into one continuous thread (divider between attempts, older
// attempts collapsed) rather than navigating to a fresh screen each time.
// Turn-based voice loop within the live attempt: tap the mic to record, tap
// again to stop -> Whisper transcribes it into the text input for review ->
// send as normal -> the agent's reply is read aloud with on-device TTS.
export function ConversationScreen({ route, navigation }: Props) {
  // Same fix as Home: KeyboardAvoidingView measures from below the nav
  // header, so "padding" behavior overshoots by exactly the header's height
  // without this offset, leaving the input hidden behind the keyboard.
  const headerHeight = useHeaderHeight();
  const { scenarioId } = route.params;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [startingAgain, setStartingAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  // Whether what's currently in the box came from the help panel. Tracked here
  // rather than inferred server-side from the text, because the user can edit a
  // suggestion before sending and we must not later credit them for it.
  const [inputCameFromHelp, setInputCameFromHelp] = useState(false);
  const [tab, setTab] = useState<"chat" | "feedback">("chat");
  const [infoOpen, setInfoOpen] = useState(false);
  const [expandedTurnsBySessionId, setExpandedTurnsBySessionId] = useState<Record<string, TurnDTO[]>>({});
  const voice = useVoiceRecording();
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const listRef = useRef<FlatList<ThreadItem>>(null);

  // The persona keeps talking otherwise. Speech.stop() was only called when
  // ending a session, so navigating back mid-sentence left the voice playing
  // over whatever screen came next.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const { data: scenario } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => api.getScenario(scenarioId),
  });

  const { data: sessions } = useQuery({
    queryKey: ["scenario-sessions", scenarioId],
    queryFn: () => api.listScenarioSessions(scenarioId),
  });

  // Defensive only -- ScenarioSetupScreen always creates the first session
  // immediately after creating the scenario, so this shouldn't normally fire.
  useEffect(() => {
    if (sessions && sessions.length === 0) {
      api.createSession(scenarioId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["scenario-sessions", scenarioId] });
      });
    }
  }, [sessions, scenarioId, queryClient]);

  const currentSession = sessions && sessions.length > 0 ? sessions[sessions.length - 1] : undefined;
  const pastSessions = sessions && sessions.length > 1 ? sessions.slice(0, -1) : [];
  const completedSessions = sessions?.filter((s) => s.status === "completed") ?? [];
  const latestCompletedSession = completedSessions[completedSessions.length - 1];

  const { data: currentTurns, refetch: refetchCurrentTurns } = useQuery({
    queryKey: ["turns", currentSession?.id],
    queryFn: () => api.listTurns(currentSession!.id),
    enabled: !!currentSession,
  });

  async function handleExpand(session: ScenarioSessionSummaryDTO) {
    if (expandedTurnsBySessionId[session.id]) return;
    const turns = await api.listTurns(session.id);
    setExpandedTurnsBySessionId((prev) => ({ ...prev, [session.id]: turns }));
  }

  async function handleMicPress() {
    setError(null);
    if (voice.state === "idle") {
      await voice.startRecording();
    } else if (voice.state === "recording") {
      const text = await voice.stopRecordingAndTranscribe("en");
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  async function handleSend() {
    if (!input.trim() || !currentSession || !scenario) return;
    setSending(true);
    setError(null);
    const text = input.trim();
    const aided = inputCameFromHelp;
    setInput("");
    setInputCameFromHelp(false);
    try {
      await api.sendTurn(currentSession.id, text, scenario.language, aided);
      const { data: updatedTurns } = await refetchCurrentTurns();
      const lastTurn = updatedTurns?.[updatedTurns.length - 1];
      if (lastTurn?.speaker === "agent") {
        Speech.speak(lastTurn.text, { language: "en-US" });
      }
    } catch (e) {
      // Put their sentence back. Clearing the box before the request meant a
      // dropped connection silently deleted something they had just worked
      // hard to compose -- the most demoralising thing this app could do to
      // someone already unsure of their English.
      setInput(text);
      setInputCameFromHelp(aided);
      setError(e instanceof Error ? e.message : "Your message did not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    if (!currentSession) return;
    Speech.stop();
    setEnding(true);
    setError(null);
    try {
      await api.endSession(currentSession.id);
      await queryClient.invalidateQueries({ queryKey: ["scenario-sessions", scenarioId] });
      setTab("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setEnding(false);
    }
  }

  async function handlePracticeAgain() {
    setStartingAgain(true);
    setError(null);
    try {
      await api.createSession(scenarioId);
      await queryClient.invalidateQueries({ queryKey: ["scenario-sessions", scenarioId] });
      setTab("chat");
    } catch (e) {
      // Was a bare try/finally, unlike its siblings -- so a failure here threw
      // an unhandled rejection and the button just appeared to do nothing.
      setError(e instanceof Error ? e.message : "We could not start a new practice. Please try again.");
    } finally {
      setStartingAgain(false);
    }
  }

  const isRecording = voice.state === "recording";
  const isCurrentActive = currentSession?.status === "active";

  const threadItems: ThreadItem[] = [
    ...pastSessions.flatMap((session): ThreadItem[] => {
      const expanded = expandedTurnsBySessionId[session.id];
      if (!expanded) return [{ type: "collapsed", session }];
      return [
        { type: "divider", attemptNumber: session.attemptNumber },
        ...expanded.map((turn): ThreadItem => ({ type: "turn", turn })),
      ];
    }),
    ...(currentSession
      ? [
          ...(sessions && sessions.length > 1
            ? [{ type: "divider" as const, attemptNumber: currentSession.attemptNumber }]
            : []),
          ...(currentTurns ?? []).map((turn): ThreadItem => ({ type: "turn", turn })),
        ]
      : []),
  ];

  // onContentSizeChange alone fires while the incoming bubble is still being
  // laid out, so a long reply scrolls to where the list *was* and lands below
  // the fold. Re-running it on the next frame, once the thread length or the
  // pending-reply footer has actually changed, catches the settled size.
  useEffect(() => {
    if (threadItems.length === 0) return;
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );
    return () => cancelAnimationFrame(frame);
  }, [threadItems.length, sending]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      {scenario ? (
        <Pressable onPress={() => setInfoOpen(true)}>
          <View style={styles.personaHeader}>
            <LinearGradient
              colors={gradients.secondary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.personaAvatar}
            >
              {/* Dark on amber, not white: white on #FF8C1A is 2.33:1 and on
                  the gradient's top stop only 1.80:1. This is 8.0:1. */}
              <Drama size={18} color={colors.textPrimary} strokeWidth={2.5} />
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
        </Pressable>
      ) : null}

      {scenario ? (
        <ScenarioInfoModal
          visible={infoOpen}
          scenario={scenario}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}

      {latestCompletedSession ? (
        <View style={styles.tabRow}>
          <Chip label="Chat" selected={tab === "chat"} onPress={() => setTab("chat")} />
          <Chip label="Feedback" selected={tab === "feedback"} onPress={() => setTab("feedback")} />
        </View>
      ) : null}

      {tab === "feedback" && latestCompletedSession ? (
        <FeedbackPanel
          sessionId={latestCompletedSession.id}
          onPracticeAgain={handlePracticeAgain}
          onBackHome={() => navigation.popToTop()}
          practiceAgainLoading={startingAgain}
        />
      ) : (
        <>
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={threadItems}
            keyExtractor={threadItemKey}
            // Every reply used to land below the fold, so the user scrolled by
            // hand after each turn -- the single most repeated interaction in
            // the app. Keyed off content size rather than the data array
            // because the reply's height isn't known until it has rendered.
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              if (item.type === "collapsed") {
                return (
                  <Pressable onPress={() => handleExpand(item.session)}>
                    <Card style={styles.collapsedCard}>
                      <View style={styles.collapsedRow}>
                        <Text style={styles.collapsedText}>
                          Practice {item.session.attemptNumber} · {relativeDate(item.session.startedAt)} ·{" "}
                          {item.session.turnCount} message{item.session.turnCount === 1 ? "" : "s"}
                        </Text>
                        <ChevronRight size={14} color={colors.textMuted} strokeWidth={2} />
                      </View>
                    </Card>
                  </Pressable>
                );
              }
              if (item.type === "divider") {
                return <AttemptDivider attemptNumber={item.attemptNumber} />;
              }
              return <ChatBubble text={item.turn.text} speaker={item.turn.speaker} />;
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>Say something to start the conversation.</Text>
            }
            ListFooterComponent={sending ? <BreathingDot /> : null}
          />

          {isRecording ? <Text style={styles.listeningNote}>Listening. Tap the microphone when you finish.</Text> : null}
          {(error || voice.error) ? <Text style={styles.error}>{error || voice.error}</Text> : null}

          {isCurrentActive ? (
            <>
              {helpPanelOpen ? (
                <HelpMeSayThisPanel
                  sessionId={currentSession!.id}
                  nativeLanguage={nativeLanguage}
                  onUse={(englishText) => {
                    setInput((prev) => (prev ? `${prev} ${englishText}` : englishText));
                    setInputCameFromHelp(true);
                    setHelpPanelOpen(false);
                  }}
                  onClose={() => setHelpPanelOpen(false)}
                />
              ) : (
                <Pressable style={styles.helpButton} onPress={() => setHelpPanelOpen(true)}>
                  <Languages size={14} color={colors.primary} strokeWidth={2.5} />
                  <Text style={styles.helpButtonText}>Stuck? Help me say this</Text>
                </Pressable>
              )}

              <View style={styles.inputRow}>
                <MicButton state={voice.state} onPress={handleMicPress} disabled={sending} />
                <TextField
                  style={styles.input}
                  placeholder={`Type or speak in ${scenario?.language ?? "English"}…`}
                  multiline
                  autoGrow
                  value={input}
                  onChangeText={(next) => {
                    setInput(next);
                    // Emptying the box discards the suggestion, so whatever
                    // they type next is their own again.
                    if (!next.trim()) setInputCameFromHelp(false);
                  }}
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
            </>
          ) : currentSession ? (
            <Pressable
              style={styles.practiceAgainButton}
              onPress={handlePracticeAgain}
              disabled={startingAgain}
            >
              <Text style={styles.practiceAgainText}>
                {startingAgain ? "Starting…" : "Practice this again"}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
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
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: { flex: 1 },
  listContent: { padding: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxxl },
  collapsedCard: { marginBottom: spacing.sm },
  collapsedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collapsedText: { ...typography.caption, flex: 1 },
  listeningNote: {
    ...typography.caption,
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  helpButtonText: { ...typography.caption, color: colors.primary, fontFamily: typography.bodyBold.fontFamily },
  inputRow: {
    flexDirection: "row",
    // flex-end, not center: once the text box grows to several lines the mic
    // and send buttons should stay level with the last line, not float in the
    // middle of a tall box.
    alignItems: "flex-end",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
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
  practiceAgainButton: {
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  practiceAgainText: { ...typography.bodyBold, color: colors.primary },
  error: { ...typography.caption, color: colors.error, textAlign: "center", marginTop: spacing.sm },
});
