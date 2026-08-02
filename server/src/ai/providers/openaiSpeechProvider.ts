import OpenAI, { toFile } from "openai";
import type { SpeechProvider, SynthesizeInput, SynthesizeResult, TranscribeInput, TranscribeResult } from "../types";

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
