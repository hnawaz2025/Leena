import { Router } from "express";
import { z } from "zod";
import type { DocumentExplanationDTO } from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

export const documentsRouter = Router();

// MVP: client sends already-extracted text (e.g. from on-device OCR or a text paste).
// File upload + server-side OCR/PDF parsing is planned for the document-upload milestone.
const createSchema = z.object({
  type: z.enum(["lease", "medical", "job-letter", "other"]),
  extractedText: z.string().min(1),
});

documentsRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const document = await prisma.document.create({
      data: {
        userId: req.userId!,
        type: parsed.data.type,
        extractedText: parsed.data.extractedText,
      },
    });

    res.status(201).json({ id: document.id, type: document.type });
  })
);

function explanationToDTO(explanation: {
  id: string;
  documentId: string;
  summary: string;
  keyTerms: unknown;
  actionItems: unknown;
  createdAt: Date;
}): DocumentExplanationDTO {
  return {
    id: explanation.id,
    documentId: explanation.documentId,
    summary: explanation.summary,
    keyTerms: explanation.keyTerms as { term: string; definition: string }[],
    actionItems: explanation.actionItems as string[],
    createdAt: explanation.createdAt.toISOString(),
  };
}

const explainQuerySchema = z.object({
  refresh: z.coerce.boolean().default(false),
});

// Generates a plain-language explanation of the document, separate from the
// roleplay/scenario flow -- some users just want to understand a confusing
// letter, not rehearse a conversation about it. Cached after first
// generation (?refresh=true to force a new one) since it costs an AI call.
documentsRouter.post(
  "/:id/explain",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = explainQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { user: true },
    });
    if (!document) return res.status(404).json({ error: "Document not found" });

    if (!parsed.data.refresh) {
      const existing = await prisma.documentExplanation.findUnique({
        where: { documentId: document.id },
      });
      if (existing) return res.json(explanationToDTO(existing));
    }

    const result = await getLLMProvider().explainDocument({
      documentText: document.extractedText,
      documentType: document.type,
      nativeLanguage: document.user.nativeLanguage,
    });

    const explanation = await prisma.documentExplanation.upsert({
      where: { documentId: document.id },
      update: {
        summary: result.summary,
        keyTerms: result.keyTerms,
        actionItems: result.actionItems,
      },
      create: {
        documentId: document.id,
        summary: result.summary,
        keyTerms: result.keyTerms,
        actionItems: result.actionItems,
      },
    });

    res.json(explanationToDTO(explanation));
  })
);
