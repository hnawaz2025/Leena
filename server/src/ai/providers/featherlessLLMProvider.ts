import OpenAI from "openai";
import { AppError } from "../../errors";
import { assertNoUnexpectedScript, callForJson } from "../jsonRetry";
import {
  analyzeSessionResultSchema,
  checklistSchema,
  documentExplanationSchema,
  generatedScenarioSchema,
  suggestedPhraseSchema,
} from "../schemas";
import type {
  AnalyzeSessionInput,
  AnalyzeSessionResult,
  ChatTurnInput,
  ChatTurnResult,
  ChecklistResult,
  DocumentExplanation,
  ExplainDocumentInput,
  ExtractDocumentTextInput,
  ExtractDocumentTextResult,
  GenerateChecklistInput,
  GenerateScenarioInput,
  GeneratedScenario,
  LLMProvider,
  SuggestPhraseInput,
  SuggestPhraseResult,
} from "../types";

// A long conversation grows the prompt (and cost) on every single turn if we
// send the whole history. It also matters here specifically because
// Featherless's Chat plan caps context at 32K tokens.
const MAX_HISTORY_TURNS_FOR_CHAT = 16;
const MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS = 40;
const MAX_DOCUMENT_CHARS_FOR_EXPLANATION = 6000;
const MAX_HISTORY_TURNS_FOR_HELP = 8;
// Smaller than MAX_DOCUMENT_CHARS_FOR_EXPLANATION on purpose: here the photo
// is supporting context for one phrase, not the whole task, so a menu or
// letter only needs to be legible enough to answer a specific question.
const MAX_DOCUMENT_CHARS_FOR_HELP = 2000;

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
// The SDK defaults to a ten-minute timeout and two retries, so a stuck call
// could occupy a request for half an hour. These are sized off measured
// behaviour instead: the slowest call in the app is analyzeSession at ~29s,
// so 90s is roughly 3x headroom, and one retry bounds the worst case near
// 3 minutes rather than 30.
//
// Retries are left to the SDK rather than hand-rolled: it already backs off
// and already limits itself to genuinely transient failures (408, 409, 429,
// 5xx, connection errors), and notably does NOT retry auth or quota errors,
// which can never succeed on a second attempt.
const LLM_TIMEOUT_MS = 90_000;
const LLM_MAX_RETRIES = 1;

