import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { FeedbackReportDTO } from "@leena/shared";
import { api } from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { colors, fontFamily, radius, spacing, typography } from "../theme";
import { BreathingDot } from "./BreathingDot";
import { Button } from "./Button";
import { Card } from "./Card";
import { Chip } from "./Chip";

interface FeedbackPanelProps {
  sessionId: string;
  onPracticeAgain: () => void;
  onBackHome: () => void;
  practiceAgainLoading?: boolean;
}

// The analysis runs in the background now, so GET /feedback 404s until it
// lands. These retries ARE the polling: react-query keeps the query in its
// loading state while retrying, so the waiting screen stays up. 30 attempts
// two seconds apart covers a minute, against a job that normally finishes in
// under thirty seconds.
const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

// A single frozen "Analyzing…" for thirty seconds reads as a crash. The
// message advancing is what proves the app is still alive -- the text is the
// progress bar. Written for someone reading English as a second language:
// short sentences, no idioms, and an explicit instruction at the point where
// people start wondering whether they should close the app.
const WAIT_MESSAGES: { after: number; text: string }[] = [
  { after: 0, text: "Reading your conversation…" },
  { after: 6, text: "Looking at what you said well…" },
  { after: 14, text: "Writing your feedback…" },
  { after: 22, text: "Almost done. Please keep the app open." },
  { after: 40, text: "This is taking longer than usual. Still working…" },
];

function messageFor(seconds: number): string {
  return [...WAIT_MESSAGES].reverse().find((m) => seconds >= m.after)!.text;
}

