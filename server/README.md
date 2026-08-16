# Leena — server

The API behind the Leena mobile app. An Express + Prisma + Postgres service
whose job is to hold the user's practice history and to broker every AI call
the app needs.

The app itself is a React Native (Expo) client in [`../app`](../app). Types
shared by both live in [`../packages/shared`](../packages/shared) — that
package is the contract between them, so a DTO change there is a change to
both sides at once.

---

## What this service is responsible for

Three things, in rough order of importance:

1. **Owning the practice record.** Scenarios, sessions, turns, feedback
   reports and looked-up phrases. This is the part that can't be regenerated
   if it's lost.
2. **Brokering AI calls.** Every model call goes through here, never from the
   app. Keys stay server-side, prompts stay in one place, and a provider swap
   touches no client code.
3. **Deriving the metrics.** Independence and Coverage are computed on read
   from data already stored, never stored themselves.

It is deliberately *not* responsible for text-to-speech: the app speaks text
aloud on-device with `expo-speech`, which is free and instant. Paying a cloud
API per character to read back text the app already has would be a bad trade.

---

## Running it locally

```bash
# from the repo root — this is an npm workspace
npm install

# one-time: point DATABASE_URL at a local Postgres, then
cd server
npx prisma db push     # create/sync tables (see "Schema changes" below)

npm run dev            # tsx watch on src/index.ts, port 4000
```

`npm run dev` restarts on save. Health check: `curl localhost:4000/health`.

### Environment

Validated at boot by [`src/env.ts`](src/env.ts) — the process exits with a
readable list of problems rather than starting up and failing on the first
real request.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT` | no | defaults to `4000` |
| `AI_LLM_PROVIDER` | no | only `featherless`; defaults to it |
| `FEATHERLESS_API_KEY` | when provider is featherless | |
| `FEATHERLESS_MODEL` | when provider is featherless | model id, e.g. `deepseek-ai/DeepSeek-V3-0324` |
| `AI_SPEECH_PROVIDER` | no | only `openai`; defaults to it |
| `OPENAI_API_KEY` | when speech provider is openai | Whisper transcription only |

**Choosing `FEATHERLESS_MODEL` is a real decision, not a formality.** Featherless
proxies 40,000+ open-weight models behind an OpenAI-compatible API, and they
differ enormously at the two things this service actually needs: emitting
valid JSON, and writing fluent non-English text. Models observed in practice:

- `deepseek-ai/DeepSeek-V3-0324` — current default. Reliable JSON, fluent
  Hindi/Mandarin. Larger, so it costs more concurrency units.
- `zai-org/GLM-4-9B-0414` — previous default, good quality, but has hit
  `503 capacity_exhausted` for extended stretches.
- `Qwen/Qwen2.5-7B-Instruct` — runs, but produced garbled Hindi and
  repeatedly returned out-of-range checklist indices.
- `mistralai/Mistral-7B-Instruct-v0.3` — returned pure garbage tokens. Unusable.

Check a model's concurrency-unit cost on the Featherless dashboard before
using it for a live demo.

> **Shell gotcha:** if `OPENAI_API_KEY` is exported in your shell profile it
> shadows the one in `.env` (dotenv does not override existing env vars).
> Start with `env -u OPENAI_API_KEY npm run dev` or clean up the profile.

### Schema changes

This project uses `prisma db push`, not migrations. That's a prototyping
choice: it diffs the schema against the database and applies the change with
no migration file. It can drop columns, and it will ask before doing so
(`--accept-data-loss` to confirm). Production would want `prisma migrate`
so schema history is reviewable and replayable — see "Known gaps".

---

## How a request flows

```
  request
    │
    ├─ cors()                     open to all origins today
    ├─ morgan("dev")              request logging
    ├─ express.json({15mb})       base64 audio/photos inflate ~33%
    │
    ├─ requireUser                x-device-id + x-auth-token → req.userId
    │                             (every route except /health, /users/identify)
    │
    ├─ asyncHandler(handler)      catches rejected promises — Express 4
    │     │                       does not do this itself
    │     ├─ zod .safeParse       → 400 on bad input
    │     ├─ prisma               always scoped by userId
    │     └─ getLLMProvider()     AI calls, if any
    │
    └─ errorHandler               terminal; must stay last
