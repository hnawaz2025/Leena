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

// Same example situation (asking a landlord not to raise the rent) written in
// each supported language, so the placeholder in the native-language field
// actually matches the language the user picked instead of always showing
// Spanish.
const SITUATION_EXAMPLES: Record<string, string> = {
  Spanish: "p. ej. Le voy a pedir a mi casero que no suba la renta…",
  Mandarin: "例如：我要跟房东说不要涨房租…",
  Hindi: "जैसे: मैं अपने मकान मालिक से किराया न बढ़ाने के लिए कहूँगा…",
};

export function getSituationExample(displayName: string): string {
  return SITUATION_EXAMPLES[displayName] ?? "e.g. Talking to my landlord about a lease renewal";
}

// Separate from the examples above: Scenario Setup asks you to *describe a
// situation*, while the quick-lookup box on Home asks for the thing you
// actually want to say out loud. Both versions of the same sentence are kept
// so the placeholder can alternate between them -- the cheapest way to show
// that either language is accepted, without a line of instructions.
const QUICK_LOOKUP_EXAMPLES: Record<string, string> = {
  Spanish: "Quiero devolver esto",
  Mandarin: "我想退这个",
  Hindi: "मुझे यह वापस करना है",
};

const QUICK_LOOKUP_EXAMPLE_ENGLISH = "I'd like to return this";

export function getQuickLookupExamples(displayName: string): string[] {
  const native = QUICK_LOOKUP_EXAMPLES[displayName];
  return native ? [native, QUICK_LOOKUP_EXAMPLE_ENGLISH] : [QUICK_LOOKUP_EXAMPLE_ENGLISH];
}