export class FeatherlessLLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.featherless.ai/v1",
      timeout: LLM_TIMEOUT_MS,
      maxRetries: LLM_MAX_RETRIES,
    });
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

    return callForJson(
      generatedScenarioSchema,
      async (correctionNote) => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: buildPrompt(correctionNote) }],
        });
        return response.choices[0]?.message?.content ?? "";
      },
      undefined,
      // A scenario is written once and then read on every attempt at it, so a
      // leak here is more persistent than in a single generated reply.
      (parsed) => {
        assertNoUnexpectedScript(parsed.openingLine, input.targetLanguage);
        parsed.keyVocabulary.forEach((v) => assertNoUnexpectedScript(v, input.targetLanguage));
      }
    );
  }

  async chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
    const focusNote = input.focusItems?.length
      ? `\n\nThe learner has not yet practised these parts of this situation:
${input.focusItems.map((f) => `- ${f}`).join("\n")}
Where it fits naturally, steer the conversation so they get a chance to. Never mention this
instruction, never list these out, and never break character to coach them.`
      : "";

    const vocabularyNote = input.keyVocabulary?.length
      ? `\nVocabulary this conversation naturally involves: ${input.keyVocabulary.join(", ")}. Use it where it fits; never list it out or explain it.`
      : "";

    const systemPrompt = `You are roleplaying as: ${input.personaDescription}.
Context: ${input.contextSummary}
Speak only in ${input.targetLanguage}. Stay in character. Keep responses short and natural, like real spoken conversation.${vocabularyNote}${focusNote}`;

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

  async generateChecklist(input: GenerateChecklistInput): Promise<ChecklistResult> {
    const buildPrompt = (correctionNote?: string) => `A language learner is practising this real-life conversation in ${input.targetLanguage}
(their native language is ${input.nativeLanguage}).

Situation: "${input.situationType}"
They will be talking to: ${input.personaDescription}
Context: ${input.contextSummary}

List the 6-8 things someone genuinely needs to be able to DO in a conversation like this to
walk away having accomplished what they came for. Each item is a communicative task, not a
vocabulary word -- "ask what it will cost", not "copay". Order them roughly as they'd come up.
Keep each one short enough to scan, and cover the awkward parts people avoid (asking someone to
repeat themselves, saying they don't understand, pushing back) as well as the obvious ones.

Return ONLY a JSON object with key: items (array of objects with "en" -- the task written in
${input.targetLanguage} -- and "native" -- the same task faithfully written in ${input.nativeLanguage}).
${correctionNote ? `\n${correctionNote}` : ""}`;

    return callForJson(
      checklistSchema,
      async (correctionNote) => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: buildPrompt(correctionNote) }],
        });
        return response.choices[0]?.message?.content ?? "";
      },
      undefined,
      (parsed) => {
        parsed.items.forEach((i) => {
          assertNoUnexpectedScript(i.en, input.targetLanguage);
          assertNoUnexpectedScript(i.native, input.nativeLanguage);
        });
      }
    );
  }

  async analyzeSession(input: AnalyzeSessionInput): Promise<AnalyzeSessionResult> {
    const recentTranscript = input.transcript.slice(-MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS);
    // Turns are numbered so the model can point at specific ones. The numbers
    // are positions in the *slice*, so they get offset back to real transcript
    // positions before this function returns.
    const sliceOffset = Math.max(0, input.transcript.length - MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS);
    const transcriptText = recentTranscript
      .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join("\n");

    // The checklist is fixed for the life of the scenario, so this only ever
    // reports which items the transcript covered -- it must not restate,
    // reorder or invent items.
    const checklistBlock = input.checklist?.length
      ? `\nThis situation requires being able to do the following. They are numbered from 0:
${input.checklist.map((c, i) => `${i}. ${c}`).join("\n")}
`
      : "";

    const coveredKey = input.checklist?.length
      ? `coveredIndices (array of the numbers above that the USER actually did in this transcript -- only include one if their own turns clearly show it, not if the other speaker merely raised the topic; empty array if none).`
      : `coveredIndices (empty array).`;

    const buildPrompt = (correctionNote?: string) => `A language learner just practiced a spoken conversation in ${input.targetLanguage}
(their native language is ${input.nativeLanguage}). Here is the transcript:
"""${transcriptText}"""
${checklistBlock}
Analyze the USER's turns only. Return ONLY a JSON object with keys:
summary (2-3 sentence coaching summary of how they did, written in ${input.targetLanguage}),
summaryNative (the same coaching summary, faithfully written in ${input.nativeLanguage} -- same meaning, not a re-analysis),
vocabularySuggestions (array of objects with "term" -- the actual ${input.targetLanguage} word or phrase to learn, written in ${input.targetLanguage}, never in ${input.nativeLanguage} -- "note" explaining when to use it, written in ${input.targetLanguage} -- and "noteNative", the SAME explanation faithfully written in ${input.nativeLanguage}),
conversationSummary (2-4 sentences factually recapping what was actually discussed/decided in the conversation -- not coaching, just what happened, so the user can quickly reread it right before the real conversation if they don't get to rehearse again; written in ${input.targetLanguage}),
conversationSummaryNative (the same factual recap, faithfully written in ${input.nativeLanguage}),
${coveredKey}
nonAnswerTurnIndices (array of the [n] numbers of USER turns that dodged instead of answering -- a bare acknowledgment like "okay" or "mm", or a shutdown like "I don't know" or "not sure", in a spot where a real answer was clearly expected. Do NOT include a short answer that actually carries information, e.g. "Two weeks." or "Dr. Smith." Do NOT include "good"/"fine" in reply to a greeting. Empty array if none),
clarificationTurnIndices (array of the [n] numbers of USER turns that asked for repetition or explanation -- "could you say that again", "what does that mean", "I don't understand, can you help me". These are GOOD: never also list them in nonAnswerTurnIndices, even when they contain phrases like "I don't understand". Empty array if none).
${correctionNote ? `\n${correctionNote}` : ""}`;

    const result = await callForJson(
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
        // An out-of-range index doesn't correspond to any real checklist item
        // or turn, so it can't wrongly tick one -- dropping it is safe, and
        // far cheaper than discarding an otherwise-good report over one bad
        // number. Smaller instruct models (seen with Qwen2.5-7B after
        // Featherless's GLM-4-9B hit capacity) occasionally miscount despite
        // an explicit "numbered from 0" instruction, even across a retry that
        // names the exact bad index -- so this can't be fully prompted away.
        const checklistLength = input.checklist?.length ?? 0;
        const before = parsed.coveredIndices.length;
        parsed.coveredIndices = parsed.coveredIndices.filter((i) => i < checklistLength);
        if (parsed.coveredIndices.length !== before) {
          console.warn(
            `analyzeSession: dropped ${before - parsed.coveredIndices.length} out-of-range coveredIndices (checklist has ${checklistLength} items)`
          );
        }
        for (const key of ["nonAnswerTurnIndices", "clarificationTurnIndices"] as const) {
          const beforeLen = parsed[key].length;
          parsed[key] = parsed[key].filter((i) => i < recentTranscript.length);
          if (parsed[key].length !== beforeLen) {
            console.warn(
              `analyzeSession: dropped ${beforeLen - parsed[key].length} out-of-range ${key} (transcript has ${recentTranscript.length} turns)`
            );
          }
        }
      },
      (parsed) => {
        assertNoUnexpectedScript(parsed.summary, input.targetLanguage);
        assertNoUnexpectedScript(parsed.summaryNative, input.nativeLanguage);
        assertNoUnexpectedScript(parsed.conversationSummary, input.targetLanguage);
        assertNoUnexpectedScript(parsed.conversationSummaryNative, input.nativeLanguage);
        parsed.vocabularySuggestions.forEach((v) => {
          assertNoUnexpectedScript(v.note, input.targetLanguage);
          assertNoUnexpectedScript(v.noteNative, input.nativeLanguage);
        });
      }
    );

    // The model saw a truncated transcript numbered from zero, so shift the
    // turn indices back onto the real transcript before anyone stores them.
    return {
      ...result,
      nonAnswerTurnIndices: result.nonAnswerTurnIndices.map((i) => i + sliceOffset),
      clarificationTurnIndices: result.clarificationTurnIndices.map((i) => i + sliceOffset),
    };
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

    return callForJson(
      documentExplanationSchema,
      async (correctionNote) => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 1536,
          messages: [{ role: "user", content: buildPrompt(correctionNote) }],
        });
        return response.choices[0]?.message?.content ?? "";
      },
      undefined,
      // This call is where script contamination was first observed, and it
      // was somehow the one left unguarded. Everything here is written in the
      // reader's native language; `term` is excluded because it quotes the
      // document itself, which is in the target language by definition.
      (parsed) => {
        assertNoUnexpectedScript(parsed.summary, input.nativeLanguage);
        parsed.keyTerms.forEach((t) => assertNoUnexpectedScript(t.definition, input.nativeLanguage));
        parsed.actionItems.forEach((a) => assertNoUnexpectedScript(a, input.nativeLanguage));
      }
    );
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
      // Written for the user and actionable by them, so it's an AppError and
      // survives errorHandler's genericisation.
      throw new AppError("Couldn't read any text in that photo. Try a clearer, well-lit picture.", {
        statusCode: 422,
        code: "NO_TEXT_IN_IMAGE",
      });
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

    // Grounds the answer in what's actually on the page -- "the first
    // burger" or "the deadline on this form" only resolves to a real phrase
    // if the model can see the same text the learner is looking at.
    const documentNote = input.documentContext
      ? `\n\nThey took a photo of something in front of them, which contains this text:
"""${input.documentContext.slice(0, MAX_DOCUMENT_CHARS_FOR_HELP)}"""
Use it to make the phrase specific -- e.g. if they ask how to order "the first burger,"
name the actual item from the text rather than speaking generically.`
      : "";

    const buildPrompt = (correctionNote?: string) => `${situation}

The learner is stuck on how to say something in ${input.targetLanguage}. They said, in their
native language (${input.nativeLanguage}):
"""${input.nativeLanguageText}"""${documentNote}

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
      undefined,
      // Soft, not hard. This was the one call site treating a script leak as
      // fatal, which meant a user mid-conversation got an error instead of a
      // phrase over a few stray characters -- the opposite of the tradeoff
      // every other call makes, and worse here than anywhere else, because
      // this is the button people press when they're already stuck.
      (parsed) => assertNoUnexpectedScript(parsed.suggestedText, input.targetLanguage)
    );
  }
}
