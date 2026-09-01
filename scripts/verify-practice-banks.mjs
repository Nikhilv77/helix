/**
 * Read-only check that the new Practice banks seeded the way the spec expects.
 *
 *   DATABASE_URL="<url>" node scripts/verify-practice-banks.mjs
 *
 * Writes nothing. Exits non-zero if an expectation fails, so it can gate a
 * deploy later if that turns out to be useful.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPECTED = {
  total: 149,
  formats: { "predict-run": 10, "find-the-flaw": 48, diagnose: 16 },
  placementBank: 42,
  sessionFloors: {
    "core-technical": 12,
    "applied-engineering": 40,
    "architecture-system-design": 12,
    "resume-behavioral-defense": 8
  }
};

const failures = [];
const check = (label, actual, expected, compare = (a, b) => a === b) => {
  const ok = compare(actual, expected);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(46)} ${actual}${ok ? "" : `  (expected ${expected})`}`);
  if (!ok) failures.push(label);
};

async function main() {
  const rows = await prisma.prepQuestionTemplate.findMany({
    select: { sessionKey: true, chapterKey: true, format: true, publicationStatus: true }
  });

  console.log("\nTotals");
  check("prepQuestionTemplate rows", rows.length, EXPECTED.total);

  console.log("\nNew formats present and published");
  for (const [format, expected] of Object.entries(EXPECTED.formats)) {
    const all = rows.filter((r) => r.format === format);
    const published = all.filter((r) => r.publicationStatus === "PUBLISHED");
    check(`${format} — seeded`, all.length, expected);
    check(`${format} — PUBLISHED (not DRAFT)`, published.length, expected);
  }

  console.log("\nSession counts against their floors");
  const bySession = new Map();
  for (const row of rows.filter((r) => r.publicationStatus === "PUBLISHED")) {
    const entry = bySession.get(row.sessionKey) ?? { count: 0, chapters: new Set() };
    entry.count += 1;
    entry.chapters.add(row.chapterKey);
    bySession.set(row.sessionKey, entry);
  }
  for (const [session, floor] of Object.entries(EXPECTED.sessionFloors)) {
    const entry = bySession.get(session) ?? { count: 0, chapters: new Set() };
    check(`${session} (>= floor)`, entry.count, floor, (a, b) => a >= b);
    console.log(`        chapters: ${[...entry.chapters].sort().join(", ") || "none"}`);
  }

  console.log("\nMCQ retirement");
  const placement = rows.filter((r) => r.sessionKey === "placement");
  check("mcq moved to the placement bank", placement.length, EXPECTED.placementBank);
  const appliedMcq = rows.filter(
    (r) => r.sessionKey === "applied-engineering" && r.format === "mcq"
  ).length;
  check("no mcq left in applied-engineering", appliedMcq, 0);

  console.log(
    failures.length
      ? `\n${failures.length} check(s) failed.\n`
      : "\nAll checks passed. The MCQs can now be retired without dropping below the floor.\n"
  );
  process.exitCode = failures.length ? 1 : 0;
}

main()
  .catch((error) => {
    console.error("verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
