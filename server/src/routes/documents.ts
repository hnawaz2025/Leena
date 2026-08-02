import { Router } from "express";
import { z } from "zod";
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
