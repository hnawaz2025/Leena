# Leena

You don't get a second take on the call where you ask your landlord not to
raise the rent. Leena is where you get twenty.

It's a rehearsal partner for the English conversations immigrants have to
get right on the first try — the doctor's office, the USCIS interview, the
parent-teacher conference, the letter you don't fully understand. The bet
underneath it: for most of this audience, fluency isn't the blocker.
Confidence under pressure is. Someone who reads and writes English
competently can still freeze on the phone with a landlord, because no
classroom rehearsed *that specific conversation* — its vocabulary, its
back-and-forth, the exact moment you have to ask someone to repeat
themselves without it costing you the room.

Bring a document, or just describe the situation. Leena builds a roleplay
partner for it, lets you run it as many times as you need, and tracks two
things across every attempt: how much of it you handled on your own, and how
ready you are for the conversations you said actually matter to you.

## How a rehearsal works

```mermaid
flowchart LR
    A["Bring a document\n(lease, letter, notice)"] --> C["Scenario"]
    B["...or describe\nthe situation yourself"] --> C
    C --> D["Persona opens\nthe conversation"]
    D --> E["You reply\n(stuck? tap 'help me say this')"]
    E --> F{"Conversation\ndone?"}
    F -- "no, keep going" --> D
    F -- yes --> G["Bilingual debrief\nin your native language"]
    G --> H["Independence + Coverage\nupdate across attempts"]
    H -. "practice again" .-> D
```

The persona always opens — never a blank screen, exactly like the real
conversation would go. The debrief comes back in your own language, not
just English, because a plain-language explanation that reads like a machine
translated it defeats the point for someone already worried about being
talked down to.

## Repo layout

An npm workspace, two deployables, one shared contract:

```
app/               React Native (Expo) client — the product
server/            Express + Prisma + Postgres API — owns the practice
                   record and every AI call
packages/shared/   TypeScript types shared by both — the DTO contract
```

Each has its own README with the actual engineering detail:
[`app/README.md`](app/README.md) · [`server/README.md`](server/README.md).
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

Three decisions that shape everything downstream, made with a specific user
in mind — someone already anxious about being misunderstood, opening an app
for the first time, on a phone, possibly mid-crisis about a letter they got
that day:

**No accounts.** Onboarding asks one question — your native language — and
nothing else. The cost is real: identity is bound to a device install, no
recovery, no multi-device sync. For this audience that trade is correct — a
locked-out applicant abandoning the app at a password-reset screen is a
worse outcome than the data-portability gap.

**Asking for clarification is never scored as a failure.** It's the single
behavior the product exists to build — this audience already under-rehearses
"sorry, can you say that again?" because it feels like admitting they didn't
understand. The metrics are built so saying it never counts against you.
See *Independence* in [`server/README.md`](server/README.md#the-metrics-layer)
for how that's enforced in code, not just in copy.

**The server owns every model call; the app never talks to a provider
directly.** Keys stay server-side, a provider swap touches no client code,
and an app-store review cycle can't ship a stale prompt.

Nothing here is hidden behind a comment saying `// TODO`. Both sub-READMEs
keep an honest "known gaps" section for exactly the things a first read
would otherwise have to rediscover the hard way.
