import OpenAI, { toFile } from "openai";
import type { SpeechProvider, TranscribeInput, TranscribeResult } from "../types";

// Whisper's `language` hint alone isn't always enough to pick the right
// script for languages that share near-identical spoken form but different
// scripts (most notably Hindi vs Urdu -- "Hindustani" is effectively one
// spoken language split across Devanagari and Perso-Arabic script). Passing
// a short sample in the target script as Whisper's `prompt` reliably biases
// it toward that script; verified fix for Hindi audio coming back in Urdu
// script despite language: "hi" being set correctly.
const SCRIPT_BIAS_PROMPTS: Record<string, string> = {
  hi: "नमस्ते, मुझे अपनी समस्या के बारे में बात करनी है।",
};

// The SDK's own defaults are timeout: 600_000 (ten minutes) and maxRetries: 2,
// which on a request path means a dead call can hang for half an hour before
// anyone hears about it. Both are set explicitly here instead.
//
// Transcription gets the more generous retry budget of the two providers, and
// deliberately so: a failure here loses audio the user already spoke, and the
// only recovery is asking them to say it again -- which is precisely the thing
// this app exists to make less daunting. Attempts are short, so three of them
// still bound the request at roughly 135s.
const TRANSCRIBE_TIMEOUT_MS = 45_000;
const TRANSCRIBE_MAX_RETRIES = 2;

export class OpenAISpeechProvider implements SpeechProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      timeout: TRANSCRIBE_TIMEOUT_MS,
      maxRetries: TRANSCRIBE_MAX_RETRIES,
    });
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const file = await toFile(input.audio, `audio.${input.mimeType.split("/")[1] ?? "m4a"}`);
    const result = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: input.language,
      prompt: input.language ? SCRIPT_BIAS_PROMPTS[input.language] : undefined,
    });
    return { text: result.text };
  }
}
