import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

interface ChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress: () => void;
}

export function Chip({ label, icon, selected = false, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.base, selected && styles.selected]}>
      {icon ? <Text style={styles.icon}>{icon} </Text> : null}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: typography.bodyBold.fontFamily,
  },
  selectedLabel: {
    color: colors.white,
  },
});
