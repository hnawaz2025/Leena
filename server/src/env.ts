import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.string().optional(),
  AI_LLM_PROVIDER: z.enum(["anthropic"]).default("anthropic"),
  AI_SPEECH_PROVIDER: z.enum(["openai"]).default("openai"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
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
