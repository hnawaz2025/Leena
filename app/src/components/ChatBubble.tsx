import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

interface ChatBubbleProps {
  text: string;
  speaker: "user" | "agent";
}

export function ChatBubble({ text, speaker }: ChatBubbleProps) {
  const isUser = speaker === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAgent]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        <Text style={isUser ? styles.userText : styles.agentText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAgent: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.chatBubble,
  },
  userBubble: {
    backgroundColor: colors.secondary,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  userText: {
    ...typography.body,
    color: colors.white,
  },
  agentText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
