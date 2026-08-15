import type { MetricBand, MetricDTO, RecoveryEvidenceDTO } from "@leena/shared";
import type { SessionForMetrics } from "./independence";

// What the user does when the conversation leaves the script. Asking someone
// to repeat themselves feels like admitting failure, so people say "okay" and
// move on -- and at a doctor's office or a lease signing that has real
// consequences. It's invisible from the inside, which is exactly why it's
// worth measuring.
//
// Every rule below trades recall for precision. Missing a real bluff costs
// nothing; telling someone they faked understanding when they didn't would
// cost their trust in everything else on the screen.

// Pure acknowledgment tokens only. "fine" and "good" are deliberately absent
// -- they're valid answers ("How are you?" / "Good.") and including them
// would fire on ordinary conversation.
const ACK_WORDS = new Set([
  "ok",
  "okay",
  "yes",
  "yeah",
  "yep",
  "sure",
  "right",
  "alright",
  "mm",
  "mhm",
  "mmhm",
  "uh-huh",
  "hmm",
]);

const MAX_ACK_WORDS = 3;

// Only open questions. "Do you have your receipt?" -> "Yes." is a correct
// answer, so polar questions are excluded from the numerator and the
// denominator alike.
const OPEN_QUESTION = /\b(what|where|when|why|how|who|which)\b/i;

// Wh-shaped phrasings that actually take a yes/no answer. Without these the
// detector would fire on the greeting at the start of nearly every
// conversation.
const POLAR_IN_DISGUISE = [
  /how about\b/i,
  /how does .* sound/i,
  /how do(es)? that sound/i,
  /what if\b/i,
  /how are you\b/i,
  /how're you\b/i,
  /how's it going\b/i,
  /how have you been\b/i,
  /what do you say\b/i,
];

// Recovery has a far thinner denominator than Independence: measured against
// real transcripts, only about a quarter of persona turns end in an open
// question, so a three-session window can yield just one or two chances to
// engage. At that size a single "okay" swings the score by fifty points,
// which is noise, not measurement. Stay silent until there's enough to say.
const MIN_OPPORTUNITIES = 5;

const BAND_LOW = 60;
const BAND_HIGH = 85;

const BAND_LABELS: Record<MetricBand, string> = {
  low: "nodding along",
  mid: "staying with it sometimes",
  high: "staying with it",
};

// The one phrase that works for every instance of this. Fixed rather than
// generated -- keeps the whole metric model-free.
export const RESCUE_PHRASE = "Sorry, could you say that again?";

export function isAcknowledgmentOnly(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= MAX_ACK_WORDS && words.every((w) => ACK_WORDS.has(w));
}

// True only when the turn ends on an open question. If the persona asked
// something and then said something else ("What brings you in? Take a seat."),
// an "okay" is answering the instruction, not dodging the question.
export function endsWithOpenQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.endsWith("?")) return false;

  // The final sentence is what the user is actually responding to.
  const lastSentence = trimmed.split(/(?<=[.!?])\s+/).pop() ?? trimmed;
  if (!OPEN_QUESTION.test(lastSentence)) return false;
  if (POLAR_IN_DISGUISE.some((p) => p.test(lastSentence))) return false;

  return true;
}

export interface BluffMoment {
  question: string;
  reply: string;
}

function collect(sessions: SessionForMetrics[]): { opportunities: number; bluffs: BluffMoment[] } {
  let opportunities = 0;
  const bluffs: BluffMoment[] = [];

  for (const session of sessions) {
    for (let i = 0; i < session.turns.length - 1; i++) {
      const agent = session.turns[i];
      const next = session.turns[i + 1];
      if (agent.speaker !== "agent" || next.speaker !== "user") continue;
      if (!endsWithOpenQuestion(agent.text)) continue;

      opportunities += 1;
      if (isAcknowledgmentOnly(next.text)) {
        bluffs.push({ question: agent.text.trim(), reply: next.text.trim() });
      }
    }
  }

  return { opportunities, bluffs };
}

function bandFor(value: number): MetricBand {
  if (value < BAND_LOW) return "low";
  if (value < BAND_HIGH) return "mid";
  return "high";
}

export function computeRecoveryValue(sessions: SessionForMetrics[]): number | null {
  const { opportunities, bluffs } = collect(sessions);
  if (opportunities < MIN_OPPORTUNITIES) return null;
  return Math.round(((opportunities - bluffs.length) / opportunities) * 100);
}

export function computeRecovery(
  current: SessionForMetrics[],
  previous: SessionForMetrics[]
): MetricDTO<RecoveryEvidenceDTO> | null {
  const { opportunities, bluffs } = collect(current);
  if (opportunities < MIN_OPPORTUNITIES) return null;

  const value = Math.round(((opportunities - bluffs.length) / opportunities) * 100);
  const band = bandFor(value);

  const evidence: RecoveryEvidenceDTO = {
    moments: bluffs.slice(0, 3),
    rescuePhrase: RESCUE_PHRASE,
  };

  return {
    value,
    band,
    bandLabel: BAND_LABELS[band],
    previous: computeRecoveryValue(previous),
    evidence,
  };
}
