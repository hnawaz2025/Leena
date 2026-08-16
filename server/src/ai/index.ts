import { FeatherlessLLMProvider } from "./providers/featherlessLLMProvider";
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

  const providerName = process.env.AI_LLM_PROVIDER ?? "featherless";
  switch (providerName) {
    case "featherless": {
      const apiKey = process.env.FEATHERLESS_API_KEY;
      const model = process.env.FEATHERLESS_MODEL;
      if (!apiKey) throw new Error("FEATHERLESS_API_KEY is not set");
      if (!model) throw new Error("FEATHERLESS_MODEL is not set");
      llmProvider = new FeatherlessLLMProvider(apiKey, model);
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
