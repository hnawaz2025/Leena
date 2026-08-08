import Anthropic from "@anthropic-ai/sdk";
import { callForJson } from "../jsonRetry";
import { analyzeSessionResultSchema, documentExplanationSchema, generatedScenarioSchema } from "../schemas";
import type {
  AnalyzeSessionInput,
  AnalyzeSessionResult,
  ChatTurnInput,
  ChatTurnResult,
  DocumentExplanation,
  ExplainDocumentInput,
  ExtractDocumentTextInput,
  ExtractDocumentTextResult,
  GenerateScenarioInput,
  GeneratedScenario,
  LLMProvider,
} from "../types";

const MODEL = "claude-sonnet-5";

// A long conversation grows the prompt (and cost) on every single turn if we
// send the whole history. This caps what's sent while keeping enough context
// for the persona to stay consistent within a normal-length practice session.
const MAX_HISTORY_TURNS_FOR_CHAT = 16;
const MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS = 60;
const MAX_DOCUMENT_CHARS_FOR_EXPLANATION = 8000;

export class AnthropicLLMProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateScenario(input: GenerateScenarioInput): Promise<GeneratedScenario> {
    const buildPrompt = (correctionNote?: string) => `You are designing a roleplay scenario to help an immigrant practice a real-life
conversation in ${input.targetLanguage}. Their native language is ${input.nativeLanguage}.
Situation type: "${input.situationType}".
${input.documentText ? `Ground the scenario in this uploaded document, which belongs to the user (it is their lease, their medical notice, their letter -- not the persona's):\n"""${input.documentText}"""` : ""}

The user will play themselves -- the person actually dealing with this real-life situation.
You must invent a persona for the OTHER party in the conversation: the specific person the user
needs to talk to (e.g. the landlord, the doctor, the DMV clerk, the USCIS officer) -- never someone
in the same role as the user (never another tenant, another patient, another applicant).

Return ONLY a JSON object with keys: title, personaDescription (who the AI will roleplay as -- the other party, e.g. "a landlord named Mr. Chen" or "a doctor named Dr. Patel", never a role matching the user's own), contextSummary (2-3 sentences of situational context), openingLine (what the persona says first, in ${input.targetLanguage}), keyVocabulary (array of 5-8 useful words/phrases in ${input.targetLanguage}).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(generatedScenarioSchema, async (correctionNote) => {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.content.find((b) => b.type === "text")?.text ?? "";
    });
  }

  async chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
    const systemPrompt = `You are roleplaying as: ${input.personaDescription}.
Context: ${input.contextSummary}
Speak only in ${input.targetLanguage}. Stay in character. Keep responses short and natural, like real spoken conversation.`;

    const recentHistory = input.history.slice(-MAX_HISTORY_TURNS_FOR_CHAT);

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...recentHistory.map((turn) => ({
          role: turn.speaker === "user" ? ("user" as const) : ("assistant" as const),
          content: turn.text,
        })),
        { role: "user" as const, content: input.userText },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    if (!text.trim()) {
      throw new Error("AI returned an empty response for chatTurn");
    }
    return { agentText: text };
  }

  async analyzeSession(input: AnalyzeSessionInput): Promise<AnalyzeSessionResult> {
    const recentTranscript = input.transcript.slice(-MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS);
    const transcriptText = recentTranscript
      .map((t) => `${t.speaker.toUpperCase()}: ${t.text}`)
      .join("\n");

    const buildPrompt = (correctionNote?: string) => `A language learner just practiced a spoken conversation in ${input.targetLanguage}
(their native language is ${input.nativeLanguage}). Here is the transcript:
"""${transcriptText}"""

Analyze the USER's turns only. Return ONLY a JSON object with keys:
summary (2-3 sentence coaching summary), struggleAreas (array of short strings describing specific difficulties, e.g. "hesitated on past tense verbs"), vocabularySuggestions (array of objects with "term" and "note" fields, useful words/phrases the user should learn, with the note explaining when to use it, written in ${input.nativeLanguage} for clarity).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(analyzeSessionResultSchema, async (correctionNote) => {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.content.find((b) => b.type === "text")?.text ?? "";
    });
  }

  async explainDocument(input: ExplainDocumentInput): Promise<DocumentExplanation> {
    const truncatedText = input.documentText.slice(0, MAX_DOCUMENT_CHARS_FOR_EXPLANATION);

    const buildPrompt = (correctionNote?: string) => `You are helping an immigrant understand a confusing official document
(type: ${input.documentType}) in plain, simple language. Their native language is ${input.nativeLanguage}.

Document text:
"""${truncatedText}"""

Return ONLY a JSON object with keys:
summary (a short plain-language explanation of what this document says and what it means for the reader, written in ${input.nativeLanguage}),
keyTerms (array of objects with "term" (the confusing word/phrase as it appears in the document) and "definition" (a simple explanation of it, written in ${input.nativeLanguage})),
actionItems (array of short strings describing anything the reader needs to actually do, e.g. a deadline or required response, written in ${input.nativeLanguage}; empty array if there is nothing actionable).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(documentExplanationSchema, async (correctionNote) => {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1536,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.content.find((b) => b.type === "text")?.text ?? "";
    });
  }

  async extractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextResult> {
    const base64Image = input.image.toString("base64");
    const mediaType = input.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            {
              type: "text",
              text: "Transcribe all the text visible in this photo of a document exactly as it appears, preserving line breaks. Return only the transcribed text, nothing else.",
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    if (!text.trim()) {
      throw new Error("Couldn't read any text in that photo. Try a clearer, well-lit picture.");
    }
    return { text: text.trim() };
  }
}
