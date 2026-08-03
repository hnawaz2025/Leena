import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "../theme";

interface CardProps {
  children: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
}

export function Card({ children, accentColor, style }: CardProps) {
  return (
    <View style={[styles.base, style]}>
      {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: "hidden",
    ...shadow.subtle,
  },
  accentBar: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
});
