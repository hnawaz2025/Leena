import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import {
  CheckCircle2,
  LineChart,
  ListChecks,
  MessageCircleQuestion,
  RefreshCw,
  Volume2,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  CoverageEvidenceDTO,
  IndependenceEvidenceDTO,
  MetricDTO,
  RecoveryEvidenceDTO,
} from "@leena/shared";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "YourEnglish">;

function Hero({
  label,
  metric,
  explainer,
}: {
  label: string;
  metric: MetricDTO<unknown>;
  explainer: string;
}) {
  const delta = metric.previous === null ? null : metric.value - metric.previous;
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{label}</Text>
        <Text style={styles.heroValue}>{metric.value}</Text>
        <Text style={styles.heroBand}>{metric.bandLabel}</Text>
        {delta !== null ? (
          <Text style={styles.heroTrend}>
            {delta > 0 ? "up" : delta < 0 ? "down" : "same as"} {delta !== 0 ? Math.abs(delta) : ""}{" "}
            from before
          </Text>
        ) : null}
      </View>
      <Text style={styles.explainer}>{explainer}</Text>
    </>
  );
}

function IndependenceDetail({ metric }: { metric: MetricDTO<IndependenceEvidenceDTO> }) {
  const { strugglePhrases, bestUnaidedTurn } = metric.evidence;

  return (
    <>
      <Hero
        label="Independence"
        metric={metric}
        explainer="How much of your conversations you got through without asking for help."
      />

      {bestUnaidedTurn ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.cardLabel}>You said this on your own</Text>
          </View>
          <Text style={styles.quote}>"{bestUnaidedTurn}"</Text>
          <Pressable
            style={styles.speakRow}
            onPress={() => Speech.speak(bestUnaidedTurn, { language: "en-US" })}
          >
            <Volume2 size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.speakText}>Hear it</Text>
          </Pressable>
        </View>
      ) : null}

      {strugglePhrases.length ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <RefreshCw size={14} color={colors.secondary} strokeWidth={2.5} />
            <Text style={styles.cardLabel}>You keep needing these</Text>
          </View>
          {strugglePhrases.map((p) => (
            <Text key={p.phrase} style={styles.strugglePhrase}>
              "{p.phrase}"{p.count > 1 ? ` · ${p.count}×` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

function RecoveryDetail({ metric }: { metric: MetricDTO<RecoveryEvidenceDTO> }) {
  const { moments, rescuePhrase } = metric.evidence;

  return (
    <>
      <View style={styles.divider} />
      <Hero
        label="Recovery"
        metric={metric}
        explainer="When they asked you something, how often you answered instead of just saying okay."
      />

      {moments.length ? (
        moments.map((m, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <MessageCircleQuestion size={14} color={colors.warning} strokeWidth={2.5} />
              <Text style={styles.cardLabel}>When you didn't understand</Text>
            </View>
            <Text style={styles.exchangeSpeaker}>They asked</Text>
            <Text style={styles.quote}>"{m.question}"</Text>
            <Text style={styles.exchangeSpeaker}>You said</Text>
            <Text style={styles.quote}>"{m.reply}"</Text>
            <Text style={styles.tryLine}>Try: "{rescuePhrase}"</Text>
            <Pressable
              style={styles.speakRow}
              onPress={() => Speech.speak(rescuePhrase, { language: "en-US" })}
            >
              <Volume2 size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.speakText}>Hear it</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.cardLabel}>Nothing to flag</Text>
          </View>
          <Text style={styles.quote}>
            Every time they asked you something, you answered it. That's the hard part.
          </Text>
        </View>
      )}
    </>
  );
}

function CoverageDetail({ metric }: { metric: MetricDTO<CoverageEvidenceDTO> }) {
  const { scenarios } = metric.evidence;

  return (
    <>
      <View style={styles.divider} />
      <Hero
        label="Coverage"
        metric={metric}
        explainer="How many of your recent conversations you're actually ready for."
      />

      {scenarios.map((s) => (
        <View key={s.scenarioId} style={styles.card}>
          <View style={styles.cardHeader}>
            {s.band === "high" ? (
              <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
            ) : (
              <ListChecks size={14} color={colors.secondary} strokeWidth={2.5} />
            )}
            <Text style={styles.cardLabel}>{s.scenarioTitle}</Text>
          </View>
          <Text style={styles.coverageRatio}>
            {s.covered} / {s.total} · {s.bandLabel}
          </Text>
          {s.remaining.length ? (
            s.remaining.map((item) => (
              <Text key={item} style={styles.strugglePhrase}>
                ○ {item}
              </Text>
            ))
          ) : (
            <Text style={styles.quote}>Nothing left to practise here.</Text>
          )}
        </View>
      ))}
    </>
  );
}

// The depth behind the numbers on Home. Everything here is the user's own
// words rather than a description of their behaviour -- shorter to read and
// much harder to argue with.
export function YourEnglishScreen({}: Props) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: api.getMetrics,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <BreathingDot size={24} />
      </View>
    );
  }

  if (!metrics?.ready || (!metrics.independence && !metrics.recovery && !metrics.coverage)) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={LineChart}
          message="Practise a couple more conversations and your progress will show up here."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {metrics.independence ? <IndependenceDetail metric={metrics.independence} /> : null}
      {metrics.recovery ? <RecoveryDetail metric={metrics.recovery} /> : null}
      {metrics.coverage ? <CoverageDetail metric={metrics.coverage} /> : null}
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
  hero: { alignItems: "center", marginBottom: spacing.lg },
  heroLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  heroValue: { ...typography.display, fontSize: 64, lineHeight: 72, color: colors.primaryDark },
  heroBand: { ...typography.h2, fontSize: 16 },
  heroTrend: { ...typography.caption, marginTop: spacing.xs },
  explainer: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  cardLabel: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  quote: { ...typography.body, fontStyle: "italic" },
  speakRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  speakText: { ...typography.caption, color: colors.primary, fontFamily: typography.bodyBold.fontFamily },
  strugglePhrase: { ...typography.body, marginBottom: spacing.xs },
  coverageRatio: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  exchangeSpeaker: {
    ...typography.caption,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  tryLine: {
    ...typography.body,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.primaryDark,
    marginTop: spacing.md,
  },
});
