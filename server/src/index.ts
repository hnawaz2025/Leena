import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { getLLMProvider, getSpeechProvider } from "./ai";
import { prisma } from "./db";
import { loadEnv } from "./env";
import { errorHandler } from "./middleware/errorHandler";
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

app.use("/users", usersRouter);
app.use("/documents", documentsRouter);
app.use("/scenarios", scenariosRouter);
app.use("/sessions", sessionsRouter);
app.use("/help", helpRouter);
app.use("/metrics", metricsRouter);
app.use("/speech", speechRouter);

app.use(errorHandler);

const port = env.PORT ? Number(env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Leena server listening on port ${port}`);
});
