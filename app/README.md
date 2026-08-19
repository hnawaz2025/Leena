# Leena — app

The React Native (Expo) client. Owns navigation, on-device speech (both
directions), and rendering the practice record the [server](../server) holds
— it never talks to an AI provider directly.

## What this app is responsible for

1. **The rehearsal loop.** Scenario setup → conversation → feedback. This is
   the product; everything else supports it.
2. **On-device speech.** Text-to-speech runs locally via `expo-speech` —
   free, instant, and the reason the server has no TTS route at all (see
   [`server/README.md`](../server/README.md)). Speech-to-text is recorded on
   device and sent to the server, which brokers Whisper.
3. **Local identity.** A device-generated id and auth token, persisted with
   `expo-secure-store`, are the only things that survive a reinstall. See
   `src/api/deviceId.ts` and `src/store/useAppStore.ts`.

It is deliberately *not* responsible for holding practice history as source
of truth — `useAppStore` persists only the onboarding profile (native
language, target language). Scenarios, sessions, and feedback are fetched
from the server on every screen that needs them via `@tanstack/react-query`,
not cached locally, so a second device or a reinstalled app sees the same
history without any sync code to write.

## Running it locally

```bash
# from the repo root — this is an npm workspace
npm install

cd app
npm start          # scan the QR with Expo Go, or press i / a / w
```

```bash
npm run typecheck
```

There is no test suite here yet — see "Known gaps".

### Environment

`.env` (already checked in with the deployed URL, see the comment inside it):

| Variable | Notes |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Which server to talk to. Baked into the bundle at build time — restart Expo, don't just reload, after changing it. Defaults to `http://localhost:4000` if unset. |

Testing against a local server from a physical device needs your machine's
LAN IP, not `localhost` — Expo Go is a separate process on a separate device.
The deployed URL is what to demo with; it doesn't change when you switch
wifi networks.

## Directory map

```
src/
  navigation/       RootStackParamList — the one file that defines every
                     screen and the params it takes

  screens/
    OnboardingScreen.tsx          the only screen that asks a question
    HomeScreen.tsx                scenario list + the two metrics
    DocumentUploadScreen.tsx      photo → extracted text
    DocumentExplanationScreen.tsx plain-language explanation, bilingual
    ScenarioSetupScreen.tsx       describe the conversation, or use a document
    ConversationScreen.tsx        the roleplay loop + "help me say this"
    YourEnglishScreen.tsx         Independence / Coverage, with evidence
    PhrasebookScreen.tsx          everything you've ever asked how to say

  components/       presentational; SwipeableRow, MetricRing, ChatBubble,
                     FeedbackPanel are the ones with real logic in them

  store/
    useAppStore.ts   the one piece of client state that must survive a
                     cold start — see the comment at its top for why

  api/
    client.ts        every server call, and the only place HTTP errors are
                      turned into the string a user actually reads
    deviceId.ts       mint/read the device id + auth token
    storage.ts        expo-secure-store wrapper

  hooks/
    useVoiceRecording.ts    mic capture → upload → transcript
    useDocumentCapture.ts   camera/photo-library → upload → extracted text

  theme/            colors, spacing, typography — the single source both
                     screens and components import from
```

## Screen flow

```
Onboarding (once)
    │
    ▼
Home ──────────────┬─────────────────┐
    │               │                 │
    ▼               ▼                 ▼
DocumentUpload  ScenarioSetup     Phrasebook / YourEnglish
    │               │
    ▼               ▼
DocumentExplanation  Conversation ──▶ feedback (in-screen, polls
    │                                 GET /sessions/:id/feedback)
    └──▶ ScenarioSetup (prefilled)
```

`ScenarioSetup` takes an optional `documentId` — arriving from
`DocumentExplanation` prefills the scenario from what was just explained,
rather than asking the user to redescribe a situation the app already read.

## State and data

Two different kinds of state are kept deliberately separate:

- **Client state** (`useAppStore`, Zustand): only the onboarding profile.
  Small enough to not need a library at all, but a store makes `hydrated`
  explicit — nothing routes on `onboarded` before the stored profile has
  actually been read, or a returning user flashes onboarding for a frame.
- **Server state** (`@tanstack/react-query`): scenarios, sessions, turns,
  feedback, phrases. Fetched, cached per-query-key, and invalidated on
  mutation (see `PhrasebookScreen.tsx` for the pattern) — never held in
  Zustand, so there is exactly one place that can go stale.

## Known gaps

- **No test suite.** The server has one for its pure functions; the app has
  none yet, for screens or components.
- **No offline handling beyond the error message.** A failed request surfaces
  the server's message (see `api/client.ts`) but nothing is queued or retried
  automatically.
- **Onboarding offers 4 native languages** (Spanish, Mandarin, Hindi, Urdu),
  scoped down on purpose for a focused demo — see the comment in
  `OnboardingScreen.tsx`. Not a technical limitation; the server takes any
  language string, and adding another to the onboarding list means adding one
  entry to each map in `utils/languageCodes.ts`.
- **No accessibility pass.** Font scaling, screen reader labels, and contrast
  haven't been audited beyond what Expo's defaults give for free.
