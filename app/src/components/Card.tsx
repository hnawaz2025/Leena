import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "../theme";

interface CardProps {
  children: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
}

export function Card({ children, accentColor, style }: CardProps) {
  return (
    <View style={[styles.shadowWrapper, style]}>
      <View style={styles.base}>
        {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shadow and overflow:hidden can't live on the same view -- iOS clips the
  // shadow along with the content, making it invisible. This wrapper carries
  // the shadow; the inner view clips the accent bar to the card's radius.
  shadowWrapper: {
    borderRadius: radius.card,
    ...shadow.subtle,
  },
  base: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
});
