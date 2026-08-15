import { TrendingDown, TrendingUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MetricDTO } from "@leena/shared";
import { colors, radius, spacing, typography } from "../theme";

interface MetricStripProps {
  // Evidence-agnostic: the strip only ever shows the number, its band and the
  // trend, so it doesn't care which metric it's handed.
  metrics: { label: string; metric: MetricDTO<unknown> }[];
  onPress: () => void;
}

// The at-a-glance row. Deliberately just the number and its band -- the band
// is what makes a bare number mean something without needing the formula,
// the same way "recovery 34" reads instantly once you've seen a few.
// Built to hold three; renders however many exist so far.
export function MetricStrip({ metrics, onPress }: MetricStripProps) {
  if (metrics.length === 0) return null;

  return (
    <Pressable style={styles.strip} onPress={onPress}>
      {metrics.map(({ label, metric }) => {
        const delta = metric.previous === null ? null : metric.value - metric.previous;
        return (
          <View key={label} style={styles.cell}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{metric.value}</Text>
            <Text style={styles.band} numberOfLines={1}>
              {metric.bandLabel}
            </Text>
            {delta !== null && delta !== 0 ? (
              <View style={styles.trendRow}>
                {delta > 0 ? (
                  <TrendingUp size={11} color={colors.success} strokeWidth={2.5} />
                ) : (
                  <TrendingDown size={11} color={colors.textMuted} strokeWidth={2.5} />
                )}
                <Text style={[styles.trend, delta > 0 && styles.trendUp]}>
                  {delta > 0 ? "+" : ""}
                  {delta}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  label: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  value: { ...typography.display, fontSize: 32, lineHeight: 38, color: colors.primaryDark },
  band: { ...typography.caption, fontSize: 11, textAlign: "center" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  trend: { ...typography.caption, fontSize: 11, color: colors.textMuted },
  trendUp: { color: colors.success },
});
