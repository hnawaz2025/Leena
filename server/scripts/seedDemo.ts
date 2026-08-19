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
    title: "Parent-teacher conference for my daughter",
    persona: "Ms. Whitfield, your daughter's third-grade teacher",
    checklist: [
      [
        "Ask how your child is doing overall",
        { Hindi: "पूछें कि आपकी बेटी कुल मिलाकर कैसा कर रही है", Mandarin: "询问你的孩子总体表现如何" },
      ],
      [
        "Ask which subjects she's struggling with",
        { Hindi: "पूछें कि वह किन विषयों में कठिनाई महसूस कर रही है", Mandarin: "询问她在哪些科目上有困难" },
      ],
      [
        "Explain her routine at home",
        { Hindi: "घर पर उसकी दिनचर्या के बारे में बताएं", Mandarin: "解释她在家的日常安排" },
      ],
      [
        "Ask what you can do to help at home",
        { Hindi: "पूछें कि आप घर पर मदद के लिए क्या कर सकते हैं", Mandarin: "询问你在家能做些什么来帮助她" },
      ],
      [
        "Ask about upcoming tests or assignments",
        { Hindi: "आगामी परीक्षाओं या असाइनमेंट के बारे में पूछें", Mandarin: "询问即将到来的测验或作业" },
      ],
      [
        "Ask if she needs extra support, like ESL",
        {
          Hindi: "पूछें कि क्या उसे अतिरिक्त सहायता चाहिए, जैसे ईएसएल",
          Mandarin: "询问她是否需要额外支持，比如ESL",
        },
      ],
      [
        "Ask them to repeat something you missed",
        { Hindi: "जो आपको समझ नहीं आया उसे दोहराने के लिए कहें", Mandarin: "请对方重复你没听懂的地方" },
      ],
      [
        "Schedule a follow-up conversation",
        { Hindi: "अगली बातचीत के लिए समय तय करें", Mandarin: "安排下一次谈话的时间" },
      ],
    ],
    sessions: [
      {
        daysAgo: 22,
        covered: [0],
        exchanges: [
          {
            agent: "Thanks for coming in. Overall, how do you think she's doing?",
            user: "She is okay.",
            help: {
              native: {
                Hindi: "मुझे लगता है कि वह ठीक कर रही है, लेकिन मुझे पक्का नहीं पता",
                Mandarin: "我觉得她做得还不错，但我不太确定",
              },
              suggested: "I think she's doing okay, but I'm not totally sure.",
              keyPhrase: "i think she's doing okay but i'm not sure",
            },
          },
          {
            agent: "Are there any subjects she seems to struggle with at home?",
            user: "I don't know.",
          },
          {
            agent: "That's alright. What does her evening routine look like?",
            user: "Okay.",
          },
          {
            agent: "No problem — is there anything specific you'd like to ask me today?",
            user: "Mm.",
            help: {
              native: { Hindi: "क्या मैं घर पर उसकी मदद के लिए कुछ कर सकता हूं", Mandarin: "我能在家帮她做些什么吗" },
              suggested: "Is there anything I can do at home to help her?",
              keyPhrase: "is there anything i can do at home to help her",
            },
          },
        ],
      },
      {
        daysAgo: 10,
        covered: [0, 1, 3],
        exchanges: [
          {
            agent: "Thanks for coming in. Overall, how do you think she's doing?",
            user: "I think she's doing okay, but I'm not totally sure.",
          },
          {
            agent: "Are there any subjects she seems to struggle with at home?",
            user: "She has trouble with reading, especially new words.",
          },
          {
            agent: "That's helpful to know. What does her evening routine look like?",
            user: "Okay.",
          },
          {
            agent: "No problem — is there anything specific you'd like to ask me today?",
            user: "Is there anything I can do at home to help her?",
            help: {
              native: { Hindi: "आप हर रात 15 मिनट साथ पढ़ने की कोशिश कर सकते हैं", Mandarin: "你可以试着每晚一起读书15分钟" },
              suggested: "You could try reading together for 15 minutes every night.",
              keyPhrase: "reading together for 15 minutes every night",
            },
          },
        ],
      },
      {
        daysAgo: 4,
        covered: [2, 4, 7],
        exchanges: [
          {
            agent: "How has the evening reading been going since we last spoke?",
            user: "We read together most nights, and she is enjoying it more now.",
          },
          {
            agent: "That's great progress. There's a small reading test coming up next Friday.",
            user: "Thank you for telling me. Is there anything specific she should practice?",
          },
          {
            agent: "Mostly just sight words — I'll send a list home. Should we plan to check in again soon?",
            user: "Yes, could we meet again in one month?",
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
  // The five scenarios below exist to give Coverage a real "previous" window
  // to compare against (SCENARIO_WINDOW_SIZE = 4 in routes/metrics.ts, so
  // the trend needs 8 distinct scenarios total, not 8 sessions). Each gets
  // one earlier, lower-coverage attempt rather than a full three-session
  // arc -- they're here to be the *older, less-ready* half of the trend, not
  // to carry their own narrative the way the three above do.
  {
    title: "Renewing my driver's license at the DMV",
    persona: "A DMV clerk at the counter",
    checklist: [
      ["Say which service you need", { Hindi: "बताएं कि आपको कौन सी सेवा चाहिए", Mandarin: "说明你需要哪项服务" }],
      [
        "Hand over the right documents",
        { Hindi: "सही दस्तावेज़ सौंपें", Mandarin: "递交正确的证件" },
      ],
      ["Ask how much it costs", { Hindi: "पूछें कि इसका खर्च कितना है", Mandarin: "询问费用是多少" }],
      [
        "Ask how long the new one takes to arrive",
        { Hindi: "पूछें कि नया लाइसेंस आने में कितना समय लगेगा", Mandarin: "询问新证需要多久寄到" },
      ],
      ["Ask them to repeat something you missed", { Hindi: "जो समझ नहीं आया उसे दोहराने के लिए कहें", Mandarin: "请对方重复你没听懂的地方" }],
    ],
    sessions: [
      {
        daysAgo: 52,
        covered: [0],
        exchanges: [
          {
            agent: "Next. What are you here for today?",
            user: "License.",
            help: {
              native: { Hindi: "मैं अपना ड्राइविंग लाइसेंस नवीनीकृत करने आया हूं", Mandarin: "我是来续驾照的" },
              suggested: "I'm here to renew my driver's license.",
              keyPhrase: "i'm here to renew my driver's license",
            },
          },
          {
            agent: "Do you have your current license and proof of address?",
            user: "Yes, here.",
          },
          {
            agent: "That'll be forty dollars. How would you like to pay?",
            user: "I don't know.",
          },
        ],
      },
    ],
  },
  {
    title: "Asking my manager for time off",
    persona: "Priya, your shift supervisor",
    checklist: [
      ["Say which dates you need off", { Hindi: "बताएं कि आपको किन तारीखों को छुट्टी चाहिए", Mandarin: "说明你需要哪几天休假" }],
      ["Explain the reason briefly", { Hindi: "संक्षेप में कारण बताएं", Mandarin: "简单说明原因" }],
      [
        "Ask who will cover your shift",
        { Hindi: "पूछें कि आपकी शिफ्ट कौन संभालेगा", Mandarin: "询问谁会顶替你的班" },
      ],
      ["Ask when you'll get an answer", { Hindi: "पूछें कि जवाब कब मिलेगा", Mandarin: "询问何时能得到答复" }],
      [
        "Thank them for considering it",
        { Hindi: "विचार करने के लिए उन्हें धन्यवाद दें", Mandarin: "感谢对方的考虑" },
      ],
    ],
    sessions: [
      {
        daysAgo: 47,
        covered: [0],
        exchanges: [
          {
            agent: "Hey, you wanted to talk to me?",
            user: "Yes. I need days off.",
            help: {
              native: { Hindi: "क्या मैं अगले हफ्ते शुक्रवार और शनिवार को छुट्टी ले सकता हूं", Mandarin: "我下周五和周六能请假吗" },
              suggested: "Could I take next Friday and Saturday off?",
              keyPhrase: "could i take next friday and saturday off",
            },
          },
          {
            agent: "I can probably make that work. What's it for, if you don't mind me asking?",
            user: "Okay.",
          },
          {
            agent: "No worries either way. Let me check the schedule and get back to you.",
            user: "Thank you.",
          },
        ],
      },
    ],
  },
  {
    title: "Signing up for an ESL class at the community center",
    persona: "Tom, the community center registrar",
    checklist: [
      [
        "Say you'd like to register for classes",
        { Hindi: "बताएं कि आप कक्षा में दाखिला लेना चाहते हैं", Mandarin: "说明你想报名上课" },
      ],
      ["Ask what levels are offered", { Hindi: "पूछें कि कौन से स्तर उपलब्ध हैं", Mandarin: "询问有哪些级别" }],
      ["Ask about the class schedule", { Hindi: "कक्षा के समय के बारे में पूछें", Mandarin: "询问上课时间" }],
      ["Ask if there is a fee", { Hindi: "पूछें कि कोई शुल्क है या नहीं", Mandarin: "询问是否需要费用" }],
      [
        "Ask what to bring on the first day",
        { Hindi: "पूछें कि पहले दिन क्या लाना है", Mandarin: "询问第一天需要带什么" },
      ],
    ],
    sessions: [
      {
        daysAgo: 60,
        covered: [0, 2],
        exchanges: [
          {
            agent: "Hi there, how can I help you today?",
            user: "I want to join English class.",
          },
          {
            agent: "Great — we have morning and evening sections. Which works better for you?",
            user: "Evening, please.",
            help: {
              native: { Hindi: "शाम की कक्षा मेरे लिए बेहतर रहेगी क्योंकि मैं दिन में काम करता हूं", Mandarin: "晚上的班对我更方便，因为我白天要工作" },
              suggested: "Evening works better for me since I work during the day.",
              keyPhrase: "evening works better since i work during the day",
            },
          },
          {
            agent: "Perfect, evenings it is. Anything else you'd like to know?",
            user: "Okay.",
          },
        ],
      },
    ],
  },
  {
    title: "Talking to a pharmacist about my prescription",
    persona: "The pharmacist at the counter",
    checklist: [
      [
        "Say you're picking up a prescription",
        { Hindi: "बताएं कि आप दवा लेने आए हैं", Mandarin: "说明你是来取药的" },
      ],
      [
        "Ask how to take the medication",
        { Hindi: "पूछें कि दवा कैसे लेनी है", Mandarin: "询问药该怎么吃" },
      ],
      ["Ask about side effects", { Hindi: "दुष्प्रभावों के बारे में पूछें", Mandarin: "询问副作用" }],
      [
        "Say what other medication you already take",
        { Hindi: "बताएं कि आप पहले से कौन सी अन्य दवा लेते हैं", Mandarin: "说明你目前在服用的其他药物" },
      ],
      ["Ask if it's covered by insurance", { Hindi: "पूछें कि क्या यह बीमा में शामिल है", Mandarin: "询问是否有保险覆盖" }],
    ],
    sessions: [
      {
        daysAgo: 41,
        covered: [0],
        exchanges: [
          {
            agent: "Hi, are you picking up today?",
            user: "Yes.",
            help: {
              native: { Hindi: "जी हां, मैं शर्मा के नाम से दवा लेने आया हूं", Mandarin: "是的，我来取Sharma名下的药" },
              suggested: "Yes, I'm picking up a prescription under the name Sharma.",
              keyPhrase: "picking up a prescription under the name sharma",
            },
          },
          {
            agent: "Great, one moment. Do you have any questions about how to take it?",
            user: "I don't know.",
          },
          {
            agent: "No problem — take one tablet in the morning with food. Anything else today?",
            user: "Okay, thank you.",
          },
        ],
      },
    ],
  },
  {
    title: "Understanding a job application form",
    persona: "Front-desk staff at the hiring office",
    checklist: [
      [
        "Say you need help with the form",
        { Hindi: "बताएं कि आपको फॉर्म भरने में मदद चाहिए", Mandarin: "说明你需要填表帮助" },
      ],
      [
        "Point to the section you don't understand",
        { Hindi: "जो हिस्सा समझ नहीं आया उस ओर इशारा करें", Mandarin: "指出你不理解的部分" },
      ],
      [
        "Ask what a specific term means",
        { Hindi: "पूछें कि किसी शब्द का मतलब क्या है", Mandarin: "询问某个词是什么意思" },
      ],
      [
        "Ask if you can finish it at home",
        { Hindi: "पूछें कि क्या आप इसे घर पर पूरा कर सकते हैं", Mandarin: "询问是否可以带回家填完" },
      ],
      ["Ask when it's due back", { Hindi: "पूछें कि यह कब तक जमा करना है", Mandarin: "询问截止日期是什么时候" }],
    ],
    sessions: [
      {
        daysAgo: 36,
        covered: [0, 1],
        exchanges: [
          {
            agent: "Hi, how can I help?",
            user: "This form, I don't understand.",
            help: {
              native: { Hindi: "क्या आप इस फॉर्म को भरने में मेरी मदद कर सकते हैं", Mandarin: "你能帮我填这张表吗" },
              suggested: "Could you help me fill out this form?",
              keyPhrase: "could you help me fill out this form",
            },
          },
          {
            agent: "Of course — which part is giving you trouble?",
            user: "This word here.",
          },
          {
            agent: "Ah, that means your most recent employer. Does that make sense?",
            user: "Yes, thank you.",
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
        // Derived rather than declared: the first thing the persona says in
        // the seeded transcript is by definition how it opens, and keeping
        // one source means they can't drift apart.
        openingLine: spec.sessions[0]?.exchanges[0]?.agent ?? "",
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
