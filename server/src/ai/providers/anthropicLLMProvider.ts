import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
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

const MODEL = "claude-sonnet-5";

// A long conversation grows the prompt (and cost) on every single turn if we
// send the whole history. This caps what's sent while keeping enough context
// for the persona to stay consistent within a normal-length practice session.
const MAX_HISTORY_TURNS_FOR_CHAT = 16;
const MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS = 60;

function extractJsonBlock(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected JSON in model output, got: ${raw}`);
  return match[0];
}

/**
 * Anthropic doesn't guarantee well-formed JSON from a prompt alone. This
 * calls the model, tries to parse+validate the response against the given
 * zod schema, and on failure retries once with an explicit correction
 * instruction before giving up.
 */
async function callForJson<T>(
  client: Anthropic,
  schema: z.ZodType<T>,
  buildMessages: (correctionNote?: string) => Anthropic.MessageParam[],
  options: { system?: string; maxTokens: number }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionNote =
      attempt === 0
        ? undefined
        : "Your previous response could not be parsed as valid JSON matching the required shape. Return ONLY a single valid JSON object, with no prose before or after it, and no markdown code fences.";

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: buildMessages(correctionNote),
      });

      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = JSON.parse(extractJsonBlock(text));
      return schema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `AI response did not match the expected shape after retry: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

export class AnthropicLLMProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateScenario(input: GenerateScenarioInput): Promise<GeneratedScenario> {
    const buildPrompt = (correctionNote?: string) => `You are designing a roleplay scenario to help an immigrant practice a real-life
conversation in ${input.targetLanguage}. Their native language is ${input.nativeLanguage}.
Situation type: "${input.situationType}".
${input.documentText ? `Ground the scenario in this uploaded document:\n"""${input.documentText}"""` : ""}

Return ONLY a JSON object with keys: title, personaDescription (who the AI will roleplay as, e.g. "a landlord named Mr. Chen"), contextSummary (2-3 sentences of situational context), openingLine (what the persona says first, in ${input.targetLanguage}), keyVocabulary (array of 5-8 useful words/phrases in ${input.targetLanguage}).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(this.client, generatedScenarioSchema, (correctionNote) => [
      { role: "user", content: buildPrompt(correctionNote) },
    ], { maxTokens: 1024 });
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

    return callForJson(this.client, analyzeSessionResultSchema, (correctionNote) => [
      { role: "user", content: buildPrompt(correctionNote) },
    ], { maxTokens: 2048 });
  }
}
