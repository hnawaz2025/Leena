import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { asyncHandler } from "./asyncHandler";

export interface AuthedRequest extends Request {
  userId?: string;
}

// Identity here is intentionally lightweight (no email/password) so onboarding
// has zero friction for users who may already be anxious about English-language
// forms. deviceId alone is not treated as a secret: POST /users/identify mints
// an opaque authToken that the client must also present on every subsequent
// request, so knowing/guessing a deviceId string is not sufficient to read or
// modify another user's data.
export const requireUser = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const deviceId = req.header("x-device-id");
  const authToken = req.header("x-auth-token");
  if (!deviceId || !authToken) {
    res.status(401).json({ error: "Missing x-device-id or x-auth-token header" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { deviceId } });
  if (!user || user.authToken !== authToken) {
    res.status(401).json({ error: "Unknown device or invalid auth token. Call POST /users/identify first." });
    return;
  }

  req.userId = user.id;
  next();
});
