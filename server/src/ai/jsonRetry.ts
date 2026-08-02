import type { z } from "zod";

// Shared across every LLM provider: none of them guarantee well-formed JSON
// from a prompt alone. This extracts the first JSON object from raw text,
// validates it against the given schema, and retries once with an explicit
// correction instruction before giving up.

export const JSON_CORRECTION_NOTE =
  "Your previous response could not be parsed as valid JSON matching the required shape. Return ONLY a single valid JSON object, with no prose before or after it, and no markdown code fences.";

function extractJsonBlock(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected JSON in model output, got: ${raw}`);
  return match[0];
}

export async function callForJson<T>(
  schema: z.ZodType<T>,
  callModel: (correctionNote?: string) => Promise<string>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionNote = attempt === 0 ? undefined : JSON_CORRECTION_NOTE;
    try {
      const text = await callModel(correctionNote);
      const parsed = JSON.parse(extractJsonBlock(text));
      return schema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `AI response did not match the expected shape after retry: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
