export type Language = string; // BCP-47 tag, e.g. "es", "en", "hi"

export type DocumentType = "lease" | "medical" | "job-letter" | "other";

export type Speaker = "user" | "agent";

export interface ScenarioDTO {
  id: string;
  title: string;
  personaDescription: string;
  contextSummary: string;
  language: Language;
  documentId: string | null;
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
  startedAt: string;
  endedAt: string | null;
  status: "active" | "completed";
}

export interface FeedbackReportDTO {
  id: string;
  sessionId: string;
  summary: string;
  struggleAreas: string[];
  vocabularySuggestions: { term: string; note: string }[];
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
