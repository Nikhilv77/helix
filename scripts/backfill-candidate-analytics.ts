import { buildCandidateAnalytics } from "../src/features/analytics/server/candidate-analytics-loader";
import { getAppContainer } from "../src/server/app-container";
import { getPrismaService } from "../src/server/database/prisma.service";

async function main(): Promise<void> {
  const prisma = getPrismaService();
  const app = getAppContainer();
  let cursor: string | undefined;
  let rebuilt = 0;
  let skipped = 0;
  let failed = 0;
  try {
    while (true) {
      const owners = await prisma.candidateProfile.findMany({
        take: 50,
        ...(cursor ? { cursor: { ownerId: cursor }, skip: 1 } : {}),
        orderBy: { ownerId: "asc" },
        select: { ownerId: true }
      });
      if (!owners.length) break;
      for (const { ownerId } of owners) {
        cursor = ownerId;
        try {
          const profile = await app.profileService.get(ownerId);
          if (!profile.onboardingCompletedAt || !profile.preparationOnboarding.completedAt) {
            skipped += 1;
            continue;
          }
          await app.candidateAnalyticsSnapshotStore.readSummary(
            ownerId,
            () => buildCandidateAnalytics(ownerId, profile),
            { requireFresh: true }
          );
          await app.candidateAnalyticsSnapshotStore.refreshDaily(ownerId);
          rebuilt += 1;
        } catch (error) {
          failed += 1;
          process.stderr.write(
            `Analytics backfill failed for ${ownerId}: ${error instanceof Error ? error.message : String(error)}\n`
          );
        }
      }
    }
    process.stdout.write(
      `Analytics backfill: ${rebuilt} rebuilt, ${skipped} skipped, ${failed} failed.\n`
    );
    if (failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `Analytics backfill stopped: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
