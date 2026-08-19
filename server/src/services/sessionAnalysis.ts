import type { ChecklistItemDTO } from "@leena/shared";
import { Render } from "@renderinc/sdk";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";

// Everything that happens after a conversation ends: generate the scenario's
// checklist if this is the first attempt, analyse the transcript, and write
// the feedback report.
//
// Deliberately free of Express. It takes a session id and returns nothing, so
// the same function can be called from the request path, from a background
// task, or from a Render Workflow without any of them knowing about the
// others. That is the whole point of it living here rather than inline in the
// route -- moving this work off the request path was impossible while it was
// tangled up with `req` and `res`.
//
// Two model calls, 30-90s in total, which is why it must not block a response.

// Guards against paying for the same analysis twice. A user who taps "try
// again" while the first run is still going would otherwise start a second
// one, and both would write the same report.
//
// In-process only, so it holds for a single instance and not across a
// horizontally scaled deployment. That is an accepted limitation of running
// this in-process at all, and precisely what a real task queue (Render
// Workflows) would solve properly.
const inFlight = new Set<string>();

export function isAnalysisInFlight(sessionId: string): boolean {
  return inFlight.has(sessionId);
}

/**
 * Analyse a completed session and write its feedback report.
 *
 * Safe to call more than once: concurrent calls for the same session are
 * dropped, and a repeat call after a failure simply redoes the work. Callers
 * that want to avoid paying for a second analysis should check for an
 * existing report first.
 */
export async function runSessionAnalysis(sessionId: string): Promise<void> {
  if (inFlight.has(sessionId)) {
    // Logged rather than silent: this line is the evidence that a repeated
    // "try again" cost nothing. Without it, the only way to tell a skipped
    // run from a duplicate paid one is to read the provider's bill.
    console.log(`analysis: skipped ${sessionId}, already running`);
    return;
  }
  inFlight.add(sessionId);
  const startedAt = Date.now();
  console.log(`analysis: started ${sessionId}`);

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { scenario: true, turns: { orderBy: { createdAt: "asc" } }, user: true },
    });
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Generated lazily on the first attempt only: it keeps scenario creation
    // fast, and the list must stay identical across attempts or accumulated
    // coverage would be measured against a moving target.
    let checklist = session.scenario.checklist as ChecklistItemDTO[] | null;
    if (!checklist) {
      try {
        const generated = await getLLMProvider().generateChecklist({
          title: session.scenario.title,
          situationType: session.scenario.situationType,
          personaDescription: session.scenario.personaDescription,
          contextSummary: session.scenario.contextSummary,
          targetLanguage: session.scenario.language,
          nativeLanguage: session.user.nativeLanguage,
        });
        checklist = generated.items;
        await prisma.scenario.update({
          where: { id: session.scenario.id },
          data: { checklist },
        });
      } catch (error) {
        // The checklist is an enhancement, not a prerequisite for feedback --
        // never let it cost the user their whole report. Left null so the
        // next attempt tries again.
        console.warn(`Checklist generation failed for scenario ${session.scenario.id}:`, error);
      }
    }

    const analysis = await getLLMProvider().analyzeSession({
      targetLanguage: session.scenario.language,
      nativeLanguage: session.user.nativeLanguage,
      transcript: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      checklist: checklist?.map((c) => c.en),
    });

    const report = {
      summary: analysis.summary,
      summaryNative: analysis.summaryNative,
      vocabularySuggestions: analysis.vocabularySuggestions,
      conversationSummary: analysis.conversationSummary,
      conversationSummaryNative: analysis.conversationSummaryNative,
      coveredIndices: analysis.coveredIndices,
      nonAnswerTurnIndices: analysis.nonAnswerTurnIndices,
      clarificationTurnIndices: analysis.clarificationTurnIndices,
    };

    // Written last and in one statement, so the report only ever exists in a
    // complete state. The client polls on "does a report exist yet", so a
    // partially written one would read as finished.
    await prisma.feedbackReport.upsert({
      where: { sessionId: session.id },
      update: report,
      create: { sessionId: session.id, ...report },
    });

    console.log(`analysis: finished ${sessionId} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  } finally {
    inFlight.delete(sessionId);
  }
}

/**
 * Start an analysis without waiting for it.
 *
 * Dispatches to the Render Workflow when RENDER_API_KEY and
 * RENDER_WORKFLOW_TASK_SLUG are set, so analysis survives this instance
 * restarting mid-run and gets Render's own retry/backoff instead of the
 * hand-rolled kind below. Falls back to running in-process otherwise --
 * unconfigured is a valid deploy state, not an error.
 *
 * The rejection handler is not optional either way: an un-awaited promise
 * that rejects takes the whole process down on unhandled rejection, and both
 * paths run network calls to something that can fail. Failures are logged
 * and left alone -- the session stays completed with no report, which is
 * exactly the state POST /:id/end treats as "retry me".
 */
export function startSessionAnalysis(sessionId: string): void {
  const taskSlug = process.env.RENDER_WORKFLOW_TASK_SLUG;
  if (process.env.RENDER_API_KEY && taskSlug) {
    const render = new Render();
    void render.workflows.startTask(taskSlug, [sessionId]).catch((error) => {
      console.error(`Workflow dispatch failed for session ${sessionId}, falling back:`, error);
      return runSessionAnalysis(sessionId);
    }).catch((error) => {
      console.error(`Background analysis failed for session ${sessionId}:`, error);
    });
    return;
  }

  void runSessionAnalysis(sessionId).catch((error) => {
    console.error(`Background analysis failed for session ${sessionId}:`, error);
  });
}
