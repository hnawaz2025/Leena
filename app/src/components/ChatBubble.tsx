import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, gradients, radius, spacing, typography } from "../theme";

interface ChatBubbleProps {
  text: string;
  speaker: "user" | "agent";
}

export function ChatBubble({ text, speaker }: ChatBubbleProps) {
  const isUser = speaker === "user";
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  const animatedStyle = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  if (isUser) {
    return (
      <Animated.View style={[styles.row, styles.rowUser, animatedStyle]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{text}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.row, styles.rowAgent, animatedStyle]}>
      <View style={[styles.bubble, styles.agentBubble]}>
        <Text style={styles.agentText}>{text}</Text>
      </View>
    </Animated.View>
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
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.secondary,
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
