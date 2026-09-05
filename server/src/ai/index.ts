import { OpenAICompatibleLLMProvider } from "./providers/openAICompatibleLLMProvider";
import { OpenAISpeechProvider } from "./providers/openaiSpeechProvider";
import type { LLMProvider, SpeechProvider } from "./types";

// The only way routes get at a model. Returning the interface rather than a
// concrete class is what kept the Anthropic removal to zero route changes.
//
// Memoised per process: constructing a provider builds an HTTP client, and
// there is no reason for each request to build its own. The `default:` throws
// are unreachable in practice (env.ts validates these values at boot and
// exits) but are kept so a direct call in a script fails loudly rather than
// returning undefined.

export * from "./types";

let llmProvider: LLMProvider | null = null;
let speechProvider: SpeechProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (llmProvider) return llmProvider;

  const providerName = process.env.AI_LLM_PROVIDER ?? "openai";
  switch (providerName) {
    // OpenAI directly. Its JSON mode is enabled, which removes the "returned
    // prose instead of JSON" failure class outright -- the open-weight
    // proxies could not offer that.
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
      const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      // Logged at boot because a misconfigured provider is otherwise invisible
      // from outside: errorHandler deliberately replaces the upstream message,
      // so "which vendor is this deploy actually talking to" can only be
      // answered from the logs. Never logs the key.
      console.log(`LLM provider: openai (model ${openaiModel})`);
      llmProvider = new OpenAICompatibleLLMProvider({
        apiKey,
        model: openaiModel,
        // Same family, and it reads photographed documents, so there is no
        // reason to run a second vendor just for vision.
        visionModel: process.env.OPENAI_VISION_MODEL ?? openaiModel,
        jsonMode: true,
      });
      return llmProvider;
    }

    // Kept because it costs almost nothing to keep: the same class with a
    // different base URL. No JSON mode -- most proxies do not implement it.
    case "featherless": {
      const apiKey = process.env.FEATHERLESS_API_KEY;
      const model = process.env.FEATHERLESS_MODEL;
      if (!apiKey) throw new Error("FEATHERLESS_API_KEY is not set");
      if (!model) throw new Error("FEATHERLESS_MODEL is not set");
      console.log(`LLM provider: featherless (model ${model})`);
      llmProvider = new OpenAICompatibleLLMProvider({
        apiKey,
        model,
        visionModel: process.env.FEATHERLESS_VISION_MODEL ?? "Qwen/Qwen3-VL-8B-Instruct",
        baseURL: "https://api.featherless.ai/v1",
      });
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
