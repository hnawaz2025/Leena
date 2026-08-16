import { Router } from "express";
import { z } from "zod";
import type { ChecklistItemDTO, FeedbackReportDTO, SessionDTO, TurnDTO } from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

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
  audioUrl: string | null;
  language: string;
  createdAt: Date;
}): TurnDTO {
  return {
    id: turn.id,
    sessionId: turn.sessionId,
    speaker: turn.speaker as "user" | "agent",
    text: turn.text,
    audioUrl: turn.audioUrl,
    language: turn.language,
    createdAt: turn.createdAt.toISOString(),
  };
}

const sessionPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// A full practice conversation easily exceeds a 20-turn default, and the
// Conversation screen needs the whole transcript to render, not a page of it.
const turnPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

sessionsRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = sessionPaginationSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const sessions = await prisma.session.findMany({
      where: { userId: req.userId! },
      orderBy: { startedAt: "desc" },
      include: { scenario: true },
      take: parsed.data.limit,
      skip: parsed.data.offset,
    });
    res.json(sessions.map(sessionToDTO));
  })
);

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

    const userTurn = await prisma.turn.create({
      data: {
        sessionId: session.id,
        speaker: "user",
        text: parsed.data.text,
        language: parsed.data.language,
        fromSuggestion: parsed.data.fromSuggestion,
      },
    });

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

    // chatTurn internally caps how much of this history it actually sends to
    // the model (see MAX_HISTORY_TURNS_FOR_CHAT in featherlessLLMProvider.ts)
    // so cost/context-window usage doesn't grow unbounded with session length.
    const result = await getLLMProvider().chatTurn({
      personaDescription: session.scenario.personaDescription,
      contextSummary: session.scenario.contextSummary,
      targetLanguage: session.scenario.language,
      history: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      userText: parsed.data.text,
      focusItems,
    });

    const agentTurn = await prisma.turn.create({
      data: {
        sessionId: session.id,
        speaker: "agent",
        text: result.agentText,
        language: session.scenario.language,
      },
    });

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

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { status: "completed", endedAt: new Date() },
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
