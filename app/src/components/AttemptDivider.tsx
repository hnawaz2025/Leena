import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";

interface AttemptDividerProps {
  attemptNumber: number;
}

export function AttemptDivider({ attemptNumber }: AttemptDividerProps) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>Practice {attemptNumber}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  label: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.textMuted,
  },
});
