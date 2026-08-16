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
 *
 * Native-language text is keyed by language name rather than hardcoded to
 * one language -- a single hardcoded language silently mismatches the moment
 * this is run against an account whose nativeLanguage is something else
 * (this happened twice: once shipped as Spanish, once "fixed" to Hindi and
 * immediately wrong again for a Mandarin account). SUPPORTED_LANGUAGES below
 * is the actual coverage; anything outside it falls back to English rather
 * than showing text in the wrong language.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_MARKER = "__demo_seed";

type Localized = Partial<Record<"Hindi" | "Mandarin", string>>;

function native(englishFallback: string, translations: Localized, nativeLanguage: string): string {
  const match = (translations as Record<string, string | undefined>)[nativeLanguage];
  if (match) return match;
  console.warn(
    `seedDemo: no "${nativeLanguage}" translation for "${englishFallback}" -- using English so nothing shows in the wrong language.`
  );
  return englishFallback;
}

type Exchange = {
  agent: string;
  user: string;
  /** A help request on this turn, as the user would have made it. */
  help?: { native: Localized; suggested: string; keyPhrase: string };
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
  checklist: [string, Localized][];
  sessions: DemoSession[];
}

const scenarios: DemoScenario[] = [
  {
    title: "First appointment with a new doctor",
    persona: "Dr. Anya Sharma, a family doctor",
    checklist: [
      ["Explain why you came in", { Hindi: "आप क्यों आए यह बताएं", Mandarin: "解释你为什么来看病" }],
      [
        "Describe when the symptoms started",
        { Hindi: "लक्षण कब शुरू हुए यह बताएं", Mandarin: "描述症状是什么时候开始的" },
      ],
      ["Say how bad the pain is", { Hindi: "दर्द कितना तेज़ है यह बताएं", Mandarin: "说明疼痛有多严重" }],
      [
        "Mention any medication you take",
        { Hindi: "आप जो दवा लेते हैं उसका उल्लेख करें", Mandarin: "提及你正在服用的药物" },
      ],
      [
        "Ask what the treatment options are",
        { Hindi: "पूछें कि इलाज के विकल्प क्या हैं", Mandarin: "询问有哪些治疗方案" },
      ],
      ["Ask what it will cost", { Hindi: "पूछें कि इसका खर्च कितना होगा", Mandarin: "询问费用是多少" }],
      [
        "Ask them to repeat something you missed",
        { Hindi: "जो आपको समझ नहीं आया उसे दोहराने के लिए कहें", Mandarin: "请对方重复你没听懂的地方" },
      ],
      ["Book a follow-up appointment", { Hindi: "अगली मुलाकात के लिए अपॉइंटमेंट लें", Mandarin: "预约复诊" }],
    ],
    sessions: [
      {
        daysAgo: 25,
        covered: [0],
        exchanges: [
          {
            agent: "Good morning. What brings you in today?",
            user: "I have some pain.",
            help: {
              native: { Hindi: "मुझे दो हफ्तों से पीठ में दर्द है", Mandarin: "我背痛已经两周了" },
              suggested: "I've had pain in my back for two weeks.",
              keyPhrase: "i've had pain in my back for two weeks",
            },
          },
          {
            agent: "How would you describe the pain — is it sharp or dull?",
            user: "I don't know.",
          },
          {
            agent: "Are you taking any medication at the moment?",
            user: "Okay.",
          },
          {
            agent: "What would you like to do about it?",
            user: "Mm.",
            help: {
              native: { Hindi: "मैं जानना चाहता हूं कि इलाज के विकल्प क्या हैं", Mandarin: "我想知道有哪些治疗方案" },
              suggested: "I'd like to know what the treatment options are.",
              keyPhrase: "i'd like to know what the treatment options are",
            },
          },
        ],
      },
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
              native: { Hindi: "मैं दिन में दो बार आइबुप्रोफेन लेता हूं", Mandarin: "我每天服用两次布洛芬" },
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
              native: { Hindi: "मैं पहले फिजियोथेरेपी आज़माना चाहता हूं", Mandarin: "我想先尝试物理治疗" },
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
      [
        "Explain what looks wrong on the bill",
        { Hindi: "बिल में क्या गलत लग रहा है यह बताएं", Mandarin: "解释账单上哪里有问题" },
      ],
      [
        "Say what you normally pay",
        { Hindi: "आप आमतौर पर कितना भुगतान करते हैं यह बताएं", Mandarin: "说明你平常支付的金额" },
      ],
      ["Ask them to check the account", { Hindi: "खाता जांचने के लिए कहें", Mandarin: "请对方检查账户" }],
      [
        "Ask for the extra charge to be removed",
        { Hindi: "अतिरिक्त शुल्क हटाने के लिए कहें", Mandarin: "要求取消多收的费用" },
      ],
      ["Ask when the refund will arrive", { Hindi: "पूछें कि रिफंड कब आएगा", Mandarin: "询问退款何时到账" }],
      ["Get a reference number", { Hindi: "संदर्भ नंबर प्राप्त करें", Mandarin: "获取一个参考编号" }],
      [
        "Ask to speak to a manager if needed",
        { Hindi: "ज़रूरत पड़े तो मैनेजर से बात करने के लिए कहें", Mandarin: "如有需要，要求与经理通话" },
      ],
    ],
    sessions: [
      {
        daysAgo: 20,
        covered: [0],
        exchanges: [
          {
            agent: "Thanks for calling. What can I help you with today?",
            user: "There is a problem.",
            help: {
              native: { Hindi: "मेरे बिल में इस महीने एक गलती है", Mandarin: "我这个月的账单有一个错误" },
              suggested: "There is a mistake on my bill this month.",
              keyPhrase: "there is a mistake on my bill this month",
            },
          },
          {
            agent: "What amount are you seeing on the statement?",
            user: "I don't know.",
          },
          {
            agent: "Why do you think the amount changed?",
            user: "Okay.",
          },
          {
            agent: "Would you like me to check the account for you?",
            user: "Mm.",
            help: {
              native: { Hindi: "जी हां, कृपया खाता जांचें", Mandarin: "好的，请检查一下账户" },
              suggested: "Yes please, could you check the account?",
              keyPhrase: "could you check the account",
            },
          },
        ],
      },
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
              native: { Hindi: "जी हां, कृपया खाता जांचें", Mandarin: "好的，请检查一下账户" },
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
      ["Explain that the heater is broken", { Hindi: "बताएं कि हीटर खराब है", Mandarin: "说明暖气坏了" }],
      ["Say how long it has been broken", { Hindi: "बताएं कि यह कब से खराब है", Mandarin: "说明坏了多久了" }],
      [
        "Say how cold the apartment is",
        { Hindi: "बताएं कि अपार्टमेंट कितना ठंडा है", Mandarin: "说明公寓有多冷" },
      ],
      [
        "Ask when someone can come to fix it",
        { Hindi: "पूछें कि इसे ठीक करने कब कोई आ सकता है", Mandarin: "询问什么时候能有人来修" },
      ],
      [
        "Ask what happens if it is not fixed",
        { Hindi: "पूछें कि अगर यह ठीक न हुआ तो क्या होगा", Mandarin: "询问如果不修会怎样" },
      ],
      ["Point to what the lease says", { Hindi: "लीज़ में क्या लिखा है इस ओर इशारा करें", Mandarin: "指出租约里写的内容" }],
      ["Ask for the answer in writing", { Hindi: "जवाब लिखित में मांगें", Mandarin: "要求书面回复" }],
    ],
    sessions: [
      {
        daysAgo: 18,
        covered: [0],
        exchanges: [
          {
            agent: "Hello, this is Mr. Chen. What's the problem?",
            user: "It's broken.",
            help: {
              native: { Hindi: "मेरे अपार्टमेंट में हीटर तीन दिन पहले खराब हो गया", Mandarin: "我公寓的暖气三天前坏了" },
              suggested: "The heater in my apartment stopped working three days ago.",
              keyPhrase: "the heater stopped working three days ago",
            },
          },
          {
            agent: "How cold is it getting in there?",
            user: "I don't know.",
          },
          {
            agent: "When would suit you for someone to come round?",
            user: "Mm.",
          },
        ],
      },
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
        checklist: spec.checklist.map(([en, translations]) => ({
          en,
          native: native(en, translations, user.nativeLanguage),
        })),
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
              nativeLanguageText: native(ex.help.suggested, ex.help.native, user.nativeLanguage),
              suggestedText: ex.help.suggested,
              keyPhrase: ex.help.keyPhrase,
              category: "VOCABULARY",
              wasUsed: true,
            },
          });
        }
      }

      const summaryEn = "You got your main point across clearly.";
      const conversationSummaryEn = `You spoke with ${spec.persona} about ${spec.title.toLowerCase()}.`;

      await prisma.feedbackReport.create({
        data: {
          sessionId: session.id,
          summary: summaryEn,
          summaryNative: native(
            summaryEn,
            { Hindi: "आपने अपनी मुख्य बात स्पष्ट रूप से समझाई।", Mandarin: "你清楚地表达了你的主要意思。" },
            user.nativeLanguage
          ),
          vocabularySuggestions: [],
          conversationSummary: conversationSummaryEn,
          conversationSummaryNative: native(
            conversationSummaryEn,
            { Hindi: `आपने ${spec.persona} से बात की।`, Mandarin: `你和${spec.persona}谈过了。` },
            user.nativeLanguage
          ),
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
