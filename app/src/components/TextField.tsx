import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { useState } from "react";
import { colors, radius, spacing, typography } from "../theme";

export function TextField(props: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.base, focused && styles.focused, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
});
