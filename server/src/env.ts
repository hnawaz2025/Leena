import { z } from "zod";

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.string().optional(),
  AI_LLM_PROVIDER: z.enum(["anthropic", "featherless"]).default("anthropic"),
  AI_SPEECH_PROVIDER: z.enum(["openai"]).default("openai"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Not required at boot: nothing calls the speech provider yet (voice is a
  // planned milestone, not built). It's validated lazily by getSpeechProvider()
  // itself, so it'll fail loudly the moment a route actually needs it instead
  // of blocking the whole server from starting today.
  OPENAI_API_KEY: z.string().optional(),
  FEATHERLESS_API_KEY: z.string().optional(),
  FEATHERLESS_MODEL: z.string().optional(),
});

const envSchema = baseSchema.superRefine((env, ctx) => {
  if (env.AI_LLM_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["ANTHROPIC_API_KEY"],
      message: "ANTHROPIC_API_KEY is required when AI_LLM_PROVIDER=anthropic",
    });
  }
  if (env.AI_LLM_PROVIDER === "featherless") {
    if (!env.FEATHERLESS_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["FEATHERLESS_API_KEY"],
        message: "FEATHERLESS_API_KEY is required when AI_LLM_PROVIDER=featherless",
      });
    }
    if (!env.FEATHERLESS_MODEL) {
      ctx.addIssue({
        code: "custom",
        path: ["FEATHERLESS_MODEL"],
        message:
          "FEATHERLESS_MODEL is required when AI_LLM_PROVIDER=featherless (e.g. a DeepSeek model id from your Featherless dashboard). Check that model's concurrency-unit cost before using it in a live demo.",
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}
