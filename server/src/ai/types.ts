// The contract between routes and whichever AI vendor is configured. Routes
// import from here and from ./index only -- never from a provider directly,
// which is what makes a vendor swap a one-file change.
//
// Input/result shapes live here; the zod schemas that actually validate model
// output live in ./schemas.
import type {
  AnalyzeSessionResult,
  ChecklistResult,
  DocumentExplanation,
  GeneratedScenario,
  StruggleCategory,
} from "./schemas";
export type {
  GeneratedScenario,
  AnalyzeSessionResult,
  ChecklistResult,
  DocumentExplanation,
  StruggleCategory,
} from "./schemas";

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
  // Words this conversation is expected to involve. Used to keep the persona
  // speaking the vocabulary the learner is preparing for -- it previously
  // reached the model only by accident, glued onto the end of contextSummary.
  keyVocabulary?: string[];
  // Checklist items the user hasn't handled yet. The persona is asked to
  // steer toward these, so a repeat attempt explores the gaps instead of
  // replaying the same conversation.
  focusItems?: string[];
}

export interface ChatTurnResult {
  agentText: string;
}

export interface GenerateChecklistInput {
  title: string;
  situationType: string;
  personaDescription: string;
  contextSummary: string;
  targetLanguage: string;
  nativeLanguage: string;
}

export interface AnalyzeSessionInput {
  targetLanguage: string;
  nativeLanguage: string;
  transcript: { speaker: "user" | "agent"; text: string }[];
  // The scenario's fixed checklist, in English. analyzeSession only reports
  // which of these the transcript covered -- it never edits the list.
  checklist?: string[];
}

export interface ExplainDocumentInput {
  documentText: string;
  documentType: string;
  nativeLanguage: string;
}

export interface ExtractDocumentTextInput {
  image: Buffer;
  mimeType: string;
}

export interface ExtractDocumentTextResult {
  text: string;
}

// personaDescription/contextSummary/history are absent for a standalone
// quick lookup (someone stuck in real life, not mid-rehearsal) -- the
// providers branch on that rather than inventing a fake roleplay context.
export interface SuggestPhraseInput {
  personaDescription?: string;
  contextSummary?: string;
  targetLanguage: string;
  history?: { speaker: "user" | "agent"; text: string }[];
  nativeLanguageText: string;
  nativeLanguage: string;
  // Text OCR'd from a photo taken alongside this request -- a menu, a sign,
  // a form -- so "help me order the first burger" can be answered against
  // what's actually on the page instead of guessed at from the question
  // alone.
  documentContext?: string;
  // keyPhrases this user has already been given. The model is asked to reuse
  // one verbatim when the new request means the same thing, so the phrasebook
  // groups paraphrases ("could you repeat that" / "could you say that again")
  // instead of listing them as separate entries.
  knownPhrases?: string[];
}

export interface SuggestPhraseResult {
  suggestedText: string;
  keyPhrase: string;
  category: StruggleCategory;
}

export interface LLMProvider {
  generateScenario(input: GenerateScenarioInput): Promise<GeneratedScenario>;
  chatTurn(input: ChatTurnInput): Promise<ChatTurnResult>;
  generateChecklist(input: GenerateChecklistInput): Promise<ChecklistResult>;
  analyzeSession(input: AnalyzeSessionInput): Promise<AnalyzeSessionResult>;
  explainDocument(input: ExplainDocumentInput): Promise<DocumentExplanation>;
  extractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextResult>;
  suggestPhrase(input: SuggestPhraseInput): Promise<SuggestPhraseResult>;
}

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  language?: string;
}

export interface TranscribeResult {
  text: string;
}

// Transcription only. Speaking text aloud is done on-device by expo-speech,
// which is free and instant -- paying a cloud API per character to read back
// text the app already has would be a poor trade.
export interface SpeechProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}
