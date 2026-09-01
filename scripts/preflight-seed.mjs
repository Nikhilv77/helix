/**
 * Read-only pre-flight for `prisma db seed`.
 *
 * The seed calls deleteMany on RoadmapSessionTemplate and RoadmapChapterTemplate.
 * Both cascade into user progress:
 *
 *   RoadmapSessionTemplate --Cascade--> UserSessionProgress --Cascade--> UserQuestionProgress
 *                                                           --Cascade--> UserChapterProgress
 *   RoadmapChapterTemplate --Cascade--> UserChapterProgress
 *
 * Most of those deletes are scoped with `notIn` and remove nothing when the seed
 * source matches the database. One is not: the final-mock session has all of its
 * question templates deleted unconditionally (seed.ts, "if (finalSession)").
 * That one is safe — UserQuestionProgress references question templates with
 * SetNull, not Cascade — but the session and chapter deletes are the ones worth
 * checking before you run anything.
 *
 * This script writes nothing. Run it before and after seeding and compare.
 *
 *   node scripts/preflight-seed.mjs            print a snapshot
 *   node scripts/preflight-seed.mjs --save     also write .preflight-seed.json
 *   node scripts/preflight-seed.mjs --compare  diff against the saved snapshot
 */

import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const SNAPSHOT = ".preflight-seed.json";
const prisma = new PrismaClient();

const AT_RISK = [
  "userSessionProgress",
  "userChapterProgress",
  "userQuestionProgress",
  "userQuestionAttempt"
];

const TEMPLATES = [
  "roadmapTemplate",
  "roadmapSessionTemplate",
  "roadmapChapterTemplate",
  "roadmapQuestionTemplate",
  "prepQuestionTemplate"
];

async function counts() {
  const result = {};
  for (const model of [...TEMPLATES, ...AT_RISK, "userRoadmap"]) {
    result[model] = await prisma[model].count();
  }
  return result;
}

function pad(value, width) {
  return String(value).padStart(width);
}

async function main() {
  const mode = process.argv[2] ?? "";
  const now = await counts();

  console.log("\nTemplate tables (the seed rewrites these)");
  for (const model of TEMPLATES) console.log(`  ${model.padEnd(26)} ${pad(now[model], 7)}`);

  console.log("\nUser data (cascades from the two template deletes)");
  console.log(`  ${"userRoadmap".padEnd(26)} ${pad(now.userRoadmap, 7)}`);
  for (const model of AT_RISK) console.log(`  ${model.padEnd(26)} ${pad(now[model], 7)}`);

  // Which session/chapter templates actually have progress hanging off them.
  const sessions = await prisma.roadmapSessionTemplate.findMany({
    select: {
      slug: true,
      _count: { select: { progress: true } }
    },
    orderBy: { slug: "asc" }
  });

  const exposed = sessions.filter((session) => session._count.progress > 0);
  console.log("\nSession templates with user progress attached");
  if (exposed.length === 0) {
    console.log("  none — a session delete would cascade into nothing");
  } else {
    for (const session of exposed) {
      console.log(`  ${session.slug.padEnd(26)} ${pad(session._count.progress, 7)}`);
    }
    console.log("\n  These rows disappear if the seed drops the matching session template.");
    console.log("  The seed only drops sessions absent from its source, so this should be");
    console.log("  zero-impact — but compare the counts above after seeding to confirm.");
  }

  if (mode === "--save") {
    writeFileSync(SNAPSHOT, JSON.stringify(now, null, 2));
    console.log(`\nSaved ${SNAPSHOT}. Re-run with --compare after seeding.`);
  }

  if (mode === "--compare") {
    let before;
    try {
      before = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    } catch {
      console.log(`\nNo ${SNAPSHOT} found. Run with --save before seeding.`);
      return;
    }
    console.log("\nChange since snapshot");
    let lost = false;
    for (const [model, after] of Object.entries(now)) {
      const delta = after - (before[model] ?? 0);
      if (delta === 0) continue;
      const flag = delta < 0 && AT_RISK.includes(model) ? "  <-- USER DATA LOST" : "";
      if (flag) lost = true;
      console.log(`  ${model.padEnd(26)} ${pad(before[model] ?? 0, 7)} -> ${pad(after, 7)}  ${delta > 0 ? "+" : ""}${delta}${flag}`);
    }
    console.log(lost ? "\nUser progress was deleted. Restore from backup." : "\nNo user progress lost.");
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error("preflight failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
