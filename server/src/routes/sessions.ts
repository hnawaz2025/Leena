import { Router } from "express";
import { z } from "zod";
import type { ChecklistItemDTO, FeedbackReportDTO, SessionDTO, TurnDTO } from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

// One attempt at rehearsing a scenario, and everything that happens inside
// it. The two routes worth reading carefully:
//
//   POST /:id/turns  -- the conversation loop. Writes the user's turn, asks
//                       the persona for a reply, writes that too.
//   POST /:id/end    -- teardown. Generates the scenario's checklist if this
//                       is the first attempt, then runs the analysis that
//                       every metric and the feedback screen read from.
//
// Both are slow by nature (one or two model calls each) and both currently
// run inline on the request path.
export const sessionsRouter = Router();

function sessionToDTO(session: {
  id: string;
  scenarioId: string;
  scenario: { title: string };
  startedAt: Date;
  endedAt: Date | null;
  status: string;
}): SessionDTO {
  return {
    id: session.id,
    scenarioId: session.scenarioId,
    scenarioTitle: session.scenario.title,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    status: session.status as "active" | "completed",
  };
}

function turnToDTO(turn: {
  id: string;
  sessionId: string;
  speaker: string;
  text: string;
  language: string;
  createdAt: Date;
}): TurnDTO {
  return {
    id: turn.id,
    sessionId: turn.sessionId,
    speaker: turn.speaker as "user" | "agent",
    text: turn.text,
    language: turn.language,
    createdAt: turn.createdAt.toISOString(),
  };
}

// A full practice conversation easily exceeds a 20-turn default, and the
// Conversation screen needs the whole transcript to render, not a page of it.
const turnPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({ scenarioId: z.string().uuid() });

sessionsRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const scenario = await prisma.scenario.findFirst({
      where: { id: parsed.data.scenarioId, userId: req.userId! },
    });
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });

    const session = await prisma.session.create({
      data: { userId: req.userId!, scenarioId: scenario.id },
    });

    // The persona speaks first. Real versions of these conversations open with
    // the other party talking -- a receptionist greets you, a landlord picks
    // up the phone -- and starting on a blank screen puts the burden of
    // opening on the person least equipped to carry it.
    //
    // Written on every attempt, not just the first: each session is its own
    // conversation and needs its own opening. Guarded because scenarios
    // created before openingLine existed have an empty string.
    if (scenario.openingLine.trim()) {
      await prisma.turn.create({
        data: {
          sessionId: session.id,
          speaker: "agent",
          text: scenario.openingLine,
          language: scenario.language,
        },
      });
    }

    res.status(201).json(sessionToDTO({ ...session, scenario }));
  })
);

const turnSchema = z.object({
  text: z.string().min(1),
  language: z.string().min(2),
  // Set by the client when this text came out of the help panel. See the
  // comment on Turn.fromSuggestion for why this is recorded rather than
  // inferred from the text afterwards.
  fromSuggestion: z.boolean().optional().default(false),
});

sessionsRouter.post(
  "/:id/turns",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = turnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { scenario: true, turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "active") return res.status(400).json({ error: "Session is not active" });

    // Nudge the persona toward whatever this scenario still hasn't exercised,
    // so a repeat attempt explores the gaps instead of replaying the same
    // conversation. Derived from prior attempts each turn, so it needs no
    // state about how this session was started.
    const checklist = session.scenario.checklist as ChecklistItemDTO[] | null;
    let focusItems: string[] | undefined;
    if (checklist?.length) {
      const priorReports = await prisma.feedbackReport.findMany({
        where: { session: { scenarioId: session.scenarioId } },
        select: { coveredIndices: true },
      });
      const covered = new Set(priorReports.flatMap((r) => r.coveredIndices as number[]));
      const remaining = checklist.filter((_, i) => !covered.has(i)).map((c) => c.en);
      if (remaining.length) focusItems = remaining;
    }

    // The model call happens BEFORE anything is written. Previously the user's
    // turn was saved first, so a failed AI call left it stranded in the
    // transcript with no reply -- and retrying saved it a second time.
    //
    // Note this is deliberately not a transaction wrapped around the AI call:
    // these run 2-30s, and holding a Postgres transaction open that long would
    // pin a pooled connection and take locks with it. Calling first and then
    // writing atomically gets the same guarantee without that cost. chatTurn
    // takes userText separately from history, so it doesn't need the turn to
    // be persisted to work.
    //
    // chatTurn internally caps how much of this history it actually sends to
    // the model (see MAX_HISTORY_TURNS_FOR_CHAT in featherlessLLMProvider.ts)
    // so cost/context-window usage doesn't grow unbounded with session length.
    const result = await getLLMProvider().chatTurn({
      personaDescription: session.scenario.personaDescription,
      contextSummary: session.scenario.contextSummary,
      targetLanguage: session.scenario.language,
      history: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      userText: parsed.data.text,
      keyVocabulary: (session.scenario.keyVocabulary as string[] | null) ?? undefined,
      focusItems,
    });

    // Timestamps are set explicitly rather than left to @default(now()).
    // Inside a transaction Postgres resolves CURRENT_TIMESTAMP to the
    // transaction's start time, so both rows would land on the same instant
    // and `orderBy: createdAt` could render the reply above the message it
    // answers.
    const now = Date.now();
    const [userTurn, agentTurn] = await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId: session.id,
          speaker: "user",
          text: parsed.data.text,
          language: parsed.data.language,
          fromSuggestion: parsed.data.fromSuggestion,
          createdAt: new Date(now),
        },
      }),
      prisma.turn.create({
        data: {
          sessionId: session.id,
          speaker: "agent",
          text: result.agentText,
          language: session.scenario.language,
          createdAt: new Date(now + 1),
        },
      }),
    ]);

    res.status(201).json({ userTurn: turnToDTO(userTurn), agentTurn: turnToDTO(agentTurn) });
  })
);

