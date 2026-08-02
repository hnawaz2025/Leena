import { Router } from "express";
import { z } from "zod";
import type { ScenarioDTO } from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

export const scenariosRouter = Router();

const createSchema = z.object({
  situationType: z.string().min(1),
  documentId: z.string().uuid().optional(),
});

function toDTO(scenario: {
  id: string;
  title: string;
  personaDescription: string;
  contextSummary: string;
  language: string;
  documentId: string | null;
  createdAt: Date;
}): ScenarioDTO {
  return {
    id: scenario.id,
    title: scenario.title,
    personaDescription: scenario.personaDescription,
    contextSummary: scenario.contextSummary,
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
        personaDescription: generated.personaDescription,
        contextSummary: `${generated.contextSummary}\n\nOpening line: ${generated.openingLine}\nKey vocabulary: ${generated.keyVocabulary.join(", ")}`,
        language: user.targetLanguage,
      },
    });

    res.status(201).json(toDTO(scenario));
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
