/**
 * Seeds a coherent practice history so the metrics have something honest to
 * describe. Independence, Recovery and Coverage all stay hidden until there's
 * enough data behind them, which is correct behaviour but makes the app hard
 * to demo -- and impossible to eyeball while building.
 *
 *   npx tsx scripts/seedDemo.ts <deviceId>
 *   npx tsx scripts/seedDemo.ts <deviceId> --clear
 *
 * Everything it creates is tagged with DEMO_MARKER on the scenario, so --clear
 * removes exactly the seeded rows and never touches real practice.
 *
 * The transcripts matter more than usual here: the evidence cards quote them
 * verbatim, so placeholder text would render as visibly broken UI.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_MARKER = "__demo_seed";

type Exchange = {
  agent: string;
  user: string;
  /** A help request on this turn, as the user would have made it. */
  help?: { native: string; suggested: string; keyPhrase: string };
};

interface DemoSession {
  /** Days before now, so ordering is deterministic. */
  daysAgo: number;
  exchanges: Exchange[];
  covered: number[];
}

interface DemoScenario {
  title: string;
  persona: string;
  checklist: string[][];
  sessions: DemoSession[];
}

// en / native pairs, kept short so they read cleanly in the checklist UI.
const scenarios: DemoScenario[] = [
  {
    title: "First appointment with a new doctor",
    persona: "Dr. Anya Sharma, a family doctor",
    checklist: [
      ["Explain why you came in", "Explicar por qué viniste"],
      ["Describe when the symptoms started", "Describir cuándo empezaron los síntomas"],
      ["Say how bad the pain is", "Decir qué tan fuerte es el dolor"],
      ["Mention any medication you take", "Mencionar los medicamentos que tomas"],
      ["Ask what the treatment options are", "Preguntar cuáles son las opciones de tratamiento"],
      ["Ask what it will cost", "Preguntar cuánto costará"],
      ["Ask them to repeat something you missed", "Pedir que repitan algo que no entendiste"],
      ["Book a follow-up appointment", "Programar una cita de seguimiento"],
    ],
    sessions: [
      {
        daysAgo: 12,
        covered: [0, 1, 3],
        exchanges: [
          {
            agent: "Good morning. What brings you in today?",
            user: "I have pain in my back for two weeks.",
          },
          {
            agent: "How would you describe the pain — is it sharp or dull?",
            user: "Okay.",
          },
          {
            agent: "Are you taking any medication at the moment?",
            user: "Yes, ibuprofen.",
            help: {
              native: "Tomo ibuprofeno dos veces al día",
              suggested: "I take ibuprofen twice a day.",
              keyPhrase: "i take ibuprofen twice a day",
            },
          },
          {
            agent: "What would you like to do about it?",
            user: "Mm.",
          },
        ],
      },
      {
        daysAgo: 3,
        covered: [2, 4, 7],
        exchanges: [
          {
            agent: "What has changed since we last spoke?",
            user: "The pain is a bit better but it still hurts when I lift things.",
          },
          {
            agent: "How is it affecting your daily routine?",
            user: "I can work but I cannot carry heavy boxes anymore.",
          },
          {
            agent: "What treatment would you prefer to try first?",
            user: "I would like to try physiotherapy before any medication.",
            help: {
              native: "Quiero probar fisioterapia primero",
              suggested: "I would like to try physiotherapy first.",
              keyPhrase: "i would like to try physiotherapy first",
            },
          },
          {
            agent: "When would you like to come back?",
            user: "Could we book something in two weeks?",
          },
        ],
      },
    ],
  },
  {
    title: "Disputing a charge on my phone bill",
    persona: "Marcus, a customer service representative",
    checklist: [
      ["Explain what looks wrong on the bill", "Explicar qué está mal en la factura"],
      ["Say what you normally pay", "Decir cuánto pagas normalmente"],
      ["Ask them to check the account", "Pedir que revisen la cuenta"],
      ["Ask for the extra charge to be removed", "Pedir que quiten el cargo extra"],
      ["Ask when the refund will arrive", "Preguntar cuándo llegará el reembolso"],
      ["Get a reference number", "Pedir un número de referencia"],
      ["Ask to speak to a manager if needed", "Pedir hablar con un gerente si hace falta"],
    ],
    sessions: [
      {
        daysAgo: 9,
        covered: [0, 1, 2],
        exchanges: [
          {
            agent: "Thanks for calling. What can I help you with today?",
            user: "There is a mistake on my bill this month.",
          },
          {
            agent: "What amount are you seeing on the statement?",
            user: "It says one hundred twenty dollars but I usually pay sixty.",
          },
          {
            agent: "Why do you think the amount changed?",
            user: "Okay.",
          },
          {
            agent: "Would you like me to check the account for you?",
            user: "Yes please, that would help.",
            help: {
              native: "Sí por favor, revise la cuenta",
              suggested: "Yes please, could you check the account?",
              keyPhrase: "could you check the account",
            },
          },
        ],
      },
      {
        daysAgo: 2,
        covered: [3, 5],
        exchanges: [
          {
            agent: "What would you like me to do about the extra charge?",
            user: "Please remove it from my account and refund the difference.",
          },
          {
            agent: "When would be a good time to call you back?",
            user: "Okay.",
          },
          {
            agent: "What else can I help you with today?",
            user: "Could I have a reference number for this call?",
          },
        ],
      },
    ],
  },
  {
    title: "Asking my landlord to fix the heater",
    persona: "Mr. Chen, the building landlord",
    checklist: [
      ["Explain that the heater is broken", "Explicar que la calefacción no funciona"],
      ["Say how long it has been broken", "Decir cuánto tiempo lleva rota"],
      ["Say how cold the apartment is", "Decir qué tan frío está el apartamento"],
      ["Ask when someone can come to fix it", "Preguntar cuándo pueden venir a repararla"],
      ["Ask what happens if it is not fixed", "Preguntar qué pasa si no la reparan"],
      ["Point to what the lease says", "Señalar lo que dice el contrato"],
      ["Ask for the answer in writing", "Pedir la respuesta por escrito"],
    ],
    sessions: [
      {
        daysAgo: 1,
        covered: [0, 1, 2],
        exchanges: [
          {
            agent: "Hello, this is Mr. Chen. What's the problem?",
            user: "The heater in my apartment stopped working three days ago.",
          },
          {
            agent: "How cold is it getting in there?",
            user: "Very cold at night, maybe ten degrees.",
          },
          {
            agent: "When would suit you for someone to come round?",
            user: "Okay.",
          },
        ],
      },
    ],
  },
];

