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

const CJK_RANGE = /[一-鿿぀-ヿ가-힯]/;
// Seen once for real: a stray Cyrillic word ("nyaetsya"-ish) inside otherwise
// correct Spanish output. None of this app's supported languages (Spanish,
// Mandarin, Hindi, English) use Cyrillic, so this check is unconditional.
const CYRILLIC_RANGE = /[Ѐ-ӿ]/;

// Small open-weight models (the free Featherless path) have shown a real
// failure mode: stray characters from an unrelated script leaking into output
// meant to be in a different language (seen first in explainDocument's
// Spanish output, then again as Cyrillic in a Spanish struggle area). This is
// a cheap, targeted check for exactly that -- not a general
// translation-quality check.
export function assertNoUnexpectedScript(text: string, expectedLanguage: string): void {
  const isCjkExpected = /chinese|mandarin|japanese|korean/i.test(expectedLanguage);
  if (!isCjkExpected && CJK_RANGE.test(text)) {
    throw new Error(
      `Unexpected CJK characters in output meant to be ${expectedLanguage}: ${text}`
    );
  }
  if (CYRILLIC_RANGE.test(text)) {
    throw new Error(
      `Unexpected Cyrillic characters in output meant to be ${expectedLanguage}: ${text}`
    );
  }
}

export async function callForJson<T>(
  schema: z.ZodType<T>,
  callModel: (correctionNote?: string) => Promise<string>,
  validate?: (parsed: T) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionNote = attempt === 0 ? undefined : JSON_CORRECTION_NOTE;
    try {
      const text = await callModel(correctionNote);
      const parsed = schema.parse(JSON.parse(extractJsonBlock(text)));
      validate?.(parsed);
      return parsed;
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