```

### Auth

Deliberately lightweight: no email, no password. Onboarding friction is a real
cost for users who are already anxious about English-language forms.

`POST /users/identify` takes a `deviceId` the app generates and returns an
opaque 32-byte `authToken`. Both travel as headers on every later request.
The `deviceId` is treated as a *name*, not a secret — knowing or guessing one
is not enough, because the token must match too.

The tradeoff, stated plainly: identity is bound to a device install. There is
no account recovery and no multi-device sync. That's the right call for a
hackathon MVP and the wrong one for a real product.

---

## Directory map

```
src/
  index.ts              app wiring, middleware order, route mounting, /health
  env.ts                env schema + fail-fast validation
  db.ts                 the single PrismaClient instance

  middleware/
    deviceAuth.ts       requireUser — resolves headers to req.userId
    asyncHandler.ts     promise-rejection → next(err) for Express 4
    errorHandler.ts     terminal error handler

  routes/               one file per resource; all business logic lives here
    users.ts            identify (the only unauthenticated route)
    documents.ts        upload, OCR from photo, plain-language explanation
    scenarios.ts        generate a roleplay partner; list/read/delete
    sessions.ts         the conversation loop, and session teardown
    help.ts             "how do I say this" + the phrasebook it feeds
    metrics.ts          assembles the two metrics from stored rows
    speech.ts           audio → text

  ai/
    index.ts            provider factory, memoised per process
    types.ts            LLMProvider / SpeechProvider interfaces
    schemas.ts          zod schema per structured LLM response
    jsonRetry.ts        JSON extraction, retry, script-contamination guard
    providers/
      featherlessLLMProvider.ts   every prompt in the app lives here
      openaiSpeechProvider.ts     Whisper transcription

  metrics/              pure functions, no I/O
    independence.ts
    coverage.ts

prisma/schema.prisma    the data model
scripts/seedDemo.ts     realistic practice history for demos
```

---

## The data model

```
User ─┬─ Document ── DocumentExplanation
      ├─ Scenario ── Session ─┬─ Turn
      │                       └─ FeedbackReport
      ├─ TranslationAssistEvent      (help lookups)
      └─ PhrasePracticeEvent         (speaker-icon taps)
