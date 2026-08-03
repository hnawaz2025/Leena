import { z } from "zod";

// Schemas for the two LLM calls that must return structured JSON. Anthropic
// doesn't guarantee valid/well-shaped JSON from a prompt alone, so every
// parsed response is validated against these before it touches the database.

export const generatedScenarioSchema = z.object({
  title: z.string().min(1),
  personaDescription: z.string().min(1),
  contextSummary: z.string().min(1),
  openingLine: z.string().min(1),
  keyVocabulary: z.array(z.string()).min(1),
});
export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;

export const analyzeSessionResultSchema = z.object({
  summary: z.string().min(1),
  struggleAreas: z.array(z.string()),
  vocabularySuggestions: z.array(
    z.object({
      term: z.string().min(1),
      note: z.string().min(1),
    })
  ),
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
