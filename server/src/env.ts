import { z } from "zod";

// Environment validation, run once at boot from index.ts.
//
// The point is to fail on deploy rather than on a user's first request: a
// missing API key otherwise looks like a perfectly healthy server that 500s
// the moment someone tries to practise. Which keys are required depends on
// which providers are selected, hence the superRefine rather than a flat
// schema of required strings.
const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.string().optional(),
  AI_LLM_PROVIDER: z.enum(["featherless"]).default("featherless"),
  AI_SPEECH_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  FEATHERLESS_API_KEY: z.string().optional(),
  FEATHERLESS_MODEL: z.string().optional(),
  // Both optional and unvalidated together on purpose: session analysis
  // works in-process with neither set. When both are present, POST
  // /sessions/:id/end dispatches to the Render Workflow instead -- a
  // deploy-time upgrade, never a requirement.
  RENDER_API_KEY: z.string().optional(),
  RENDER_WORKFLOW_TASK_SLUG: z.string().optional(),
});

const envSchema = baseSchema.superRefine((env, ctx) => {
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
  if (env.AI_SPEECH_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["OPENAI_API_KEY"],
      message: "OPENAI_API_KEY is required when AI_SPEECH_PROVIDER=openai (used for Whisper transcription)",
    });
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
