// Maps the display names used throughout the app (onboarding chips, stored
// nativeLanguage) to ISO-639-1 codes Whisper expects as a transcription hint.
// Without a hint Whisper still auto-detects reasonably well, but a hint
// measurably improves accuracy on short phrases.
const LANGUAGE_CODES: Record<string, string> = {
  Spanish: "es",
  Mandarin: "zh",
  Hindi: "hi",
  English: "en",
};

export function toLanguageCode(displayName: string): string | undefined {
  return LANGUAGE_CODES[displayName];
}
