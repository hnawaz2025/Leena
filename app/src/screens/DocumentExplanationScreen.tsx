import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CircleAlert } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DocumentExplanation">;

// Standalone from the roleplay flow: some users just want to understand a
// confusing document, not rehearse a conversation about it.
export function DocumentExplanationScreen({ route, navigation }: Props) {
  const { documentId } = route.params;

  const { data: explanation, isLoading, error } = useQuery({
    queryKey: ["documentExplanation", documentId],
    queryFn: () => api.explainDocument(documentId),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <BreathingDot size={28} />
        <Text style={styles.loadingText}>Reading your document…</Text>
      </View>
    );
  }

  if (error || !explanation) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Couldn't explain this document. Try again shortly.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Here's what this means</Text>
      <Text style={styles.summary}>{explanation.summary}</Text>

      {explanation.actionItems.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CircleAlert size={16} color={colors.warning} strokeWidth={2} />
            <Text style={styles.sectionTitle}>What you need to do</Text>
          </View>
          {explanation.actionItems.map((item, i) => (
            <Card key={i} accentColor={colors.warning} style={styles.actionCard}>
              <Text style={styles.actionText}>{item}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <BookOpen size={16} color={colors.secondary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Confusing terms, explained</Text>
        </View>
        {explanation.keyTerms.map((kt, i) => (
          <View key={i} style={styles.termItem}>
            <Text style={styles.termName}>{kt.term}</Text>
            <Text style={styles.termDefinition}>{kt.definition}</Text>
          </View>
        ))}
      </View>

      <Button label="Back to home" variant="secondary" onPress={() => navigation.popToTop()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  title: { ...typography.h1, marginBottom: spacing.md },
  summary: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { ...typography.h2, fontSize: 16 },
  actionCard: { marginBottom: spacing.sm },
  actionText: { ...typography.body },
  termItem: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  termName: { ...typography.bodyBold, fontSize: 15, marginBottom: spacing.xs },
  termDefinition: { ...typography.caption },
});
