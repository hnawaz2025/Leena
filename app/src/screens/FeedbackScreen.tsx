import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, fontFamily, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Feedback">;

export function FeedbackScreen({ route, navigation }: Props) {
  const { sessionId, scenarioId } = route.params;
  const [startingAgain, setStartingAgain] = useState(false);
  const targetLanguage = useAppStore((s) => s.targetLanguage);

  const { data: feedback, isLoading, error } = useQuery({
    queryKey: ["feedback", sessionId],
    queryFn: () => api.getFeedback(sessionId),
    retry: 3,
    retryDelay: 1500,
  });

  async function handlePracticeAgain() {
    setStartingAgain(true);
    try {
      const session = await api.createSession(scenarioId);
      navigation.replace("Conversation", { sessionId: session.id, targetLanguage, scenarioId });
    } finally {
      setStartingAgain(false);
    }
  }

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nice work — here's what to sharpen</Text>
      <Text style={styles.summary}>{feedback.summary}</Text>

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
      {feedback.struggleAreas.map((area, i) => (
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
        label="Practice this again"
        onPress={handlePracticeAgain}
        loading={startingAgain}
        style={styles.primaryButton}
      />
      <Button
        label="Back to home"
        variant="secondary"
        onPress={() => navigation.popToTop()}
        style={styles.secondaryButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  title: { ...typography.h1, marginBottom: spacing.md },
  summary: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  statStrip: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl, gap: spacing.sm },
  statText: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.primaryDark },
  statDivider: { ...typography.caption, color: colors.textMuted },
  sectionTitle: { ...typography.h2, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.md },
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
