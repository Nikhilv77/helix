/**
 * Re-scores completed DSA block assessments with the current scoring rules.
 *
 * Reports written before 2026-09-26 read the coding problem's evaluation under
 * the wrong metric names (only `communication` matched), and could be frozen
 * before that evaluation arrived. This recomputes each report from its saved
 * session and frozen snapshot. It changes only `reportSnapshot`; the block's
 * status, completion time, and later recommendations are left as they are.
 *
 * Dry run by default. Pass --apply to write; the replaced reports are first
 * saved to a backup file whose path is printed.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { parseDsaBlockAssessmentSnapshot } from "../src/features/practice/dsa/domain/block-assessment";
import { parseDsaBlockAssessmentReport } from "../src/features/practice/dsa/domain/block-assessment-report";
import { scoreBlockAssessment } from "../src/features/practice/dsa/server/dsa-block-assessment-finalization.service";
import type { InterviewState } from "../src/features/interviews/server/types";
import { getPrismaService } from "../src/server/database/prisma.service";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const prisma = getPrismaService();
  const counts = { checked: 0, changed: 0, unchanged: 0, missingGrade: 0, failed: 0 };
  const updates: Array<{ id: string; before: unknown; after: unknown }> = [];
  try {
    const assessments = await prisma.dsaBlockAssessment.findMany({
      where: { completedAt: { not: null }, interviewSessionId: { not: null } },
      select: {
        id: true,
        ownerId: true,
        completedAt: true,
        interviewSessionId: true,
        assessmentSnapshot: true,
        reportSnapshot: true
      },
      orderBy: { completedAt: "asc" }
    });

    for (const assessment of assessments) {
      if (!assessment.reportSnapshot) continue;
      counts.checked += 1;
      const label = `${assessment.id.slice(0, 8)} (${assessment.completedAt!.toISOString().slice(0, 10)})`;
      try {
        const session = await prisma.interviewSession.findUnique({
          where: { id: assessment.interviewSessionId! },
          select: { state: true }
        });
        const state = session?.state as unknown as InterviewState | undefined;
        if (!state || state.phase !== "done") throw new Error("session is missing or unfinished");

        const snapshot = parseDsaBlockAssessmentSnapshot(assessment.assessmentSnapshot);
        const before = parseDsaBlockAssessmentReport(assessment.reportSnapshot);
        const after = scoreBlockAssessment({
          snapshot,
          assessmentId: assessment.id,
          state,
          now: assessment.completedAt!.getTime()
        });

        const ungraded = snapshot.transferQuestions.filter((_question, offset) => {
          const index = snapshot.reviewItems.length + offset;
          const evaluation = state.questionEvaluations?.[String(index)];
          const skipped = state.turns.some(
            (turn) => turn.speaker === "user" && turn.questionIndex === index && turn.skipped
          );
          return !skipped && (!evaluation || evaluation.source === "evaluation-unavailable");
        }).length;
        if (ungraded) counts.missingGrade += 1;

        const changed =
          JSON.stringify(before.metrics) !== JSON.stringify(after.metrics) ||
          before.overall !== after.overall;
        process.stdout.write(
          `${label} overall ${before.overall} -> ${after.overall}` +
            ` ${JSON.stringify(after.metrics)}` +
            (ungraded ? ` [${ungraded} coding answer(s) without a grade]` : "") +
            (changed ? "" : " (no change)") +
            "\n"
        );
        if (!changed) {
          counts.unchanged += 1;
          continue;
        }
        counts.changed += 1;
        updates.push({ id: assessment.id, before: assessment.reportSnapshot, after });
      } catch (error) {
        counts.failed += 1;
        process.stderr.write(
          `${label} skipped: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }

    if (apply && updates.length) {
      const backup = join(tmpdir(), `dsa-block-assessment-reports-${Date.now()}.json`);
      writeFileSync(
        backup,
        JSON.stringify(
          updates.map(({ id, before }) => ({ id, before })),
          null,
          2
        )
      );
      process.stdout.write(`\nBacked up ${updates.length} report(s) to ${backup}\n`);
      for (const { id, after } of updates) {
        await prisma.dsaBlockAssessment.update({
          where: { id },
          data: { reportSnapshot: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue }
        });
      }
    }

    process.stdout.write(
      `\n${apply ? "Applied" : "Dry run"}: ${counts.checked} checked, ${counts.changed} ${apply ? "updated" : "would change"}, ` +
        `${counts.unchanged} unchanged, ${counts.missingGrade} with an ungraded coding answer, ${counts.failed} failed.\n` +
        (apply ? "" : "Run again with --apply to write the new reports.\n")
    );
    if (counts.failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `Re-score stopped: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
