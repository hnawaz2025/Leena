/**
 * One-off backfill: un-glue Scenario.contextSummary into its own columns.
 *
 *   npx tsx scripts/backfillScenarioFields.ts [--dry]
 *
 * Scenarios created before openingLine/keyVocabulary existed stored all three
 * values in one string:
 *
 *   <context prose>
 *
 *   Opening line: <line>
 *   Key vocabulary: a, b, c
 *
 * This parses that shape back apart. Idempotent -- rows that don't match the
 * glued format, or that already have an openingLine, are skipped, so running
 * it twice is safe.
 *
 * Delete this script once no deployment has pre-split scenarios left.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GLUED = /^([\s\S]*?)\n\nOpening line: (.*?)(?:\nKey vocabulary: (.*))?$/;

async function main() {
  const dryRun = process.argv.includes("--dry");

  const scenarios = await prisma.scenario.findMany({
    select: { id: true, title: true, contextSummary: true, openingLine: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const scenario of scenarios) {
    if (scenario.openingLine) {
      skipped += 1;
      continue;
    }

    const match = scenario.contextSummary.match(GLUED);
    if (!match) {
      skipped += 1;
      continue;
    }

    const [, context, openingLine, vocabList] = match;
    const keyVocabulary = (vocabList ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    console.log(`${dryRun ? "[dry] " : ""}${scenario.title}`);
    console.log(`    opening : ${openingLine}`);
    console.log(`    vocab   : ${keyVocabulary.length} term(s)`);

    if (!dryRun) {
      await prisma.scenario.update({
        where: { id: scenario.id },
        data: { contextSummary: context.trim(), openingLine, keyVocabulary },
      });
    }
    updated += 1;
  }

  console.log(`\n${dryRun ? "Would update" : "Updated"} ${updated}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
