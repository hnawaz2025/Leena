import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { useState } from "react";
import { colors, radius, shadow, spacing, typography } from "../theme";

interface TextFieldProps extends TextInputProps {
  /**
   * Grow downward as the text wraps, instead of scrolling sideways inside a
   * fixed box. Only meaningful with `multiline`.
   *
   * Off by default: a growing box needs a separate send control, and inputs
   * that submit on the return key (the quick lookup on Home) would lose that
   * behaviour the moment they became multiline.
   */
  autoGrow?: boolean;
  /** Ceiling for autoGrow, so a long message can't swallow the conversation. */
  maxHeight?: number;
}

const DEFAULT_MAX_HEIGHT = 120;

// contentSize measures the text alone, so the box's own vertical padding has
// to be added back or the last line sits under the bottom edge.
const VERTICAL_PADDING = spacing.md * 2;

export function TextField({ autoGrow, maxHeight = DEFAULT_MAX_HEIGHT, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  // Sending clears the box, and a stale measurement would leave it standing
  // several lines tall with nothing in it -- so an empty value always falls
  // back to the base height rather than to the last thing that was measured.
  const isEmpty = props.value === "" || props.value === undefined;

  // Only take over the height once the input has actually measured itself.
  // Before that, the base style's padding decides it, which keeps an empty
  // box exactly the size it was before this prop existed.
  const grownStyle =
    autoGrow && contentHeight !== null && !isEmpty
      ? { height: Math.min(contentHeight + VERTICAL_PADDING, maxHeight) }
      : null;

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      onContentSizeChange={(e) => {
        if (autoGrow) setContentHeight(e.nativeEvent.contentSize.height);
        props.onContentSizeChange?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.base, focused && styles.focused, props.style, grownStyle]}
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
