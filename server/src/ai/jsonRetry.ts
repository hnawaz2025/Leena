import type { z } from "zod";

// Shared across every LLM provider: none of them guarantee well-formed JSON
// from a prompt alone. This extracts the first JSON object from raw text,
// validates it against the given schema, and retries once with an explicit
// correction instruction before giving up.

// Distinguishes "the model answered badly" from "there was no answer". The
// OpenAI SDK (which both providers use) attaches a numeric `status` to
// anything that came back from the wire, and an APIConnectionError for
// failures that never got that far -- neither of which a reworded prompt can
// do anything about.
function isTransportError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; name?: unknown };
  if (typeof candidate.status === "number") return true;
  return typeof candidate.name === "string" && /^API(Connection|UserAbort)/.test(candidate.name);
}

// Told the model only that something was wrong, never what -- so a retry
// after a specific mistake (e.g. an out-of-range index) had nothing to go on
// and would often make the exact same mistake again. Now built per-attempt
// from the actual error, so the model sees what it needs to fix.
function buildCorrectionNote(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Your previous response had this problem: ${detail}. Return ONLY a single valid JSON object that fixes this, with no prose before or after it, and no markdown code fences.`;
}

function extractJsonBlock(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected JSON in model output, got: ${raw}`);
  return match[0];
}

// The non-Latin scripts this app can encounter, and how to recognise a
// language that legitimately uses each. Written as a table rather than a
// chain of ifs because the previous version grew one branch per incident --
// CJK after one, Cyrillic after another -- and silently never covered
// Devanagari at all, despite Hindi being a supported language.
const SCRIPTS: { name: string; pattern: RegExp; usedBy: RegExp }[] = [
  { name: "CJK", pattern: /[぀-ヿ一-鿿가-힯]/, usedBy: /chinese|mandarin|cantonese|japanese|korean/i },
  { name: "Devanagari", pattern: /[ऀ-ॿ]/, usedBy: /hindi|marathi|nepali|sanskrit/i },
  { name: "Cyrillic", pattern: /[Ѐ-ӿ]/, usedBy: /russian|ukrainian|bulgarian|serbian/i },
  { name: "Arabic", pattern: /[؀-ۿ]/, usedBy: /arabic|urdu|farsi|persian|pashto/i },
];

/**
 * Rejects output that has leaked characters from a script the target language
 * doesn't use -- a real failure mode of small open-weight models, first seen
 * as stray CJK in Spanish output and again as Cyrillic inside Spanish.
 *
 * Latin characters are never flagged, in any language: proper nouns ("Dr.
 * Smith", "City Eye Clinic") and borrowed terms legitimately appear in Hindi
 * or Mandarin text, and rejecting those would fail far more good output than
 * bad. This catches wholesale script confusion, not code-switching, and is
 * not a translation-quality check.
 */
export function assertNoUnexpectedScript(text: string, expectedLanguage: string): void {
  for (const script of SCRIPTS) {
    if (script.usedBy.test(expectedLanguage)) continue;
    if (script.pattern.test(text)) {
      throw new Error(
        `Unexpected ${script.name} characters in output meant to be ${expectedLanguage}: ${text}`
      );
    }
  }
}

// `validate` is for structural problems that would corrupt data if accepted
// -- mismatched array lengths, out-of-range indices. Those retry and then
// fail the call.
//
// `softValidate` is for quality problems where a degraded answer still beats
// no answer, chiefly the small-model habit of leaking stray CJK/Cyrillic into
// other languages. Those retry too, but on the last attempt the result is
// accepted with a warning rather than throwing -- losing a whole feedback
// report over a few foreign characters in one sentence is the worse outcome.
export async function callForJson<T>(
  schema: z.ZodType<T>,
  callModel: (correctionNote?: string) => Promise<string>,
  validate?: (parsed: T) => void,
  softValidate?: (parsed: T) => void
): Promise<T> {
  let lastError: unknown;
  const lastAttempt = 1;

  for (let attempt = 0; attempt <= lastAttempt; attempt++) {
    const correctionNote = attempt === 0 ? undefined : buildCorrectionNote(lastError);
    try {
      const text = await callModel(correctionNote);
      const parsed = schema.parse(JSON.parse(extractJsonBlock(text)));
      validate?.(parsed);

      if (softValidate) {
        try {
          softValidate(parsed);
        } catch (error) {
          if (attempt < lastAttempt) throw error;
          console.warn(
            `Accepting AI response despite quality check: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      return parsed;
    } catch (error) {
      lastError = error;

      // This retry exists to correct a badly-shaped *response*. If the model
      // never produced one -- auth rejected, out of quota, model id wrong,
      // provider at capacity -- then re-asking with a note about JSON
      // formatting is asking the wrong question, and only doubles how long
      // the user waits to be told it failed. The SDK has already retried the
      // transient ones with proper backoff by this point.
      if (isTransportError(error)) break;
    }
  }

  // `cause` matters: by the time this reaches errorHandler the original
  // provider error (a 503, a quota failure) is the only thing that can tell
  // the user something useful, and flattening it into a string here would
  // throw away the status code that classification depends on.
  throw new Error(
    `AI response did not match the expected shape after retry: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    { cause: lastError }
  );
}
