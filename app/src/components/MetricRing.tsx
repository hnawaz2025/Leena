import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { MetricBand } from "@leena/shared";
import { colors, spacing, typography } from "../theme";

interface MetricRingProps {
  size: number;
  // 0-100. Drives the fill and the colour band -- still the smooth signal,
  // just never printed as raw text anymore.
  value: number;
  // 0-100, or null below the trend threshold. Rendered as a tick on the ring
  // track rather than a separate line of "+3" text.
  previous: number | null;
  band: MetricBand;
  // The exact fraction, shown in the center instead of the percentage.
  count: number;
  total: number;
  caption: string;
  // Only passed by the large/detail usage.
  explainer?: string;
  // What the tick actually compares against -- not the ring's business to know
  // the window size, so the caller states it plainly (e.g. "your previous 4
  // conversations"). Without this the dot has no explanation at all.
  previousLabel?: string;
}

// A progress ramp, not a traffic light. `low` used to be colors.warning and
// `mid` the brand amber, so a user's low independence score was rendered in
// the same colour the app uses for problems -- a judgement on them, in alarm
// paint, for an audience that already underestimates itself. The numbers were
// carefully made non-discouraging; the colour was quietly undoing that.
//
// These deepen toward confident rather than shifting hue toward danger, and
// none of them is the semantic warning/error colour.
const BAND_COLORS: Record<MetricBand, string> = {
  low: "#8B7FB8",
  mid: colors.primary,
  high: colors.success,
};

// Starts at 12 o'clock rather than SVG's default 3 o'clock, matching every
// circular-progress convention (Apple Watch rings, WHOOP recovery) users
// already read at a glance.
const START_ANGLE_OFFSET = -90;

function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function MetricRing({
  size,
  value,
  previous,
  band,
  count,
  total,
  caption,
  explainer,
  previousLabel,
}: MetricRingProps) {
  const strokeWidth = Math.max(4, Math.round(size * 0.09));
  const radius = size / 2 - strokeWidth / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(100, Math.max(0, value));
  const dashOffset = circumference * (1 - filled / 100);
  const color = BAND_COLORS[band];

  const tick = previous !== null ? pointOnCircle(cx, cy, radius, START_ANGLE_OFFSET + previous * 3.6) : null;

  const fractionSize = size * 0.24;
  // The ring's own diameter is too narrow to hold "your previous 4
  // conversations" on one line -- only widen the text column when there's
  // text that needs it (the large/detail usage); the small ring on Home never
  // gets an explainer and stays exactly ring-width.
  const containerWidth = explainer ? Math.max(size, 240) : size;

  return (
    <View style={{ width: containerWidth, alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            rotation={START_ANGLE_OFFSET}
            origin={`${cx}, ${cy}`}
          />
          {tick ? (
            // White with a dark outline rather than a flat colour -- it has
            // to stay visible sitting on top of the grey track AND the
            // coloured arc, and no single flat colour reads clearly on both.
            <Circle
              cx={tick.x}
              cy={tick.y}
              r={strokeWidth * 0.6}
              fill={colors.white}
              stroke={colors.primaryDark}
              strokeWidth={1.5}
            />
          ) : null}
        </Svg>
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.fraction, { fontSize: fractionSize }]} numberOfLines={1}>
            {count}/{total}
          </Text>
        </View>
      </View>
      <Text style={styles.caption} numberOfLines={2}>
        {caption}
      </Text>
      {explainer ? <Text style={styles.explainer}>{explainer}</Text> : null}
      {/* The tick on the ring means nothing without this -- only worth the
          words on the large/detail view, where explainer is passed. */}
      {explainer && tick && previousLabel ? (
        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText} numberOfLines={1}>
            {previousLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Spelled out rather than spreading StyleSheet.absoluteFill(Object). Which
  // of those two is a spreadable object and which is a registered style id has
  // changed between React Native versions, so hardcoding the four properties
  // is the one form that compiles on all of them.
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  fraction: {
    fontFamily: typography.display.fontFamily,
    color: colors.primaryDark,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  explainer: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
