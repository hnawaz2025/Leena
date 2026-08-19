import { task } from "@renderinc/sdk/workflows";
import { runSessionAnalysis } from "../services/sessionAnalysis";

// The Render Workflow entry point for post-session analysis. Wraps the same
// runSessionAnalysis used by the in-process fallback (see
// ../services/sessionAnalysis.ts) so the two paths can never drift -- this
// file adds durable retries and off-instance execution, nothing more.
export const analyzeSession = task(
  {
    name: "analyzeSession",
    retry: {
      maxRetries: 2,
      waitDurationMs: 5000,
      backoffScaling: 2,
    },
    timeoutSeconds: 180,
  },
  async function analyzeSession(sessionId: string): Promise<void> {
    await runSessionAnalysis(sessionId);
  }
);
