import { Router } from "express";
import { z } from "zod";
import type { FeedbackReportDTO, HelpSuggestionDTO, SessionDTO, TurnDTO } from "@leena/shared";
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

const turnSchema = z.object({ text: z.string().min(1), language: z.string().min(2) });

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
      },
    });

    // chatTurn internally caps how much of this history it actually sends to
    // the model (see MAX_HISTORY_TURNS_FOR_CHAT in anthropicLLMProvider.ts) so
    // cost/context-window usage doesn't grow unbounded with session length.
    const result = await getLLMProvider().chatTurn({
      personaDescription: session.scenario.personaDescription,
      contextSummary: session.scenario.contextSummary,
      targetLanguage: session.scenario.language,
      history: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      userText: parsed.data.text,
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

    // MVP runs this inline; the plan moves this to a Render Workflow task
    // (analyze_session) once the Workflows service is wired up, so it runs
    // off the request path.
    const analysis = await getLLMProvider().analyzeSession({
      targetLanguage: session.scenario.language,
      nativeLanguage: session.user.nativeLanguage,
      transcript: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
    });

    await prisma.feedbackReport.upsert({
      where: { sessionId: session.id },
      update: {
        summary: analysis.summary,
        struggleAreas: analysis.struggleAreas,
        vocabularySuggestions: analysis.vocabularySuggestions,
      },
      create: {
        sessionId: session.id,
        summary: analysis.summary,
        struggleAreas: analysis.struggleAreas,
        vocabularySuggestions: analysis.vocabularySuggestions,
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
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const feedback = await prisma.feedbackReport.findUnique({ where: { sessionId: session.id } });
    if (!feedback) return res.status(404).json({ error: "Feedback not ready yet" });

    const dto: FeedbackReportDTO = {
      id: feedback.id,
      sessionId: feedback.sessionId,
      summary: feedback.summary,
      struggleAreas: feedback.struggleAreas as string[],
      vocabularySuggestions: feedback.vocabularySuggestions as { term: string; note: string }[],
      createdAt: feedback.createdAt.toISOString(),
    };
    res.json(dto);
  })
);

const helpSchema = z.object({
  nativeLanguageText: z.string().min(1),
  nativeLanguage: z.string().min(2),
});

sessionsRouter.post(
  "/:id/help",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = helpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { scenario: true, turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Deliberately never touches Turn/chatTurn -- the persona must never see
    // or react to a help request, only the eventual normal Send.
    const result = await getLLMProvider().suggestPhrase({
      personaDescription: session.scenario.personaDescription,
      contextSummary: session.scenario.contextSummary,
      targetLanguage: session.scenario.language,
      history: session.turns.map((t) => ({ speaker: t.speaker as "user" | "agent", text: t.text })),
      nativeLanguageText: parsed.data.nativeLanguageText,
      nativeLanguage: parsed.data.nativeLanguage,
    });

    const event = await prisma.translationAssistEvent.create({
      data: {
        userId: req.userId!,
        sessionId: session.id,
        nativeLanguage: parsed.data.nativeLanguage,
        nativeLanguageText: parsed.data.nativeLanguageText,
        suggestedText: result.suggestedText,
      },
    });

    const dto: HelpSuggestionDTO = { id: event.id, suggestedText: event.suggestedText };
    res.status(201).json(dto);
  })
);

sessionsRouter.post(
  "/:id/help/:eventId/use",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const event = await prisma.translationAssistEvent.findFirst({
      where: { id: req.params.eventId, sessionId: req.params.id, userId: req.userId! },
    });
    if (!event) return res.status(404).json({ error: "Help suggestion not found" });

    await prisma.translationAssistEvent.update({
      where: { id: event.id },
      data: { wasUsed: true },
    });

    res.status(204).end();
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
