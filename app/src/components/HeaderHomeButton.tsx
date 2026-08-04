import { House } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";

interface HeaderHomeButtonProps {
  onPress: () => void;
}

// Persistent, always-visible way back to Home from any deep screen -- the
// default stack back arrow only goes one screen back (e.g. Conversation ->
// ScenarioSetup), not Home, and a button at the bottom of scrollable content
// (Feedback, DocumentExplanation) requires scrolling to find.
export function HeaderHomeButton({ onPress }: HeaderHomeButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.button}>
      <House size={20} color={colors.textPrimary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
  },
});
