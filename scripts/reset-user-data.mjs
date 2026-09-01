/**
 * Deletes every row tied to a person, and nothing else.
 *
 *   node scripts/reset-user-data.mjs           dry run — counts only, deletes nothing
 *   node scripts/reset-user-data.mjs --confirm actually delete
 *
 * Why this instead of `prisma migrate reset`: reset drops the content tables too
 * and relies on the seed to rebuild them. That works, but it is a bigger blast
 * radius than the goal needs and it forces a full re-onboarding. This removes
 * only the user side, so the DSA bank, prep templates, roadmap templates and
 * knowledge chunks are never even touched.
 *
 * Deletion runs children-first so it does not depend on cascade behaviour being
 * what anyone remembers. Afterwards it re-counts the content tables and fails
 * loudly if a single row moved — that assertion is the point of the script.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");

/** Children before parents. Order matters; cascades are a fallback, not the plan. */
const USER_TABLES = [
  "userQuestionAttempt",
  "userPrepQuestionNote",
  "userDsaQuestionNote",
  "practiceQuestionPlacement",
  "userQuestionProgress",
  "userChapterProgress",
  "userSessionProgress",
  "userRoadmap",
  "interviewAnswerRequest",
  "interviewSession",
  "interviewSessionBlueprint",
  "personalizedInterviewPlanVersion",
  "candidateInterviewProfileVersion",
  "candidatePracticeEvidenceVersion",
  "candidatePerformanceProfileVersion",
  "helpReport",
  "helpSession",
  "helpRequestDecline",
  "helpRequest",
  "helpBlock",
  "notification",
  "userMayaInsight",
  "designSession",
  "project",
  "candidateProfile"
];

/** Must be identical before and after. */
const CONTENT_TABLES = [
  "dsaPhase",
  "dsaQuestion",
  "prepQuestionTemplate",
  "roadmapTemplate",
  "roadmapSessionTemplate",
  "roadmapChapterTemplate",
  "roadmapQuestionTemplate",
  "knowledgeDocument",
  "knowledgeChunk"
];

const count = async (tables) => {
  const out = {};
  for (const table of tables) out[table] = await prisma[table].count();
  return out;
};

const pad = (v, w) => String(v).padStart(w);

async function main() {
  const userBefore = await count(USER_TABLES);
  const contentBefore = await count(CONTENT_TABLES);

  console.log("\nContent — preserved, never touched");
  for (const [table, n] of Object.entries(contentBefore)) {
    console.log(`  ${table.padEnd(28)} ${pad(n, 6)}`);
  }

  const userTotal = Object.values(userBefore).reduce((a, b) => a + b, 0);
  console.log(`\nUser data — ${confirm ? "deleting" : "would delete"}`);
  for (const [table, n] of Object.entries(userBefore)) {
    if (n > 0) console.log(`  ${table.padEnd(28)} ${pad(n, 6)}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${pad(userTotal, 6)}`);

  if (!confirm) {
    console.log("\nDry run. Nothing was deleted. Re-run with --confirm to proceed.\n");
    return;
  }

  let deleted = 0;
  for (const table of USER_TABLES) {
    const result = await prisma[table].deleteMany({});
    deleted += result.count;
  }

  const contentAfter = await count(CONTENT_TABLES);
  const drift = Object.entries(contentAfter).filter(
    ([table, n]) => n !== contentBefore[table]
  );

  const userAfter = await count(USER_TABLES);
  const remaining = Object.values(userAfter).reduce((a, b) => a + b, 0);

  console.log(`\nDeleted ${deleted} rows. ${remaining} user rows remain.`);

  if (drift.length) {
    console.log("\nCONTENT CHANGED — this should be impossible:");
    for (const [table, n] of drift) {
      console.log(`  ${table}: ${contentBefore[table]} -> ${n}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Content verified unchanged: DSA bank, prep templates and roadmap templates intact.");
  console.log("\nNext: open /practice — onboarding runs again and the roadmap regenerates");
  console.log("against the current banks, which is what puts the new questions in front of you.\n");
}

main()
  .catch((error) => {
    console.error("reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
