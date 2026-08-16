export type Language = string; // BCP-47 tag, e.g. "es", "en", "hi"

export type DocumentType = "lease" | "medical" | "job-letter" | "other";

export type Speaker = "user" | "agent";

export interface ScenarioDTO {
  id: string;
  title: string;
  situationType: string;
  personaDescription: string;
  contextSummary: string;
  language: Language;
  documentId: string | null;
  createdAt: string;
}

export interface DocumentDTO {
  id: string;
  type: DocumentType;
  extractedText: string;
  createdAt: string;
}

export interface TurnDTO {
  id: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  audioUrl: string | null;
  language: Language;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  startedAt: string;
  endedAt: string | null;
  status: "active" | "completed";
}

// A type alias rather than an interface so it satisfies Prisma's
// InputJsonValue when written to a Json column -- interfaces don't pick up
// the implicit index signature that requires.
export type ChecklistItemDTO = {
  en: string;
  native: string;
};

export interface FeedbackReportDTO {
  id: string;
  sessionId: string;
  summary: string;
  summaryNative: string;
  vocabularySuggestions: { term: string; note: string; noteNative: string }[];
  conversationSummary: string;
  conversationSummaryNative: string;
  // The scenario's fixed checklist, plus what this session covered and what
  // every attempt has covered between them.
  checklist: ChecklistItemDTO[];
  coveredIndices: number[];
  cumulativeCoveredIndices: number[];
  createdAt: string;
}

export interface DocumentExplanationDTO {
  id: string;
  documentId: string;
  summary: string;
  keyTerms: { term: string; definition: string }[];
  actionItems: string[];
  createdAt: string;
}

export interface CreateScenarioRequest {
  situationType: string;
  nativeLanguage: Language;
  targetLanguage: Language;
  documentId?: string;
}

export interface ChatTurnRequest {
  sessionId: string;
  text: string;
  language: Language;
}

export interface HelpSuggestionDTO {
  id: string;
  suggestedText: string;
}

export interface PhraseEntryDTO {
  keyPhrase: string;
  suggestedText: string;
  lookupCount: number;
  lastLookedUpAt: string;
  practiceCount: number;
}

export type MetricBand = "low" | "mid" | "high";

// Evidence behind a metric, shown when the user taps through. Deliberately
// the user's own words rather than a description of their behaviour -- fewer
// characters to read and far more convincing. Each metric carries its own
// shape, so MetricDTO is generic over it.
export interface IndependenceEvidenceDTO {
  // Things they most often needed help saying, most frequent first.
  strugglePhrases: { phrase: string; count: number }[];
  // A turn they produced entirely on their own -- the counterweight to
  // systematically underestimating themselves.
  bestUnaidedTurn: string | null;
  // Raw number of times the help panel was opened. Distinct from the score,
  // which counts *turns* that leaned on it -- this keeps the magnitude that
  // turn-counting discards (asking once vs six times on one sentence).
  helpRequestCount: number;
  // Times they asked someone to repeat or explain. Shown as a win, not a
  // failure: it's the behaviour the app exists to build.
  clarificationCount: number;
  // Moments where a question got a dodge instead of an answer, quoted
  // verbatim. "kind" distinguishes not following the question ("could you
  // say that again?" is the right rescue) from understanding it but not
  // having the answer ("I'm not sure" needs a different rescue entirely --
  // repeating the question back wouldn't have helped).
  nonAnswerMoments: { question: string; reply: string; kind: "unclear" | "unsure" }[];
}

export interface CoverageEvidenceDTO {
  // One entry per scenario in the current window, whether or not anything is
  // left to practise -- a fully-mastered scenario still needs to show up here,
  // not disappear once it has nothing remaining.
  scenarios: {
    scenarioId: string;
    scenarioTitle: string;
    covered: number;
    total: number;
    band: MetricBand;
    bandLabel: string;
    remaining: string[];
  }[];
}

export interface MetricDTO<E> {
  value: number;
  band: MetricBand;
  // Short, honest phrase ("getting there") -- not a count. The exact fraction
  // lives in count/total instead of being stuffed into this string.
  bandLabel: string;
  // The exact numerator/denominator behind `value`, for displaying a precise
  // fraction (e.g. a ring's center text) rather than a rounded percentage.
  count: number;
  total: number;
  // The same metric over the preceding window, for the trend marker. Null
  // until there's enough history to compare against.
  previous: number | null;
  evidence: E;
}

// Coverage lands in a later pass. `ready` is false until there's enough
// history for any number to mean anything, and nothing renders in that case.
export interface MetricsDTO {
  ready: boolean;
  independence: MetricDTO<IndependenceEvidenceDTO> | null;
  coverage: MetricDTO<CoverageEvidenceDTO> | null;
}

export interface ScenarioSessionSummaryDTO {
  id: string;
  attemptNumber: number;
  status: "active" | "completed";
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
}

export interface ScenarioListItemDTO extends ScenarioDTO {
  latestStatus: "active" | "completed";
  latestStartedAt: string;
  attemptCount: number;
  // Both 0 until the first session ends and a checklist exists.
  checklistTotal: number;
  checklistCovered: number;
}
