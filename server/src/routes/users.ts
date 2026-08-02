import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";

export const usersRouter = Router();

const identifySchema = z.object({
  deviceId: z.string().min(1),
  nativeLanguage: z.string().min(2),
  targetLanguage: z.string().min(2),
});

usersRouter.post(
  "/identify",
  asyncHandler(async (req, res) => {
    const parsed = identifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { deviceId, nativeLanguage, targetLanguage } = parsed.data;

    const user = await prisma.user.upsert({
      where: { deviceId },
      update: { nativeLanguage, targetLanguage },
      create: { deviceId, nativeLanguage, targetLanguage, authToken: randomBytes(32).toString("hex") },
    });

    res.json({
      id: user.id,
      authToken: user.authToken,
      nativeLanguage: user.nativeLanguage,
      targetLanguage: user.targetLanguage,
    });
  })
);
