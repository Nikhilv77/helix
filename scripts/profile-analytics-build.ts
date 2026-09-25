/**
 * Development-only latency profile for the Overview/Progress analytics build.
 *
 * Measures the database round trip from this machine, then builds analytics
 * for a few onboarded candidates without reading or writing snapshots, and
 * reports query count, summed query time, and wall time for each build.
 *
 *   pnpm profile:analytics:dev            # first 5 onboarded candidates
 *   pnpm profile:analytics:dev <ownerId>  # one candidate
 */
import { PrismaService } from "../src/server/database/prisma.service";

const prisma = new PrismaService({ log: [{ emit: "event", level: "query" }] });
// The app container reads this global, so every service query is observed.
(globalThis as { trailgradPrisma?: PrismaService }).trailgradPrisma = prisma;

let queryCount = 0;
let queryMs = 0;
prisma.$on("query" as never, (event: { duration: number }) => {
  queryCount += 1;
  queryMs += event.duration;
});

async function roundTripMs(samples = 10): Promise<number[]> {
  await prisma.$queryRaw`SELECT 1`;
  const times: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    times.push(performance.now() - startedAt);
  }
  return times.sort((left, right) => left - right);
}

async function main(): Promise<void> {
  const { buildCandidateAnalytics } = await import(
    "../src/features/analytics/server/candidate-analytics-loader"
  );
  const { getAppContainer } = await import("../src/server/app-container");
  const app = getAppContainer();

  const rtt = await roundTripMs();
  const median = rtt[Math.floor(rtt.length / 2)]!;
  process.stdout.write(
    `DB round trip from this machine: median ${median.toFixed(0)} ms ` +
      `(min ${rtt[0]!.toFixed(0)}, max ${rtt.at(-1)!.toFixed(0)})\n\n`
  );

  const requested = process.argv[2];
  const owners = requested
    ? [{ ownerId: requested }]
    : await prisma.candidateProfile.findMany({
        where: { onboardingCompletedAt: { not: null } },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { ownerId: true }
      });

  for (const { ownerId } of owners) {
    const profile = await app.profileService.get(ownerId);
    queryCount = 0;
    queryMs = 0;
    const startedAt = performance.now();
    await buildCandidateAnalytics(ownerId, profile);
    const wallMs = performance.now() - startedAt;
    const serialTrips = wallMs / median;
    process.stdout.write(
      `${profile.targetRole ?? "unknown"} ${ownerId.slice(0, 18)}…  ` +
        `${queryCount} queries, ${queryMs.toFixed(0)} ms summed, ` +
        `${wallMs.toFixed(0)} ms wall ≈ ${serialTrips.toFixed(1)} sequential round trips\n`
    );
  }
}

void main()
  .catch((error) => {
    process.stderr.write(`Profile failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
