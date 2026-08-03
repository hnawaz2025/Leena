import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../theme";

interface EmptyStateProps {
  icon: string;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    textAlign: "center",
  },
});
