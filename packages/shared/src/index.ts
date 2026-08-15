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
  struggleAreas: string[];
  struggleAreasNative: string[];
  vocabularySuggestions: { term: string; note: string }[];
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
  mastered: boolean;
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
