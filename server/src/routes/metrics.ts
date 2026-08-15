import { Router } from "express";
import type { ChecklistItemDTO, MetricsDTO } from "@leena/shared";
import { prisma } from "../db";
import { computeCoverage, type ScenarioForCoverage } from "../metrics/coverage";
import { computeIndependence, type SessionForMetrics } from "../metrics/independence";
import { computeRecovery } from "../metrics/recovery";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireUser, type AuthedRequest } from "../middleware/deviceAuth";

export const metricsRouter = Router();

// These numbers are noisy at small N -- after one six-turn conversation a
// single help request moves independence by seventeen points. Averaging over
// several recent sessions makes the number mean something, and comparing
// against the window before it is what produces the trend.
//
// A window rather than all history, because a lifetime average stops moving:
// someone fifty conversations in would be permanently weighed down by their
// first forty and the number could never show progress.
const WINDOW_SIZE = 5;

// Below this there isn't enough history for any number to be honest, so the
// whole strip stays hidden rather than showing a confident-looking figure
// built on a single conversation.
const MIN_SESSIONS_FOR_METRICS = 2;

// Coverage windows by scenario, not by session -- three attempts at the same
// doctor's appointment is one conversation to be ready for, not three. Same
// value as WINDOW_SIZE for consistency, kept as a separate name because it
// counts a different thing.
const SCENARIO_WINDOW_SIZE = 5;

metricsRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId!, status: "completed" },
      orderBy: { startedAt: "desc" },
      take: WINDOW_SIZE * 2,
      include: {
        turns: { orderBy: { createdAt: "asc" } },
        translationAssistEvents: true,
      },
    });

    if (sessions.length < MIN_SESSIONS_FOR_METRICS) {
      const empty: MetricsDTO = {
        ready: false,
        independence: null,
        recovery: null,
        coverage: null,
      };
      return res.json(empty);
    }

    // Coverage windows by scenario, so it needs its own query rather than the
    // recent-session window the other two share.
    const scenarios = await prisma.scenario.findMany({
      where: { userId: req.userId! },
      include: {
        sessions: {
          where: { status: "completed" },
          orderBy: { startedAt: "asc" },
          include: { feedback: { select: { coveredIndices: true } } },
        },
      },
    });

    // Only scenarios with a checklist and at least one completed attempt are
    // eligible -- a scenario nothing's been practised on yet isn't a failed
    // readiness check, it's just not evaluated. Ordered by latest activity so
    // the window reflects what the user is actually preparing for right now.
    const eligible = scenarios
      .filter(
        (s): s is typeof s & { checklist: NonNullable<typeof s.checklist> } =>
          Array.isArray(s.checklist) && s.checklist.length > 0 && s.sessions.length > 0
      )
      .map((s) => ({
        id: s.id,
        title: s.title,
        checklist: s.checklist as ChecklistItemDTO[],
        coveredIndices: [
          ...new Set(s.sessions.flatMap((session) => (session.feedback?.coveredIndices as number[]) ?? [])),
        ],
        latestSessionAt: s.sessions[s.sessions.length - 1].startedAt.getTime(),
      }))
      .sort((a, b) => b.latestSessionAt - a.latestSessionAt);

    const currentScenarios: ScenarioForCoverage[] = eligible.slice(0, SCENARIO_WINDOW_SIZE);
    const priorScenarios = eligible.slice(SCENARIO_WINDOW_SIZE, SCENARIO_WINDOW_SIZE * 2);
    const previousScenarios: ScenarioForCoverage[] =
      priorScenarios.length === SCENARIO_WINDOW_SIZE ? priorScenarios : [];

    const toMetricsShape = (s: (typeof sessions)[number]): SessionForMetrics => ({
      turns: s.turns.map((t) => ({
        speaker: t.speaker,
        text: t.text,
        fromSuggestion: t.fromSuggestion,
      })),
      helpEvents: s.translationAssistEvents.map((e) => ({
        keyPhrase: e.keyPhrase,
        suggestedText: e.suggestedText,
      })),
    });

    const current = sessions.slice(0, WINDOW_SIZE).map(toMetricsShape);

    // Only compare like with like. A partial previous window means the trend
    // would be measured against as little as one conversation while the current
    // value averages three -- a delta that looks authoritative and isn't. An
    // empty array makes every metric return null for `previous`, so the arrow
    // simply doesn't render until there's enough history.
    const priorSessions = sessions.slice(WINDOW_SIZE);
    const previous = priorSessions.length === WINDOW_SIZE ? priorSessions.map(toMetricsShape) : [];

    const dto: MetricsDTO = {
      ready: true,
      independence: computeIndependence(current, previous),
      recovery: computeRecovery(current, previous),
      coverage: computeCoverage(currentScenarios, previousScenarios),
    };
    res.json(dto);
  })
);
