import { z } from "zod";

// Schemas for every LLM call that must return structured JSON. No model
// guarantees valid, well-shaped JSON from a prompt alone -- least of all a
// small open-weight one -- so every parsed response is validated against these
// before it touches the database.

export const generatedScenarioSchema = z.object({
  title: z.string().min(1),
  personaDescription: z.string().min(1),
  contextSummary: z.string().min(1),
  openingLine: z.string().min(1),
  keyVocabulary: z.array(z.string()).min(1),
});
export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;

// The fixed set of things a given conversation demands. Generated once per
// scenario and then immutable -- coverage can only accumulate against a
// target that doesn't move.
export const checklistSchema = z.object({
  items: z
    .array(
      z.object({
        en: z.string().min(1),
        native: z.string().min(1),
      })
    )
    .min(1),
});
export type ChecklistResult = z.infer<typeof checklistSchema>;

export const analyzeSessionResultSchema = z.object({
  summary: z.string().min(1),
  summaryNative: z.string().min(1),
  vocabularySuggestions: z.array(
    z.object({
      term: z.string().min(1),
      note: z.string().min(1),
      noteNative: z.string().min(1),
    })
  ),
  conversationSummary: z.string().min(1),
  conversationSummaryNative: z.string().min(1),
  // Indices into the scenario's checklist that this transcript shows the user
  // actually handled. Empty when no checklist was supplied.
  coveredIndices: z.array(z.number().int().min(0)),
  // Indices into the transcript, not the checklist. User turns that dodged a
  // question rather than answering it -- a bare acknowledgment, or a shutdown
  // like "I don't know" where a real answer was expected.
  nonAnswerTurnIndices: z.array(z.number().int().min(0)),
  // User turns that asked for repetition or explanation. Tracked separately
  // and deliberately NOT counted as non-answers: asking someone to repeat is
  // the opposite of nodding along, and is the behaviour the app exists to
  // build.
  clarificationTurnIndices: z.array(z.number().int().min(0)),
});
export type AnalyzeSessionResult = z.infer<typeof analyzeSessionResultSchema>;

export const documentExplanationSchema = z.object({
  summary: z.string().min(1),
  keyTerms: z.array(
    z.object({
      term: z.string().min(1),
      definition: z.string().min(1),
    })
  ),
  actionItems: z.array(z.string()),
});
export type DocumentExplanation = z.infer<typeof documentExplanationSchema>;

// Mirrors the StruggleCategory enum in schema.prisma -- keep the two in sync.
export const struggleCategorySchema = z.enum([
  "VOCABULARY",
  "GRAMMAR",
  "CONFIDENCE",
  "COMPREHENSION",
  "FORMALITY",
  "DOMAIN_KNOWLEDGE",
]);
export type StruggleCategory = z.infer<typeof struggleCategorySchema>;

export const suggestedPhraseSchema = z.object({
  suggestedText: z.string().min(1),
  keyPhrase: z.string().min(1),
  category: struggleCategorySchema,
});
export type SuggestedPhrase = z.infer<typeof suggestedPhraseSchema>;
