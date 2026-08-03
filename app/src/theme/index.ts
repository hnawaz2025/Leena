// Sampled directly from leena_icon.png (the two speech bubbles in
// conversation): deep violet + amber orange, meeting in the middle. Violet
// reads as "you," orange as "the person you're practicing with" -- carried
// through into chat bubble colors on the Conversation screen.
export const colors = {
  primary: "#4A1FB8", // violet bubble
  primaryDark: "#2D0A8C", // indigo dots / pressed state
  secondary: "#FF8C1A", // orange bubble
  secondaryLight: "#FFB22F", // orange bubble gradient top
  highlight: "#FFEC83", // pale yellow dots
  success: "#3F8F5F",
  warning: "#C48A1E",
  error: "#D64545",
  background: "#F8F7FB",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF3DC",
  border: "#E8E6EF",
  textPrimary: "#201C2B",
  textSecondary: "#6B6575",
  textMuted: "#A29CB0",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  input: 12,
  button: 12,
  card: 16,
  pill: 999,
  chatBubble: 18,
};

export const fontFamily = {
  headingMedium: "Lora_500Medium",
  headingSemiBold: "Lora_600SemiBold",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
};

export const typography = {
  h1: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodyBold: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  button: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
} as const;

export const shadow = {
  subtle: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
