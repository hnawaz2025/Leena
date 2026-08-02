import OpenAI from "openai";
import { callForJson } from "../jsonRetry";
import { analyzeSessionResultSchema, generatedScenarioSchema } from "../schemas";
import type {
  AnalyzeSessionInput,
  AnalyzeSessionResult,
  ChatTurnInput,
  ChatTurnResult,
  GenerateScenarioInput,
  GeneratedScenario,
  LLMProvider,
} from "../types";

// A long conversation grows the prompt (and cost) on every single turn if we
// send the whole history. This also matters more here than on Anthropic:
// Featherless's Chat plan caps context at 32K tokens.
const MAX_HISTORY_TURNS_FOR_CHAT = 16;
const MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS = 40;

// Featherless (https://featherless.ai) proxies 40,000+ open-weight models
// (DeepSeek, Kimi, GLM, GPT-OSS, ...) behind an OpenAI-compatible API. The
// exact model id (e.g. "deepseek-ai/DeepSeek-R1-0528") and its concurrency
// cost are chosen by FEATHERLESS_MODEL rather than hardcoded here, since
// larger models consume more of the plan's limited concurrent request units
// -- check the model's page on Featherless's dashboard before picking one for
// a live demo.
export class FeatherlessLLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL: "https://api.featherless.ai/v1" });
    this.model = model;
  }

  async generateScenario(input: GenerateScenarioInput): Promise<GeneratedScenario> {
    const buildPrompt = (correctionNote?: string) => `You are designing a roleplay scenario to help an immigrant practice a real-life
conversation in ${input.targetLanguage}. Their native language is ${input.nativeLanguage}.
Situation type: "${input.situationType}".
${input.documentText ? `Ground the scenario in this uploaded document:\n"""${input.documentText}"""` : ""}

Return ONLY a JSON object with keys: title, personaDescription (who the AI will roleplay as, e.g. "a landlord named Mr. Chen"), contextSummary (2-3 sentences of situational context), openingLine (what the persona says first, in ${input.targetLanguage}), keyVocabulary (array of 5-8 useful words/phrases in ${input.targetLanguage}).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(generatedScenarioSchema, async (correctionNote) => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.choices[0]?.message?.content ?? "";
    });
  }

  async chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
    const systemPrompt = `You are roleplaying as: ${input.personaDescription}.
Context: ${input.contextSummary}
Speak only in ${input.targetLanguage}. Stay in character. Keep responses short and natural, like real spoken conversation.`;

    const recentHistory = input.history.slice(-MAX_HISTORY_TURNS_FOR_CHAT);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory.map((turn) => ({
          role: turn.speaker === "user" ? ("user" as const) : ("assistant" as const),
          content: turn.text,
        })),
        { role: "user" as const, content: input.userText },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.choices[0]?.message?.content ?? "";
    });
  }
}