// The coaching payoff for one completed attempt -- bilingual toggle, a
// factual pre-real-conversation recap, struggle areas, vocab. Mounted inside
// ConversationScreen's "Feedback" tab rather than a standalone route, so
// ending a session or starting a new attempt never navigates away.
export function FeedbackPanel({
  sessionId,
  onPracticeAgain,
  onBackHome,
  practiceAgainLoading = false,
}: FeedbackPanelProps) {
  const [lang, setLang] = useState<"english" | "native">("english");
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);

  const queryClient = useQueryClient();
  const [waited, setWaited] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // Explicitly typed rather than inferred. react-query's generics are deep
  // enough that inferring this one, with refetch destructured, pushed tsc
  // past its default recursion limit and crashed the typecheck outright.
  const { data: feedback, isLoading, error, refetch } = useQuery<FeedbackReportDTO>({
    queryKey: ["feedback", sessionId],
    queryFn: () => api.getFeedback(sessionId),
    retry: POLL_ATTEMPTS,
    retryDelay: POLL_INTERVAL_MS,
  });

  // Drives the advancing wait message. Stops as soon as there's something to
  // show, so it isn't left ticking behind the report.
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setWaited((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Re-runs the analysis. Safe to call: POST /:id/end returns early when a
  // report already exists, and regenerates when the session is complete but
  // the report is missing -- which is exactly the state a failure leaves.
  async function handleRetry() {
    setRetrying(true);
    setWaited(0);
    try {
      await api.endSession(sessionId);
      await queryClient.invalidateQueries({ queryKey: ["feedback", sessionId] });
      await refetch();
    } finally {
      setRetrying(false);
    }
  }

  if (isLoading || retrying) {
    return (
      <View style={styles.center}>
        <BreathingDot size={28} />
        <Text style={styles.loadingText}>{messageFor(waited)}</Text>
        <Text style={styles.loadingHint}>This usually takes about 30 seconds.</Text>
      </View>
    );
  }

  if (error || !feedback) {
    return (
      <View style={styles.center}>
        {/* Naming what survived matters more than naming what failed. After a
            long wait, a bare error reads as "your conversation is gone". */}
        <Text style={styles.loadingText}>
          We could not load your feedback. Your conversation is saved.
        </Text>
        <Button label="Try again" onPress={handleRetry} style={styles.retryButton} />
      </View>
    );
  }

  const summary = lang === "english" ? feedback.summary : feedback.summaryNative;
  const conversationSummary =
    lang === "english" ? feedback.conversationSummary : feedback.conversationSummaryNative;

  // Ticks reflect every attempt at this scenario, not just this one -- the
  // question the user is asking is "can I do this yet", not "did I do it in
  // the last ten minutes".
  const covered = new Set(feedback.cumulativeCoveredIndices);
  const newThisTime = new Set(feedback.coveredIndices);
  const items = feedback.checklist.map((item, index) => ({
    text: lang === "english" ? item.en : item.native,
    done: covered.has(index),
    isNew: newThisTime.has(index),
    index,
  }));
  const doneItems = items.filter((i) => i.done);
  const remainingItems = items.filter((i) => !i.done);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nice work. Here is what to practise next time.</Text>

      {nativeLanguage ? (
        <View style={styles.langToggleRow}>
          <Chip label="English" selected={lang === "english"} onPress={() => setLang("english")} />
          <Chip label={nativeLanguage} selected={lang === "native"} onPress={() => setLang("native")} />
        </View>
      ) : null}

      <Card accentColor={colors.secondary} style={styles.recapCard}>
        <Text style={styles.recapLabel}>Remember this for the real conversation</Text>
        <Text style={styles.recapText}>{conversationSummary}</Text>
      </Card>

      <Text style={styles.summary}>{summary}</Text>

      {items.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            You can handle {doneItems.length} of {items.length} things that come up
          </Text>
          {doneItems.map((item) => (
            <View key={item.index} style={styles.checkRow}>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={2.5} />
              <Text style={styles.checkDone}>{item.text}</Text>
              {item.isNew ? <Text style={styles.newBadge}>new</Text> : null}
            </View>
          ))}

          {remainingItems.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Practice these next time</Text>
              {remainingItems.map((item) => (
                <View key={item.index} style={styles.checkRow}>
                  <Circle size={16} color={colors.textMuted} strokeWidth={2} />
                  <Text style={styles.checkTodo}>{item.text}</Text>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <View style={styles.statStrip}>
        <Text style={styles.statText}>
          {feedback.vocabularySuggestions.length} vocabulary tip
          {feedback.vocabularySuggestions.length === 1 ? "" : "s"}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>New words to learn</Text>
      {feedback.vocabularySuggestions.map((v, i) => (
        <View key={i} style={styles.vocabItem}>
          <Text style={styles.vocabTerm}>{v.term}</Text>
          <Text style={styles.vocabNote}>{lang === "english" ? v.note : v.noteNative}</Text>
        </View>
      ))}

      <Button
        label={remainingItems.length > 0 ? "Practice these" : "Practice this again"}
        onPress={onPracticeAgain}
        loading={practiceAgainLoading}
        style={styles.primaryButton}
      />
      <Button label="Back to home" variant="secondary" onPress={onBackHome} style={styles.secondaryButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  loadingHint: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  retryButton: { marginTop: spacing.xl, alignSelf: "stretch" },
  title: { ...typography.h1, marginBottom: spacing.md },
  langToggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  recapCard: { marginBottom: spacing.lg },
  recapLabel: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  recapText: { ...typography.body },
  summary: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  statStrip: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl, gap: spacing.sm },
  statText: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.primaryDark },
  sectionTitle: { ...typography.h2, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.md },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkDone: { ...typography.body, flex: 1 },
  checkTodo: { ...typography.body, flex: 1, color: colors.textSecondary },
  newBadge: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.success,
    textTransform: "uppercase",
    fontSize: 10,
    marginTop: 2,
  },
  vocabItem: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  vocabTerm: { ...typography.h2, fontFamily: fontFamily.headingSemiBold, fontSize: 15, marginBottom: spacing.xs },
  vocabNote: { ...typography.caption },
  primaryButton: { marginTop: spacing.xl, marginBottom: spacing.md },
  secondaryButton: {},
});
