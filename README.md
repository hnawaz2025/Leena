# Leena

Leena is a rehearsal partner for the English conversations immigrants have to
get right on the first try — the doctor's office, the landlord call, the
USCIS interview, the parent-teacher conference. You don't get a second take
on those in real life. Leena is where you get twenty.

The premise: fluency isn't the blocker for most of this audience. Confidence
under pressure is. Someone who reads and writes English competently can still
freeze on the phone with a landlord, because the classroom never rehearsed
*that specific conversation* — with its specific vocabulary, its specific
back-and-forth, its specific moment where you have to ask someone to repeat
themselves without it costing you the room. Leena builds a roleplay partner
for the exact conversation you're dreading, lets you run it as many times as
you need, and tracks two things across every attempt: how much of it you
handled on your own, and how ready you are for the conversations you said
matter to you.

Bring a document — a lease, a letter from a school, a notice you don't fully
understand — and Leena explains it in plain language and turns it into a
scenario. Or describe the conversation yourself. Either way you get a
persona who opens the conversation (never a blank screen — the other party
starts, exactly like real life), a "help me say this" button for the moment
you go blank, and a plain-language debrief afterward in your own language,
not just English.

## Repo layout

This is an npm workspace with two deployables and one shared package:

```
app/               React Native (Expo) client — the product
server/            Express + Prisma + Postgres API — owns the practice
                   record and every AI call
packages/shared/   TypeScript types shared by both — the DTO contract
```

Each has its own README with the actual engineering detail:
[`app/README.md`](app/README.md) ·  [`server/README.md`](server/README.md).
This file stays at the product level; go there for architecture.

## Running it

```bash
npm install                      # from the repo root — installs both workspaces

# server, in one terminal
cd server
npx prisma db push               # one-time: point DATABASE_URL at a local Postgres first
npm run dev                      # localhost:4000

# app, in another terminal
cd app
npm start                        # scan the QR with Expo Go, or press i / a / w
```

The app ships pointed at the deployed server
(`EXPO_PUBLIC_API_BASE_URL` in `app/.env`) so it works out of the box without
running the server locally at all. Point it at `localhost:4000` only when
you're actually changing server code.

## Why it's built this way

A few decisions that shape everything downstream, made with a specific kind
of user in mind — someone who is already anxious about being misunderstood,
opening an app for the first time, on a phone, possibly mid-crisis about a
letter they got that day:

**No accounts.** Onboarding asks one question — your native language — and
nothing else. No email, no password, no verification step between "I have a
problem" and "I'm rehearsing the solution." The cost is real: identity is
bound to a device install, there's no recovery and no multi-device sync. For
this audience, that trade is correct. A locked-out immigration applicant
abandoning the app at a password reset screen is a worse outcome than the
data-portability gap.

**Every debrief is bilingual, not translated-after-the-fact.** The model is
asked to produce the native-language explanation directly, not to translate
its own English output — a document explanation that reads like a machine
translated it defeats the purpose for someone already worried about being
talked down to.

**Asking for clarification is never scored as a failure.** It's the single
behavior the product exists to build — most of this audience already
under-rehearses "sorry, can you say that again?" because it feels like
admitting they didn't understand. The metrics are built so that saying it
never counts against you. See `Independence` in
[`server/README.md`](server/README.md#the-metrics-layer) for how that's
enforced in code, not just in copy.

**The server owns every model call; the app never talks to a provider
directly.** Keys stay server-side, a provider swap touches no client code,
and — practically — an app-store review cycle can't ship a stale prompt.

None of this is hidden behind comments saying `// TODO`. Both sub-READMEs
keep an honest "known gaps" section for exactly the things a first read
would otherwise have to rediscover the hard way.