async function clearDemo(userId: string) {
  const { count } = await prisma.scenario.deleteMany({
    where: { userId, situationType: DEMO_MARKER },
  });
  return count;
}

async function main() {
  const deviceId = process.argv[2];
  const clearOnly = process.argv.includes("--clear");

  if (!deviceId) {
    console.error("usage: npx tsx scripts/seedDemo.ts <deviceId> [--clear]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { deviceId } });
  if (!user) {
    console.error(`No user with deviceId ${deviceId}`);
    process.exit(1);
  }

  const removed = await clearDemo(user.id);
  if (clearOnly) {
    console.log(`Removed ${removed} demo scenario(s).`);
    return;
  }
  if (removed) console.log(`Replaced ${removed} existing demo scenario(s).`);

  for (const spec of scenarios) {
    const scenario = await prisma.scenario.create({
      data: {
        userId: user.id,
        title: spec.title,
        situationType: DEMO_MARKER,
        personaDescription: spec.persona,
        contextSummary: `Practice conversation with ${spec.persona}.`,
        language: user.targetLanguage,
        checklist: spec.checklist.map(([en, native]) => ({ en, native })),
      },
    });

    for (const s of spec.sessions) {
      const startedAt = new Date(Date.now() - s.daysAgo * 86_400_000);
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          scenarioId: scenario.id,
          status: "completed",
          startedAt,
          endedAt: new Date(startedAt.getTime() + 600_000),
        },
      });

      let offset = 0;
      for (const ex of s.exchanges) {
        await prisma.turn.create({
          data: {
            sessionId: session.id,
            speaker: "agent",
            text: ex.agent,
            language: user.targetLanguage,
            createdAt: new Date(startedAt.getTime() + offset++ * 30_000),
          },
        });
        await prisma.turn.create({
          data: {
            sessionId: session.id,
            speaker: "user",
            text: ex.user,
            language: user.targetLanguage,
            // A turn with an attached help request is by definition one the
            // user needed a suggestion for -- Independence counts these.
            fromSuggestion: !!ex.help,
            createdAt: new Date(startedAt.getTime() + offset++ * 30_000),
          },
        });
        if (ex.help) {
          await prisma.translationAssistEvent.create({
            data: {
              userId: user.id,
              sessionId: session.id,
              nativeLanguage: user.nativeLanguage,
              nativeLanguageText: ex.help.native,
              suggestedText: ex.help.suggested,
              keyPhrase: ex.help.keyPhrase,
              category: "VOCABULARY",
              wasUsed: true,
            },
          });
        }
      }

      await prisma.feedbackReport.create({
        data: {
          sessionId: session.id,
          summary: "You got your main point across clearly.",
          summaryNative: "Explicaste bien tu punto principal.",
          struggleAreas: ["Asking follow-up questions"],
          struggleAreasNative: ["Hacer preguntas de seguimiento"],
          vocabularySuggestions: [],
          conversationSummary: `You spoke with ${spec.persona} about ${spec.title.toLowerCase()}.`,
          conversationSummaryNative: `Hablaste con ${spec.persona}.`,
          coveredIndices: s.covered,
        },
      });
    }
  }

  console.log(`Seeded ${scenarios.length} scenarios for ${deviceId}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
