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
  // For icons or text sitting ON amber. White on #FF8C1A measures 2.33:1,
  // which fails AA badly -- and the amber avatar is the only cue telling the
  // user which side of the conversation is the stranger.
  secondaryDeep: "#8A4600", // white on this = 6.4:1
  success: "#3F8F5F",
  warning: "#C48A1E",
  // Was #D64545, which measured 4.10:1 on the app background -- just under AA.
  error: "#B93232", // 5.52:1
  background: "#F8F7FB",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF3DC",
  border: "#E8E6EF",
  textPrimary: "#201C2B", // 16.63:1 on surface
  textSecondary: "#6B6575", // 5.26:1 on background
  // Was #A29CB0 -- 2.49:1, roughly 45% short of AA, while carrying real
  // instructions: the rotating placeholder that tells people they may type in
  // their own language, and the empty state a new user sees first.
  textMuted: "#736E80", // 4.61:1 on background, 4.92:1 on surface
  // The old muted value, kept for 1px rules and dividers only -- never text.
  hairline: "#A29CB0",
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
  input: 14,
  button: 14,
  card: 20,
  pill: 999,
  chatBubble: 18,
};

export const gradients = {
  primary: [colors.primary, colors.primaryDark] as const,
  secondary: [colors.secondaryLight, colors.secondary] as const,
};

export const fontFamily = {
  headingMedium: "Lora_500Medium",
  headingSemiBold: "Lora_600SemiBold",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
};

export const typography = {
  display: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.textPrimary,
  },
  h1: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: 22,
    lineHeight: 28,
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
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};
