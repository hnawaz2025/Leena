import OpenAI from "openai";
import { assertNoUnexpectedScript, callForJson } from "../jsonRetry";
import {
  analyzeSessionResultSchema,
  documentExplanationSchema,
  generatedScenarioSchema,
  suggestedPhraseSchema,
} from "../schemas";
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
  SuggestPhraseInput,
  SuggestPhraseResult,
} from "../types";

// A long conversation grows the prompt (and cost) on every single turn if we
// send the whole history. This also matters more here than on Anthropic:
// Featherless's Chat plan caps context at 32K tokens.
const MAX_HISTORY_TURNS_FOR_CHAT = 16;
const MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS = 40;
const MAX_DOCUMENT_CHARS_FOR_EXPLANATION = 6000;
const MAX_HISTORY_TURNS_FOR_HELP = 8;

// The main FEATHERLESS_MODEL (e.g. GLM-4-9B-0414) is text-only. Document
// photo capture needs actual vision, so this is a separate, dedicated model
// rather than something the .env config controls -- Qwen3-VL-8B-Instruct
// was tested directly against a synthetic document image and transcribed it
// near-perfectly; "Instruct" (not "Thinking") avoids the reasoning-leak
// problem seen with other small reasoning models on this platform.
const VISION_MODEL = "Qwen/Qwen3-VL-8B-Instruct";

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
${input.documentText ? `Ground the scenario in this uploaded document, which belongs to the user (it is their lease, their medical notice, their letter -- not the persona's):\n"""${input.documentText}"""` : ""}

The user will play themselves -- the person actually dealing with this real-life situation.
You must invent a persona for the OTHER party in the conversation: the specific person the user
needs to talk to (e.g. the landlord, the doctor, the DMV clerk, the USCIS officer) -- never someone
in the same role as the user (never another tenant, another patient, another applicant).

