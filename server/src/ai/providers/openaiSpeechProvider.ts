import OpenAI, { toFile } from "openai";
import type { SpeechProvider, SynthesizeInput, SynthesizeResult, TranscribeInput, TranscribeResult } from "../types";

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

export class OpenAISpeechProvider implements SpeechProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
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

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const response = await this.client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: input.text,
    });
    const arrayBuffer = await response.arrayBuffer();
    return { audio: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
  }
}
