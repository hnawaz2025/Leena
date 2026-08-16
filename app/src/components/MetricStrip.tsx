import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MetricDTO } from "@leena/shared";
import { colors, radius, spacing, typography } from "../theme";
import { MetricRing } from "./MetricRing";

interface MetricStripProps {
  // Evidence-agnostic: the strip only ever shows the ring, its band and the
  // previous-value tick, so it doesn't care which metric it's handed.
  metrics: { label: string; metric: MetricDTO<unknown> }[];
  onPress: () => void;
}

const RING_SIZE = 72;

// The at-a-glance row. A ring per metric rather than a bare 0-100 number --
// the fill still reads as "mostly full" at a glance, but the center shows the
// exact fraction instead of an abstract percentage.
export function MetricStrip({ metrics, onPress }: MetricStripProps) {
  if (metrics.length === 0) return null;

  return (
    <Pressable style={styles.strip} onPress={onPress}>
      {metrics.map(({ label, metric }) => (
        <View key={label} style={styles.cell}>
          <Text style={styles.label}>{label}</Text>
          <MetricRing
            size={RING_SIZE}
            value={metric.value}
            previous={metric.previous}
            band={metric.band}
            count={metric.count}
            total={metric.total}
            caption={metric.bandLabel}
          />
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  cell: { alignItems: "center", gap: spacing.xs },
  label: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
});
