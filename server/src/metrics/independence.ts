import type { IndependenceEvidenceDTO, MetricBand, MetricDTO } from "@leena/shared";

// How much of a conversation the user got through on their own. Two ways to
// not manage a moment yourself, and this counts both:
//
//   1. You used a suggestion from the help panel.
//   2. You dodged -- a bare "okay", or a shutdown like "I don't know", where a
//      real answer was expected.
//
// Merging them is deliberate. Counting only help-button usage measured our own
// feature rather than the person: someone who freezes and says "okay" never
// touches the button and would have scored a perfect 100.
//
// Asking for clarification is explicitly NOT a failure. Someone who says "could
// you repeat that?" is engaging, not dodging, and that turn counts as handled
// alone -- it's the behaviour the app exists to build, so it's tracked and
// celebrated rather than penalised.
//
// Everything here is a pure function over rows the caller already fetched.

export interface SessionForMetrics {
  turns: { speaker: string; text: string; fromSuggestion: boolean }[];
  // Indices into `turns`, LLM-tagged at session end.
  nonAnswerTurnIndices: number[];
  clarificationTurnIndices: number[];
  // In-session help only. Standalone quick lookups are real-life moments, not
  // evidence about how a rehearsal went.
  helpEvents: { keyPhrase: string; suggestedText: string }[];
}

const BAND_LOW = 40;
const BAND_HIGH = 70;

// Short and honest rather than count-stuffed -- the ring now shows the exact
// fraction, so the label only needs to carry tone.
const BAND_LABELS: Record<MetricBand, string> = {
  low: "leaning on support",
  mid: "getting there",
  high: "mostly on your own",
};

// A turn has to be a real attempt to count as evidence -- "yes" said alone
// proves nothing about whether they could have managed the sentence.
const MIN_WORDS_FOR_UNAIDED_TURN = 8;
const MAX_STRUGGLE_PHRASES = 3;
const MAX_NON_ANSWER_MOMENTS = 3;

function bandFor(value: number): MetricBand {
  if (value < BAND_LOW) return "low";
  if (value < BAND_HIGH) return "mid";
  return "high";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Counts *turns*, not help requests. Asking three times before sending one
// sentence is one turn you didn't manage alone, so the ratio can never exceed
// its own denominator and needs no clamping. The raw request count is kept in
// the evidence instead, where the magnitude still shows.
function tally(sessions: SessionForMetrics[]): { userTurns: number; notAlone: number } {
  let userTurns = 0;
  let notAlone = 0;

  for (const session of sessions) {
    const nonAnswers = new Set(session.nonAnswerTurnIndices);
    const clarifications = new Set(session.clarificationTurnIndices);

    session.turns.forEach((turn, index) => {
      if (turn.speaker !== "user") return;
      userTurns += 1;

      // Clarification wins over every other signal: it is the good outcome,
      // and the tagger is told never to list a turn as both.
      if (clarifications.has(index)) return;
      if (turn.fromSuggestion || nonAnswers.has(index)) notAlone += 1;
    });
  }

  return { userTurns, notAlone };
}

// Null rather than 0 when there's nothing to measure: a metric with no
// denominator isn't zero, it's absent, and absent metrics aren't rendered.
export function computeIndependenceValue(sessions: SessionForMetrics[]): number | null {
  const { userTurns, notAlone } = tally(sessions);
  if (userTurns === 0) return null;
  return Math.round(((userTurns - notAlone) / userTurns) * 100);
}

function computeEvidence(sessions: SessionForMetrics[]): IndependenceEvidenceDTO {
  const counts = new Map<string, number>();
  let helpRequestCount = 0;
  let clarificationCount = 0;
  const nonAnswerMoments: { question: string; reply: string }[] = [];

  for (const session of sessions) {
    helpRequestCount += session.helpEvents.length;
    clarificationCount += session.clarificationTurnIndices.length;

    for (const event of session.helpEvents) {
      if (!event.keyPhrase) continue;
      counts.set(event.keyPhrase, (counts.get(event.keyPhrase) ?? 0) + 1);
    }

    for (const index of session.nonAnswerTurnIndices) {
      const turn = session.turns[index];
      if (!turn || turn.speaker !== "user") continue;
      // The persona line immediately before is what they dodged.
      const prompt = session.turns[index - 1];
      nonAnswerMoments.push({
        question: prompt?.speaker === "agent" ? prompt.text.trim() : "",
        reply: turn.text.trim(),
      });
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
    const nonAnswers = new Set(session.nonAnswerTurnIndices);
    session.turns.forEach((turn, index) => {
      if (turn.speaker !== "user" || turn.fromSuggestion || nonAnswers.has(index)) return;
      if (wordCount(turn.text) < MIN_WORDS_FOR_UNAIDED_TURN) return;
      if (!bestUnaidedTurn || wordCount(turn.text) > wordCount(bestUnaidedTurn)) {
        bestUnaidedTurn = turn.text;
      }
    });
  }

  return {
    strugglePhrases,
    bestUnaidedTurn,
    helpRequestCount,
    clarificationCount,
    nonAnswerMoments: nonAnswerMoments.slice(0, MAX_NON_ANSWER_MOMENTS),
  };
}

export function computeIndependence(
  current: SessionForMetrics[],
  previous: SessionForMetrics[]
): MetricDTO<IndependenceEvidenceDTO> | null {
  const { userTurns, notAlone } = tally(current);
  if (userTurns === 0) return null;

  const handled = userTurns - notAlone;
  const value = Math.round((handled / userTurns) * 100);
  const band = bandFor(value);

  return {
    value,
    band,
    bandLabel: BAND_LABELS[band],
    count: handled,
    total: userTurns,
    previous: computeIndependenceValue(previous),
    evidence: computeEvidence(current),
  };
}