Return ONLY a JSON object with keys: title, personaDescription (who the AI will roleplay as -- the other party, e.g. "a landlord named Mr. Chen" or "a doctor named Dr. Patel", never a role matching the user's own), contextSummary (2-3 sentences of situational context, referring to the person practicing as "the user" -- never as "the immigrant"), openingLine (what the persona says first, in ${input.targetLanguage}), keyVocabulary (array of 5-8 useful words/phrases in ${input.targetLanguage}).
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
summary (2-3 sentence coaching summary of how they did, written in ${input.targetLanguage}),
summaryNative (the same coaching summary, faithfully written in ${input.nativeLanguage} -- same meaning, not a re-analysis),
struggleAreas (array of short strings describing specific difficulties, e.g. "hesitated on past tense verbs", written in ${input.targetLanguage}),
struggleAreasNative (the SAME struggle areas, same order, same count, each faithfully written in ${input.nativeLanguage}),
vocabularySuggestions (array of objects with "term" -- the actual ${input.targetLanguage} word or phrase to learn, written in ${input.targetLanguage}, never in ${input.nativeLanguage} -- and "note" explaining when to use it, written in ${input.nativeLanguage} for clarity),
conversationSummary (2-4 sentences factually recapping what was actually discussed/decided in the conversation -- not coaching, just what happened, so the user can quickly reread it right before the real conversation if they don't get to rehearse again; written in ${input.targetLanguage}),
conversationSummaryNative (the same factual recap, faithfully written in ${input.nativeLanguage}).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(
      analyzeSessionResultSchema,
      async (correctionNote) => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 2048,
          messages: [{ role: "user", content: buildPrompt(correctionNote) }],
        });
        return response.choices[0]?.message?.content ?? "";
      },
      (parsed) => {
        assertNoUnexpectedScript(parsed.summary, input.targetLanguage);
        assertNoUnexpectedScript(parsed.summaryNative, input.nativeLanguage);
        assertNoUnexpectedScript(parsed.conversationSummary, input.targetLanguage);
        assertNoUnexpectedScript(parsed.conversationSummaryNative, input.nativeLanguage);
        parsed.struggleAreas.forEach((s) => assertNoUnexpectedScript(s, input.targetLanguage));
        parsed.struggleAreasNative.forEach((s) => assertNoUnexpectedScript(s, input.nativeLanguage));
        parsed.vocabularySuggestions.forEach((v) => assertNoUnexpectedScript(v.note, input.nativeLanguage));
        if (parsed.struggleAreas.length !== parsed.struggleAreasNative.length) {
          throw new Error(
            `struggleAreas (${parsed.struggleAreas.length}) and struggleAreasNative (${parsed.struggleAreasNative.length}) must be the same length`
          );
        }
      }
    );
  }

  async explainDocument(input: ExplainDocumentInput): Promise<DocumentExplanation> {
    const truncatedText = input.documentText.slice(0, MAX_DOCUMENT_CHARS_FOR_EXPLANATION);

    const buildPrompt = (correctionNote?: string) => `You are helping an immigrant understand a confusing official document
(type: ${input.documentType}) in plain, simple language. Their native language is ${input.nativeLanguage}.

Document text:
"""${truncatedText}"""

Return ONLY a JSON object with keys:
summary (a short plain-language explanation of what this document says and what it means for the reader, written in ${input.nativeLanguage}, referring to the reader as "you" or "the user" -- never as "the immigrant"),
keyTerms (array of objects with "term" (the confusing word/phrase as it appears in the document) and "definition" (a simple explanation of it, written in ${input.nativeLanguage})),
actionItems (array of short strings describing anything the reader needs to actually do, e.g. a deadline or required response, written in ${input.nativeLanguage}; empty array if there is nothing actionable).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(documentExplanationSchema, async (correctionNote) => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1536,
        messages: [{ role: "user", content: buildPrompt(correctionNote) }],
      });
      return response.choices[0]?.message?.content ?? "";
    });
  }

  async extractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextResult> {
    const base64Image = input.image.toString("base64");

    const response = await this.client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe all the text visible in this photo of a document exactly as it appears, preserving line breaks. Return only the transcribed text, nothing else.",
            },
            { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${base64Image}` } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new Error("Couldn't read any text in that photo. Try a clearer, well-lit picture.");
    }
    return { text: text.trim() };
  }

  async suggestPhrase(input: SuggestPhraseInput): Promise<SuggestPhraseResult> {
    const recentHistory = (input.history ?? []).slice(-MAX_HISTORY_TURNS_FOR_HELP);
    const historyText = recentHistory.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n");
    const inRoleplay = !!input.personaDescription;

    const situation = inRoleplay
      ? `You are a translation coach helping a language learner during a live roleplay
practice conversation. The learner is talking to: ${input.personaDescription}.
Context: ${input.contextSummary}
Recent conversation so far:
${historyText || "(nothing said yet)"}`
      : `You are a translation coach helping a language learner who is out in the real world
right now -- at a counter, in a classroom, on a phone call -- and needs to say something in
${input.targetLanguage} immediately. There is no roleplay and no conversation history.`;

    const guidance = inRoleplay
      ? `Give them natural, conversational ${input.targetLanguage} phrasing they could say next in THIS
conversation, appropriate for speaking to ${input.personaDescription} in this context. Match the
register and situation -- do not produce a textbook translation disconnected from the
conversation.`
      : `Give them natural, conversational ${input.targetLanguage} phrasing for what they want to say.
Assume a polite, everyday register that works with a stranger such as a clerk, teacher or
receptionist -- do not produce a stiff textbook translation.`;

    const knownPhrasesNote = input.knownPhrases?.length
      ? `; if this request means essentially the same thing as one of these phrases the learner has already looked up, reuse that string EXACTLY rather than inventing a new wording: ${input.knownPhrases.map((p) => `"${p}"`).join(", ")}`
      : "";

    const buildPrompt = (correctionNote?: string) => `${situation}

The learner is stuck on how to say something in ${input.targetLanguage}. They said, in their
native language (${input.nativeLanguage}):
"""${input.nativeLanguageText}"""

${guidance} Keep it to 1-2 short sentences, the way a real person would actually say it out loud.

Return ONLY a JSON object with keys:
suggestedText (the phrase in ${input.targetLanguage}, written naturally, no notes/explanations, no ${input.nativeLanguage} text mixed in),
keyPhrase (the same phrase reduced to a short canonical form for grouping repeats: lowercase, no trailing punctuation, e.g. "could you repeat that"${knownPhrasesNote}),
category (exactly one of: VOCABULARY = didn't know a specific word or phrase; GRAMMAR = tense or sentence structure; CONFIDENCE = hesitation or not knowing how to start; COMPREHENSION = didn't understand the other person; FORMALITY = unsure how polite or direct to be; DOMAIN_KNOWLEDGE = didn't understand a concept or process, not just a word).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(
      suggestedPhraseSchema,
      async (correctionNote) => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 400,
          messages: [{ role: "user", content: buildPrompt(correctionNote) }],
        });
        return response.choices[0]?.message?.content ?? "";
      },
      (parsed) => assertNoUnexpectedScript(parsed.suggestedText, input.targetLanguage)
    );
  }
}
