// Entry point: validate config, build the app, mount routes, listen.
//
// Middleware order here is load-bearing. requireUser is applied per-router
// rather than globally so /health and /users/identify stay reachable without
// a token, and errorHandler must stay last -- Express identifies the terminal
// error handler by its arity and its position.
//
// See README.md for the request lifecycle and the full route table.
import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { getLLMProvider, getSpeechProvider } from "./ai";
import { prisma } from "./db";
import { loadEnv } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import { aiRateLimiter, readRateLimiter } from "./middleware/rateLimit";
import { documentsRouter } from "./routes/documents";
import { helpRouter } from "./routes/help";
import { metricsRouter } from "./routes/metrics";
import { scenariosRouter } from "./routes/scenarios";
import { sessionsRouter } from "./routes/sessions";
import { speechRouter } from "./routes/speech";
import { usersRouter } from "./routes/users";

const env = loadEnv();

// Fail fast on a broken deploy (missing/invalid provider config) instead of
// looking "up" via /health and then 500ing on the first real request.
getLLMProvider();
getSpeechProvider();

const app = express();

// Render (and most PaaS) put a proxy in front of the app, so req.ip would
// otherwise be the proxy's address for every caller -- collapsing all users
// into one rate-limit bucket. Trusting exactly one hop rather than `true` is
// deliberate: blanket trust lets a client forge X-Forwarded-For and pick its
// own bucket, which would defeat the IP limit on account creation.
app.set("trust proxy", 1);

app.use(cors());
app.use(morgan("dev"));
// Voice recordings and document photos arrive as base64 JSON, which inflates
// size ~33% over the raw file -- both can exceed the default 2mb limit.
app.use(express.json({ limit: "15mb" }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "connected" });
  } catch (error) {
    res.status(503).json({ ok: false, db: "unreachable", error: (error as Error).message });
  }
});

// Limiters are mounted per-router by how expensive the router is, not
// globally: metrics is a pure read and should never be throttled at the same
// rate as a router that bills per request. /health stays unlimited so an
// uptime check can never be rate-limited into looking like an outage.
app.use("/users", usersRouter);
app.use("/documents", aiRateLimiter, documentsRouter);
app.use("/scenarios", aiRateLimiter, scenariosRouter);
app.use("/sessions", aiRateLimiter, sessionsRouter);
app.use("/help", aiRateLimiter, helpRouter);
app.use("/speech", aiRateLimiter, speechRouter);
app.use("/metrics", readRateLimiter, metricsRouter);

app.use(errorHandler);

const port = env.PORT ? Number(env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Leena server listening on port ${port}`);
});