sessionsRouter.post(
  "/:id/end",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { scenario: true, turns: { orderBy: { createdAt: "asc" } }, user: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Ending is idempotent, and the guard is on the *work* rather than on
    // status. A plain `status !== "active"` check would be wrong in both
    // directions: it would 400 a harmless double-tap, and -- worse -- it would
    // permanently strand any session whose analysis threw after the status was
    // already flipped, since the retry that recovers it is also a second call.
    //
    // So: already has a report means the work is genuinely done, return it and
    // don't pay for the model again. Completed with no report means the last
    // attempt died partway, and this call is the retry.
    const existingReport = await prisma.feedbackReport.findUnique({
      where: { sessionId: session.id },
      select: { id: true },
    });
    if (session.status !== "active" && existingReport) {
      return res.json(sessionToDTO(session));
    }

    // Flipped before the analysis, not after, so no further turns can be
    // appended to a transcript that's already being analysed.
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { status: "completed", endedAt: session.endedAt ?? new Date() },
    });

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

    // MVP runs this inline; the plan moves this to a Render Workflow task
    // (analyze_session) once the Workflows service is wired up, so it runs
    // off the request path.
    const analysis = await getLLMProvider().analyzeSession({
      targetLanguage: session.scenario.language,
      nativeLanguage: session.user.nativeLanguage,
      transcript: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      checklist: checklist?.map((c) => c.en),
    });

    await prisma.feedbackReport.upsert({
      where: { sessionId: session.id },
      update: {
        summary: analysis.summary,
        summaryNative: analysis.summaryNative,
        vocabularySuggestions: analysis.vocabularySuggestions,
        conversationSummary: analysis.conversationSummary,
        conversationSummaryNative: analysis.conversationSummaryNative,
        coveredIndices: analysis.coveredIndices,
        nonAnswerTurnIndices: analysis.nonAnswerTurnIndices,
        clarificationTurnIndices: analysis.clarificationTurnIndices,
      },
      create: {
        sessionId: session.id,
        summary: analysis.summary,
        summaryNative: analysis.summaryNative,
        vocabularySuggestions: analysis.vocabularySuggestions,
        conversationSummary: analysis.conversationSummary,
        conversationSummaryNative: analysis.conversationSummaryNative,
        coveredIndices: analysis.coveredIndices,
        nonAnswerTurnIndices: analysis.nonAnswerTurnIndices,
        clarificationTurnIndices: analysis.clarificationTurnIndices,
      },
    });

    res.json(sessionToDTO({ ...updated, scenario: session.scenario }));
  })
);

sessionsRouter.get(
  "/:id/feedback",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { scenario: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const feedback = await prisma.feedbackReport.findUnique({ where: { sessionId: session.id } });
    if (!feedback) return res.status(404).json({ error: "Feedback not ready yet" });

    // Total coverage is derived, not stored: union what every attempt at this
    // scenario has covered, so nothing can drift out of step with its source.
    const siblingReports = await prisma.feedbackReport.findMany({
      where: { session: { scenarioId: session.scenarioId } },
      select: { coveredIndices: true },
    });
    const cumulative = new Set<number>();
    for (const report of siblingReports) {
      for (const index of report.coveredIndices as number[]) cumulative.add(index);
    }

    const dto: FeedbackReportDTO = {
      id: feedback.id,
      sessionId: feedback.sessionId,
      summary: feedback.summary,
      summaryNative: feedback.summaryNative,
      vocabularySuggestions: feedback.vocabularySuggestions as {
        term: string;
        note: string;
        noteNative: string;
      }[],
      conversationSummary: feedback.conversationSummary,
      conversationSummaryNative: feedback.conversationSummaryNative,
      checklist: (session.scenario.checklist as ChecklistItemDTO[] | null) ?? [],
      coveredIndices: feedback.coveredIndices as number[],
      cumulativeCoveredIndices: [...cumulative].sort((a, b) => a - b),
      createdAt: feedback.createdAt.toISOString(),
    };
    res.json(dto);
  })
);

sessionsRouter.get(
  "/:id/turns",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = turnPaginationSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const turns = await prisma.turn.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: parsed.data.limit,
      skip: parsed.data.offset,
    });
    res.json(turns.map(turnToDTO));
  })
);
