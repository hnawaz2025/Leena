import { Router } from "express";
import { z } from "zod";
import type {
  ChecklistItemDTO,
  ScenarioDTO,
  ScenarioListItemDTO,
  ScenarioSessionSummaryDTO,
} from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

// A Scenario is a conversation the user needs to have (one doctor's
// appointment), not one rehearsal of it -- that's a Session. Creating one
// costs a model call, because the persona on the other side of the
// conversation has to be invented before anyone can practise against it.
export const scenariosRouter = Router();

const createSchema = z.object({
  situationType: z.string().min(1),
  documentId: z.string().uuid().optional(),
});

function toDTO(scenario: {
  id: string;
  title: string;
  situationType: string;
  personaDescription: string;
  contextSummary: string;
  openingLine: string;
  keyVocabulary: unknown;
  language: string;
  documentId: string | null;
  createdAt: Date;
}): ScenarioDTO {
  return {
    id: scenario.id,
    title: scenario.title,
    situationType: scenario.situationType,
    personaDescription: scenario.personaDescription,
    contextSummary: scenario.contextSummary,
    openingLine: scenario.openingLine,
    keyVocabulary: (scenario.keyVocabulary as string[] | null) ?? [],
    language: scenario.language,
    documentId: scenario.documentId,
    createdAt: scenario.createdAt.toISOString(),
  };
}

scenariosRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });

    let documentText: string | undefined;
    if (parsed.data.documentId) {
      const document = await prisma.document.findFirst({
        where: { id: parsed.data.documentId, userId: user.id },
      });
      if (!document) return res.status(404).json({ error: "Document not found" });
      documentText = document.extractedText;
    }

    const generated = await getLLMProvider().generateScenario({
      situationType: parsed.data.situationType,
      nativeLanguage: user.nativeLanguage,
      targetLanguage: user.targetLanguage,
      documentText,
    });

    const scenario = await prisma.scenario.create({
      data: {
        userId: user.id,
        documentId: parsed.data.documentId ?? null,
        title: generated.title,
        situationType: parsed.data.situationType,
        personaDescription: generated.personaDescription,
        contextSummary: generated.contextSummary,
        openingLine: generated.openingLine,
        keyVocabulary: generated.keyVocabulary,
        language: user.targetLanguage,
      },
    });

    res.status(201).json(toDTO(scenario));
  })
);

// Home screen is scenario-scoped, not session-scoped -- "Practice this again"
// creates a new Session per attempt, so listing raw Sessions would show one
// card per attempt. This lists one row per Scenario, with its latest
// session's status and a total attempt count, so repeated practice never
// looks like duplicate history.
scenariosRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const scenarios = await prisma.scenario.findMany({
      where: { userId: req.userId! },
      include: {
        sessions: { orderBy: { startedAt: "desc" }, include: { feedback: true } },
      },
    });

    const dtos: ScenarioListItemDTO[] = scenarios
      .filter((s) => s.sessions.length > 0)
      .map((s) => {
        const latest = s.sessions[0];
        const checklist = (s.checklist as ChecklistItemDTO[] | null) ?? [];
        const covered = new Set(
          s.sessions.flatMap((session) => (session.feedback?.coveredIndices as number[]) ?? [])
        );
        return {
          ...toDTO(s),
          latestStatus: latest.status as "active" | "completed",
          latestStartedAt: latest.startedAt.toISOString(),
          attemptCount: s.sessions.length,
          checklistTotal: checklist.length,
          checklistCovered: covered.size,
        };
      })
      .sort((a, b) => new Date(b.latestStartedAt).getTime() - new Date(a.latestStartedAt).getTime());

    res.json(dtos);
  })
);

scenariosRouter.get(
  "/:id",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const scenario = await prisma.scenario.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });
    res.json(toDTO(scenario));
  })
);

// Removes the scenario and everything session-scoped under it (turns,
// feedback). Phrases the user picked up survive -- see the SetNull on
// TranslationAssistEvent.session.
scenariosRouter.delete(
  "/:id",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const scenario = await prisma.scenario.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });

    await prisma.scenario.delete({ where: { id: scenario.id } });
    res.status(204).end();
  })
);

scenariosRouter.get(
  "/:id/sessions",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const scenario = await prisma.scenario.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });

    const sessions = await prisma.session.findMany({
      where: { scenarioId: scenario.id },
      orderBy: { startedAt: "asc" },
      include: { _count: { select: { turns: true } } },
    });

    const dtos: ScenarioSessionSummaryDTO[] = sessions.map((s, i) => ({
      id: s.id,
      attemptNumber: i + 1,
      status: s.status as "active" | "completed",
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
      turnCount: s._count.turns,
    }));

    res.json(dtos);
  })
);
