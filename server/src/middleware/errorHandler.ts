import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Terminal error handler. Anything thrown/rejected in a route wrapped with
// asyncHandler ends up here instead of hanging the request or crashing the
// process. Keeping this last in the middleware chain is required by Express.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  console.error(`Unhandled error on ${req.method} ${req.path}:`, err);

  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.flatten() });
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
}
