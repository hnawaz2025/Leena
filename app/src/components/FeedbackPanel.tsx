import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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

  const { data: feedback, isLoading, error } = useQuery({
    queryKey: ["feedback", sessionId],
    queryFn: () => api.getFeedback(sessionId),
    retry: 3,
    retryDelay: 1500,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <BreathingDot size={28} />
        <Text style={styles.loadingText}>Analyzing your conversation…</Text>
      </View>
    );
  }

  if (error || !feedback) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Feedback isn't ready yet. Pull to try again shortly.</Text>
      </View>
    );
  }

  const summary = lang === "english" ? feedback.summary : feedback.summaryNative;
  const struggleAreas = lang === "english" ? feedback.struggleAreas : feedback.struggleAreasNative;
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
      <Text style={styles.title}>Nice work — here's what to sharpen</Text>

      {nativeLanguage ? (
        <View style={styles.langToggleRow}>
          <Chip label="English" selected={lang === "english"} onPress={() => setLang("english")} />
          <Chip label={nativeLanguage} selected={lang === "native"} onPress={() => setLang("native")} />
        </View>
      ) : null}

      <Card accentColor={colors.secondary} style={styles.recapCard}>
        <Text style={styles.recapLabel}>Before your real conversation</Text>
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
              <Text style={styles.sectionTitle}>Also worth practising</Text>
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
          {feedback.struggleAreas.length} area{feedback.struggleAreas.length === 1 ? "" : "s"} to work on
        </Text>
        <Text style={styles.statDivider}>•</Text>
        <Text style={styles.statText}>
          {feedback.vocabularySuggestions.length} vocabulary tip
          {feedback.vocabularySuggestions.length === 1 ? "" : "s"}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Where you struggled</Text>
      {struggleAreas.map((area, i) => (
        <Card key={i} accentColor={colors.warning} style={styles.struggleCard}>
          <Text style={styles.struggleText}>{area}</Text>
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Vocabulary to learn</Text>
      {feedback.vocabularySuggestions.map((v, i) => (
        <View key={i} style={styles.vocabItem}>
          <Text style={styles.vocabTerm}>{v.term}</Text>
          <Text style={styles.vocabNote}>{v.note}</Text>
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
  statDivider: { ...typography.caption, color: colors.textMuted },
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
  struggleCard: { marginBottom: spacing.sm },
  struggleText: { ...typography.body },
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
