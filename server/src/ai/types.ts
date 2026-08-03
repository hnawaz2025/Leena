import type { AnalyzeSessionResult, DocumentExplanation, GeneratedScenario } from "./schemas";
export type { GeneratedScenario, AnalyzeSessionResult, DocumentExplanation } from "./schemas";

export interface GenerateScenarioInput {
  situationType: string;
  nativeLanguage: string;
  targetLanguage: string;
  documentText?: string;
}

export interface ChatTurnInput {
  personaDescription: string;
  contextSummary: string;
  targetLanguage: string;
  history: { speaker: "user" | "agent"; text: string }[];
  userText: string;
}

export interface ChatTurnResult {
  agentText: string;
}

export interface AnalyzeSessionInput {
  targetLanguage: string;
  nativeLanguage: string;
  transcript: { speaker: "user" | "agent"; text: string }[];
}

export interface ExplainDocumentInput {
  documentText: string;
  documentType: string;
  nativeLanguage: string;
}

export interface LLMProvider {
  generateScenario(input: GenerateScenarioInput): Promise<GeneratedScenario>;
  chatTurn(input: ChatTurnInput): Promise<ChatTurnResult>;
  analyzeSession(input: AnalyzeSessionInput): Promise<AnalyzeSessionResult>;
  explainDocument(input: ExplainDocumentInput): Promise<DocumentExplanation>;
}

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  language?: string;
}

export interface TranscribeResult {
  text: string;
}

export interface SynthesizeInput {
  text: string;
  language: string;
}

export interface SynthesizeResult {
  audio: Buffer;
  mimeType: string;
}

export interface SpeechProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}
