import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme";

interface RotatingPlaceholderProps {
  phrases: string[];
  visible: boolean;
}

const VISIBLE_MS = 3200;
const FADE_MS = 400;

// Sits over the quick-lookup input and cycles its example between the user's
// native language and English, so it's obvious that either one works. Drawn
// as an overlay rather than using TextInput's own placeholder prop, which
// can't be animated -- a hard text swap reads as a rendering glitch.
export function RotatingPlaceholder({ phrases, visible }: RotatingPlaceholderProps) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phrases.length < 2) return;

    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      ]).start();
      // Swap at the midpoint, while it's fully faded out.
      setTimeout(() => setIndex((i) => (i + 1) % phrases.length), FADE_MS);
    }, VISIBLE_MS);

    return () => clearInterval(timer);
  }, [phrases.length, opacity]);

  if (!visible) return null;

  return (
    <Animated.Text style={[styles.text, { opacity }]} numberOfLines={1} pointerEvents="none">
      {phrases[index]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // Mirrors TextField's padding (plus its 1.5px border) so the example sits
  // exactly where typed text will appear.
  text: {
    position: "absolute",
    left: spacing.lg + 1.5,
    right: spacing.lg + 1.5,
    top: spacing.md + 1.5,
    ...typography.body,
    color: colors.textMuted,
  },
});
