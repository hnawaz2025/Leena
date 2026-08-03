import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { useState } from "react";
import { colors, radius, shadow, spacing, typography } from "../theme";

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
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...typography.body,
    ...shadow.subtle,
  },
  focused: {
    borderColor: colors.primary,
  },
});
