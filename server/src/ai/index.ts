import { AnthropicLLMProvider } from "./providers/anthropicLLMProvider";
import { OpenAISpeechProvider } from "./providers/openaiSpeechProvider";
import type { LLMProvider, SpeechProvider } from "./types";

export * from "./types";

let llmProvider: LLMProvider | null = null;
let speechProvider: SpeechProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (llmProvider) return llmProvider;

  const providerName = process.env.AI_LLM_PROVIDER ?? "anthropic";
  switch (providerName) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
      llmProvider = new AnthropicLLMProvider(apiKey);
      return llmProvider;
    }
    default:
      throw new Error(`Unknown AI_LLM_PROVIDER: ${providerName}`);
  }
}

export function getSpeechProvider(): SpeechProvider {
  if (speechProvider) return speechProvider;

  const providerName = process.env.AI_SPEECH_PROVIDER ?? "openai";
  switch (providerName) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
      speechProvider = new OpenAISpeechProvider(apiKey);
      return speechProvider;
    }
    default:
      throw new Error(`Unknown AI_SPEECH_PROVIDER: ${providerName}`);
  }
}
