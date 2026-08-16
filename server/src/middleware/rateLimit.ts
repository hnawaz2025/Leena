import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import type { AuthedRequest } from "./deviceAuth";

// Why this exists: nearly every interesting route here spends money. A single
// loop against POST /sessions/:id/turns or POST /help is a real bill, and
// POST /users/identify is necessarily unauthenticated, so nothing stopped
// someone minting a token and running one.
//
// The defence is two-layered rather than one big limiter:
//
//   1. Account creation is limited per IP.
//   2. Everything expensive is limited per account.
//
// That chain is what makes the per-account limit meaningful. Keying on
// x-device-id is spoofable on its own -- an attacker could rotate the header
// to get a fresh bucket -- but a rotated device id has no valid auth token,
// and getting one means going through IP-limited account creation.

// A practice conversation is roughly 20 turns, plus a handful of help
// lookups, plus scenario generation and end-of-session analysis: call it ~27
// model calls. This allows about four full conversations per window, which no
// real person reaches by accident and which caps a runaway loop quickly.
const AI_LIMIT_PER_WINDOW = 120;
const AI_WINDOW_MS = 15 * 60 * 1000;

// Reads are cheap but still hit Postgres, so they get a ceiling too -- just a
// far looser one, sized so polling and pull-to-refresh never trip it.
const READ_LIMIT_PER_WINDOW = 600;
const READ_WINDOW_MS = 15 * 60 * 1000;

// Deliberately not tight. The profile store is in-memory today, so every app
// relaunch sends the user back through onboarding and calls identify again --
// a strict limit here would lock out a developer restarting the app, or a
// group of real users behind one NAT. Still low enough to stop bulk account
// creation.
const IDENTIFY_LIMIT_PER_WINDOW = 30;
const IDENTIFY_WINDOW_MS = 60 * 60 * 1000;

// Prefer the account, fall back to the caller's IP for routes that run before
// (or without) auth. ipKeyGenerator is required rather than raw req.ip: it
// normalises IPv6 to a subnet, so a single client can't walk through a /64
// worth of addresses to get a fresh bucket each time.
function accountOrIpKey(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (userId) return `user:${userId}`;

  const deviceId = req.header("x-device-id");
  if (deviceId) return `device:${deviceId}`;

  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

// One shape for every limit response so the client can branch on a code
// instead of matching on prose, and so a 429 never looks like a crash.
function limitResponse(message: string) {
  return {
    error: message,
    code: "RATE_LIMITED" as const,
  };
}

export const aiRateLimiter = rateLimit({
  windowMs: AI_WINDOW_MS,
  limit: AI_LIMIT_PER_WINDOW,
  keyGenerator: accountOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse(
    "You've done a lot of practice in a short time. Take a short break and try again in a few minutes."
  ),
});

export const readRateLimiter = rateLimit({
  windowMs: READ_WINDOW_MS,
  limit: READ_LIMIT_PER_WINDOW,
  keyGenerator: accountOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many requests. Try again in a few minutes."),
});

export const identifyRateLimiter = rateLimit({
  windowMs: IDENTIFY_WINDOW_MS,
  limit: IDENTIFY_LIMIT_PER_WINDOW,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? "")}`,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many sign-ups from this network. Try again later."),
});