```

Notes on the parts whose shape isn't obvious:

**`Scenario` vs `Session`.** A Scenario is *a conversation you need to have*
(one doctor's appointment). A Session is *one attempt at rehearsing it*.
"Practice again" creates a new Session under the same Scenario, which is why
Home lists Scenarios, not Sessions — otherwise repeated practice would look
like duplicate history.

**`Scenario.checklist`** is generated once, lazily, at the first session end,
and is immutable thereafter. Coverage accumulates across attempts, and it can
only do that against a target that doesn't move between them.

**`FeedbackReport.coveredIndices`** is per-session and append-only. Total
coverage is derived by unioning across a scenario's reports rather than being
stored, so it can't drift out of step with its source.

**`FeedbackReport.nonAnswerTurnIndices` / `clarificationTurnIndices`** are
LLM-tagged indices into that session's turns. They're kept apart on purpose:
dodging a question and asking someone to repeat themselves look similar in a
transcript and mean opposite things. Asking for clarification is the behaviour
the app exists to build, and is never scored against the user.

**`Turn.fromSuggestion`** is recorded at write time, never inferred later. The
help panel drops its suggestion into an *editable* box, so matching text
afterwards would credit the app's own sentence back to the user — exactly
backwards for a feature meant to counter self-underestimation.

**`TranslationAssistEvent.sessionId` is nullable.** Set = stuck mid-rehearsal;
null = a quick lookup out in the real world. Same event either way ("I didn't
know how to say this"), so one table keeps the cross-cutting question — what
does this person keep getting stuck on — a single query. Its `session`
relation is `SetNull`, not `Cascade`: deleting a scenario must not destroy
phrases the user learned while practising it.

**`PhrasePracticeEvent` is an append-only log, not a counter.** The count is
derived from it. Timestamps are what a future spaced-repetition reminder
("you haven't practised this in 10 days") would actually need.

---

## The AI layer

Every model call goes through the `LLMProvider` interface in
[`ai/types.ts`](src/ai/types.ts). No route knows which vendor is in use — which
is why removing Anthropic entirely touched zero route code.

### JSON discipline

No model reliably returns well-formed, correctly-shaped JSON from a prompt
alone — least of all a small open-weight one. So every structured call goes
through `callForJson` in [`ai/jsonRetry.ts`](src/ai/jsonRetry.ts), which:

1. extracts the JSON object out of whatever prose the model wrapped it in,
2. parses it against a zod schema from [`ai/schemas.ts`](src/ai/schemas.ts),
3. runs an optional **hard** `validate` — structural problems that would
   corrupt data,
4. runs an optional **soft** `softValidate` — quality problems where a
   degraded answer still beats no answer,
5. on failure, retries **once**, feeding the actual error text back to the
   model so it can see what to fix.

The hard/soft split is the important part. A mismatched array length must fail
the call. A few stray characters of the wrong script in one sentence must not
cost the user their entire feedback report — those retry, then get accepted
with a logged warning.

`assertNoUnexpectedScript` exists because small models genuinely do leak
characters from unrelated scripts into output meant to be in another language
(first seen as Cyrillic inside otherwise-correct Spanish). It is a targeted
check for exactly that, not a translation-quality check.

### Truncation limits

All in `featherlessLLMProvider.ts`, all there to stop prompt size and cost
growing without bound as a conversation gets longer:

| Constant | Value | Applies to |
| --- | --- | --- |
| `MAX_HISTORY_TURNS_FOR_CHAT` | 16 | each conversation turn |
| `MAX_TRANSCRIPT_TURNS_FOR_ANALYSIS` | 40 | end-of-session analysis |
| `MAX_DOCUMENT_CHARS_FOR_EXPLANATION` | 6000 | document explanation |
| `MAX_HISTORY_TURNS_FOR_HELP` | 8 | mid-conversation phrase help |

Analysis numbers the turns it sends so the model can point at specific ones;
because that's a *slice*, the returned indices are shifted back onto the real
transcript before anything stores them.

### Vision

`extractDocumentText` uses a separate hardcoded `VISION_MODEL`
(`Qwen/Qwen3-VL-8B-Instruct`) rather than `FEATHERLESS_MODEL`, because the main
model is text-only. "Instruct" not "Thinking" — reasoning variants leak their
scratchpad into the output.

---

## The metrics layer

Two metrics, both computed fresh on every `GET /metrics` from rows already
fetched. Nothing is cached or stored: the underlying data is immutable once a
session ends, so a stored copy could only ever be a second source of truth to
keep in sync.

[`metrics/independence.ts`](src/metrics/independence.ts) and
[`metrics/coverage.ts`](src/metrics/coverage.ts) are **pure functions** — no
database access, no I/O. They're the most testable code in the repo (and,
currently, untested — see below).

**Independence** — of the things you said, how many did you manage on your
own? Counts *turns*, not help-button presses: asking three times before
sending one sentence is one turn you didn't manage alone, which keeps the
ratio inside its own denominator and needs no clamping. A turn counts against
you if it came from a suggestion or was tagged a dodge. A turn tagged as a
clarification request never counts against you.

**Coverage** — of the conversations you're preparing for, how many are you
ready for? Windows by *scenario*, not session: three attempts at the same
appointment is one thing to be ready for, not three.

**Windowing.** Both use a window of 4 (`WINDOW_SIZE` / `SCENARIO_WINDOW_SIZE`
in `routes/metrics.ts`). "Previous" is the 4 before those, and is only
computed when a *full* previous window exists — otherwise `previous` is null
and the app renders no trend at all. A trend measured against one conversation
while the current value averages four looks authoritative and isn't.

Below `MIN_SESSIONS_FOR_METRICS` (2) the whole response is
`{ ready: false }` and the app shows nothing. A confident-looking number built
on a single conversation is worse than no number — this audience systematically
underestimates itself, and a bad-looking figure is read as a verdict.

---

## API reference

All routes require `x-device-id` and `x-auth-token` headers except `/health`
and `POST /users/identify`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | liveness + DB reachability |
| `POST` | `/users/identify` | upsert by deviceId, mint auth token |
| `POST` | `/documents` | store already-extracted text |
| `GET` | `/documents/:id` | read one |
| `POST` | `/documents/extract-from-image` | photo → text (vision model) |
| `POST` | `/documents/:id/explain` | plain-language explanation; cached, `?refresh=true` to regenerate |
| `POST` | `/scenarios` | generate a roleplay partner for a situation |
| `GET` | `/scenarios` | one row per scenario, with attempt count + coverage |
| `GET` | `/scenarios/:id` | read one |
| `DELETE` | `/scenarios/:id` | cascades sessions/turns/feedback; phrases survive |
| `GET` | `/scenarios/:id/sessions` | attempt history |
| `POST` | `/sessions` | start an attempt |
| `POST` | `/sessions/:id/turns` | send a turn, get the persona's reply |
| `GET` | `/sessions/:id/turns` | full transcript |
| `POST` | `/sessions/:id/end` | generate checklist (first time) + analysis |
| `GET` | `/sessions/:id/feedback` | the report, plus cumulative coverage |
| `POST` | `/help` | "how do I say this" — in-session or standalone |
| `GET` | `/help/phrases` | phrasebook, grouped by keyPhrase |
| `DELETE` | `/help/phrases?keyPhrase=…` | delete every lookup behind one entry |
| `POST` | `/help/phrases/practice` | log a speaker-icon tap |
| `POST` | `/help/:eventId/use` | mark a suggestion as actually spoken |
| `GET` | `/metrics` | Independence + Coverage, with evidence |
| `POST` | `/speech/transcribe` | audio → text (Whisper) |

`DELETE /help/phrases` takes `keyPhrase` as a query param rather than a path
segment because it's arbitrary natural language and may contain slashes.

---

## Known gaps

Honest list. None of these are hidden behind a comment saying "TODO"; they're
tracked here so the next person doesn't have to rediscover them.

**Operational**

- **No rate limiting.** `POST /users/identify` is necessarily unauthenticated,
  and nothing throttles what follows. Anyone can mint a token and loop the
  paid endpoints. This is the highest-priority gap the moment the API is
  publicly reachable.
- **Raw error messages reach the client.** `errorHandler` returns
  `err.message` verbatim, which is how provider strings like
  `"503 … is temporarily at capacity"` end up in the UI. Should log the real
  error and return a generic message plus a small map of known-safe cases.
- **`cors()` is unconfigured** — every origin allowed.
- **No graceful shutdown.** SIGTERM on redeploy kills in-flight requests, which
  matters more here than usual because AI calls routinely run 30–90s.
- **`/health` leaks the raw DB error string.**
- **No timeouts on AI calls.** SDK defaults are up to 10 minutes.
- **No token/cost logging.** Usage data is returned by every call and discarded.

**Correctness**

- **A failed AI call can leave an orphaned turn.** `POST /:id/turns` writes the
  user's turn, then calls the model, then writes the reply — with no
  transaction. On failure the user's message is committed with no response.
- **`POST /:id/end` has no active-session guard**, unlike the turns route.
  Calling it twice re-runs the paid analysis and overwrites the report.
- **`transcribe` has no retry**, while LLM calls get two attempts — and a
  failed transcription means the user's audio is gone and they must speak
  again. Worst place in the app to lack one.
- **Script contamination checks are applied unevenly.** `suggestPhrase` treats
  a leak as a *hard* failure (so the user gets a 500 instead of a slightly
  imperfect phrase) while everywhere else it's soft; `generateScenario` and
  `explainDocument` have no check at all, despite explainDocument being where
  the problem was first observed.

**Structural**

- **No tests.** The metrics layer is pure functions with plain inputs and
  deterministic outputs — the easiest thing in the repo to test, and the place
  where a silent regression would be least visible.
- **No service layer.** Business logic lives in route handlers; `sessions.ts`
  is the biggest one, and "end a session" needs to be callable off the request
  path eventually.
- **`prisma db push`, no migrations.** See "Schema changes".
- **No API versioning.** Matters for mobile specifically: App Store review
  means several client versions talk to one server, so responses need to stay
  backward-compatible.
- **Band thresholds are invented.** The 40/70 and 40/75 cutoffs that turn a
  number into a judgement were picked, not derived from any distribution.
- **`contextSummary` flattens structured data into a string.** `scenarios.ts`
  glues the summary, opening line and key vocabulary into one blob, so the app
  has to un-glue it with a regex, `keyVocabulary` is unusable as data, and
  **`openingLine` is never spoken** — which is why the persona never opens a
  conversation.
