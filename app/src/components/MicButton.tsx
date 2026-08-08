import { Mic, Square } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import type { RecordingState } from "../hooks/useVoiceRecording";
import { BreathingDot } from "./BreathingDot";
import { colors } from "../theme";

interface MicButtonProps {
  state: RecordingState;
  onPress: () => void;
  disabled?: boolean;
}

export function MicButton({ state, onPress, disabled }: MicButtonProps) {
  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <Pressable
      style={[styles.button, isRecording && styles.buttonActive]}
      onPress={onPress}
      disabled={disabled || isTranscribing}
    >
      {isTranscribing ? (
        <BreathingDot size={16} />
      ) : isRecording ? (
        <Square size={16} color={colors.white} strokeWidth={2} fill={colors.white} />
      ) : (
        <Mic size={18} color={colors.textSecondary} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  buttonActive: {
    backgroundColor: colors.error,
  },
});
