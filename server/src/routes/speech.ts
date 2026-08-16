import { Router } from "express";
import { z } from "zod";
import { getSpeechProvider } from "../ai";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser } from "../middleware/deviceAuth";

// Audio in, text out. One direction only: speaking text aloud happens
// on-device via expo-speech, so there is no synthesis endpoint here.
//
// Audio arrives base64-encoded inside JSON rather than as multipart, which is
// what the 15mb body limit in index.ts is sized for -- base64 inflates the
// payload by roughly a third.
export const speechRouter = Router();

const transcribeSchema = z.object({
  audio: z.string().min(1), // base64-encoded audio file
  mimeType: z.string().min(1),
  language: z.string().optional(),
});

speechRouter.post(
  "/transcribe",
  requireUser,
  asyncHandler(async (req, res) => {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const audioBuffer = Buffer.from(parsed.data.audio, "base64");
    const result = await getSpeechProvider().transcribe({
      audio: audioBuffer,
      mimeType: parsed.data.mimeType,
      language: parsed.data.language,
    });

    res.json({ text: result.text });
  })
);
