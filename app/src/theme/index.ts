export const colors = {
  primary: "#C1622B",
  primaryDark: "#9E4E20",
  secondary: "#2E6B5E",
  success: "#3F8F5F",
  warning: "#C48A1E",
  error: "#B4432E",
  background: "#FBF6F0",
  surface: "#FFFFFF",
  surfaceWarm: "#F3E9DD",
  border: "#E8DDD0",
  textPrimary: "#2B2420",
  textSecondary: "#6E6255",
  textMuted: "#A69C8E",
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
    shadowColor: "#2B2420",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
