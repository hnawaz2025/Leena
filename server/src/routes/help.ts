import { Router } from "express";
import { z } from "zod";
import type { HelpSuggestionDTO, PhraseEntryDTO } from "@leena/shared";
import { getLLMProvider } from "../ai";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

export const helpRouter = Router();

// One endpoint for both ways a user gets stuck: mid-rehearsal (sessionId
// present, so the suggestion fits the persona and what's been said) and out
// in the real world (no sessionId, no roleplay). Deliberately not two routes
// -- the handler is nearly all shared, and the phrase/category tagging that
// feeds the phrasebook must not be maintained in two places.
const helpSchema = z.object({
  nativeLanguageText: z.string().min(1),
  nativeLanguage: z.string().min(2),
  sessionId: z.string().uuid().optional(),
});

// Caps how much of the user's phrase history gets fed back into the prompt
// for grouping. Enough to catch the phrases anyone actually repeats, without
// the prompt growing unbounded as they use the app.
const MAX_KNOWN_PHRASES_FOR_GROUPING = 30;

helpRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = helpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });

    let roleplayContext = {};
    if (parsed.data.sessionId) {
      const session = await prisma.session.findFirst({
        where: { id: parsed.data.sessionId, userId: req.userId! },
        include: { scenario: true, turns: { orderBy: { createdAt: "asc" } } },
      });
      if (!session) return res.status(404).json({ error: "Session not found" });

      roleplayContext = {
        personaDescription: session.scenario.personaDescription,
        contextSummary: session.scenario.contextSummary,
        history: session.turns.map((t) => ({
          speaker: t.speaker as "user" | "agent",
          text: t.text,
        })),
      };
    }

    // Show the model what this user has already been given so paraphrases of
    // the same need collapse into one phrasebook entry instead of piling up.
    const known = await prisma.translationAssistEvent.findMany({
      where: { userId: req.userId!, keyPhrase: { not: "" } },
      distinct: ["keyPhrase"],
      orderBy: { createdAt: "desc" },
      take: MAX_KNOWN_PHRASES_FOR_GROUPING,
      select: { keyPhrase: true },
    });

    // Never touches Turn/chatTurn -- the persona must not see or react to a
    // help request, only to what the user eventually chooses to send.
    const result = await getLLMProvider().suggestPhrase({
      ...roleplayContext,
      targetLanguage: user.targetLanguage,
      nativeLanguageText: parsed.data.nativeLanguageText,
      nativeLanguage: parsed.data.nativeLanguage,
      knownPhrases: known.map((k) => k.keyPhrase),
    });

    const event = await prisma.translationAssistEvent.create({
      data: {
        userId: req.userId!,
        sessionId: parsed.data.sessionId ?? null,
        nativeLanguage: parsed.data.nativeLanguage,
        nativeLanguageText: parsed.data.nativeLanguageText,
        suggestedText: result.suggestedText,
        keyPhrase: result.keyPhrase.trim().toLowerCase(),
        category: result.category,
      },
    });

    const dto: HelpSuggestionDTO = { id: event.id, suggestedText: event.suggestedText };
    res.status(201).json(dto);
  })
);

// A phrase counts as learned once it's gone this long without being looked
// up again. Deliberately derived rather than stored: no state to maintain and
// nothing to go stale. A rough heuristic worth revisiting once there's real
// outcome data to calibrate against.
const MASTERY_DAYS = 21;

// Lookups are surfaced as a phrasebook rather than a history, because a
// lookup is a phrase you acquired, not an event you did -- and because
// collapsing five lookups of the same phrase into one row with a count turns
// what would be noise into the actual signal.
helpRouter.get(
  "/phrases",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const events = await prisma.translationAssistEvent.findMany({
      where: { userId: req.userId!, keyPhrase: { not: "" } },
      orderBy: { createdAt: "desc" },
    });

    const masteryCutoff = Date.now() - MASTERY_DAYS * 24 * 60 * 60 * 1000;
    const byPhrase = new Map<string, PhraseEntryDTO>();

    // Events arrive newest-first, so the first sighting of a phrase is also
    // its most recent lookup.
    for (const event of events) {
      const existing = byPhrase.get(event.keyPhrase);
      if (existing) {
        existing.lookupCount += 1;
        continue;
      }
      byPhrase.set(event.keyPhrase, {
        keyPhrase: event.keyPhrase,
        suggestedText: event.suggestedText,
        lookupCount: 1,
        lastLookedUpAt: event.createdAt.toISOString(),
        mastered: event.createdAt.getTime() < masteryCutoff,
      });
    }

    const dtos = [...byPhrase.values()].sort((a, b) => b.lookupCount - a.lookupCount);
    res.json(dtos);
  })
);

// Fired when the user taps "Use this" mid-rehearsal or "I said it" after a
// real-world lookup -- in both cases a self-reported confirmation that the
// phrase actually got spoken.
helpRouter.post(
  "/:eventId/use",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const event = await prisma.translationAssistEvent.findFirst({
      where: { id: req.params.eventId, userId: req.userId! },
    });
    if (!event) return res.status(404).json({ error: "Help suggestion not found" });

    await prisma.translationAssistEvent.update({
      where: { id: event.id },
      data: { wasUsed: true },
    });

    res.status(204).end();
  })
);
