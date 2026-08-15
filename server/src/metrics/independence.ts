import type { IndependenceEvidenceDTO, MetricBand, MetricDTO } from "@leena/shared";

// How much of a conversation the user got through without reaching for help.
// The one number that speaks to the core problem: knowing the words and
// producing them while someone waits are different skills.
//
// Everything here is a pure function over rows the caller already fetched --
// nothing is stored, because turns and help events are immutable once a
// session ends, so recomputing is always correct and can never drift.

export interface SessionForMetrics {
  turns: { speaker: string; text: string; fromSuggestion: boolean }[];
  // In-session help only. Standalone quick lookups are real-life moments,
  // not evidence about how a rehearsal went.
  helpEvents: { keyPhrase: string; suggestedText: string }[];
}

const BAND_LOW = 40;
const BAND_HIGH = 70;

const BAND_LABELS: Record<MetricBand, string> = {
  low: "leaning on support",
  mid: "getting there",
  high: "mostly on your own",
};

// A turn has to be a real attempt to count as evidence of independence --
// "yes" said alone proves nothing about whether they could have managed the
// sentence themselves.
const MIN_WORDS_FOR_UNAIDED_TURN = 8;
const MAX_STRUGGLE_PHRASES = 3;

function bandFor(value: number): MetricBand {
  if (value < BAND_LOW) return "low";
  if (value < BAND_HIGH) return "mid";
  return "high";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Counts *turns that needed help*, not help requests. Asking three times
// before sending one sentence is one aided turn, so the ratio can never
// exceed its own denominator and needs no clamping -- and "how many of the
// things I said did I manage myself" is the question the number is actually
// claiming to answer.
//
// Null rather than 0 when there's nothing to measure: a metric with no
// denominator isn't zero, it's absent, and absent metrics aren't rendered.
export function computeIndependenceValue(sessions: SessionForMetrics[]): number | null {
  let userTurns = 0;
  let aidedTurns = 0;

  for (const session of sessions) {
    for (const turn of session.turns) {
      if (turn.speaker !== "user") continue;
      userTurns += 1;
      if (turn.fromSuggestion) aidedTurns += 1;
    }
  }

  if (userTurns === 0) return null;
  return Math.round(((userTurns - aidedTurns) / userTurns) * 100);
}

function computeEvidence(sessions: SessionForMetrics[]): IndependenceEvidenceDTO {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const event of session.helpEvents) {
      if (!event.keyPhrase) continue;
      counts.set(event.keyPhrase, (counts.get(event.keyPhrase) ?? 0) + 1);
    }
  }

  const strugglePhrases = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_STRUGGLE_PHRASES)
    .map(([phrase, count]) => ({ phrase, count }));

  // The longest thing they said entirely on their own. Uses the recorded
  // fromSuggestion flag rather than matching against suggestion text, because
  // the help panel lets them edit a suggestion before sending -- one changed
  // word would defeat text matching and we'd show the app's own sentence back
  // as proof of their progress.
  let bestUnaidedTurn: string | null = null;
  for (const session of sessions) {
    for (const turn of session.turns) {
      if (turn.speaker !== "user" || turn.fromSuggestion) continue;
      if (wordCount(turn.text) < MIN_WORDS_FOR_UNAIDED_TURN) continue;

      if (!bestUnaidedTurn || wordCount(turn.text) > wordCount(bestUnaidedTurn)) {
        bestUnaidedTurn = turn.text;
      }
    }
  }

  return { strugglePhrases, bestUnaidedTurn };
}

export function computeIndependence(
  current: SessionForMetrics[],
  previous: SessionForMetrics[]
): MetricDTO<IndependenceEvidenceDTO> | null {
  const value = computeIndependenceValue(current);
  if (value === null) return null;

  const band = bandFor(value);
  return {
    value,
    band,
    bandLabel: BAND_LABELS[band],
    previous: computeIndependenceValue(previous),
    evidence: computeEvidence(current),
  };
}
