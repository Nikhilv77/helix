// Dev-only demo data for Trailmate: ~15 ranked Top Trailmates plus sessions
// you helped with. Tagged so `--undo` removes exactly this:
//   help requests with context.demoSeed, and profiles with ownerId "demo-trailmate:*".
import { config as loadEnvFile } from "dotenv";
import { randomUUID } from "node:crypto";
loadEnvFile({ path: ".env.local", override: true });
loadEnvFile();

// The demo account (vermanikhilwork@gmail.com). It is the only real account
// with personal Trailmate history; every other participant is a demo profile,
// so any other signed-in account still behaves like a new user.
const YOU = "user:user_3JdDwWzZH9JfTQ2ic3qeSfazKiv";
const DEMO_PROFILES = [
  ["Kabir Das", "Backend engineer at a fintech, big on graphs and system design."],
  ["Meera Pillai", "Frontend engineer who explains recursion better than textbooks."],
  ["Rohan Gupta", "SDE II, competitive programmer, loves dynamic programming."],
  ["Sara Khan", "Full-stack developer mentoring juniors on two pointers and windows."],
  ["Vikram Singh", "Platform engineer; turns tricky trees into simple walks."],
  ["Aisha Patel", "Data engineer who enjoys heaps, intervals and clean code."],
  ["Dev Malhotra", "Android developer and weekend LeetCode streaker."],
  ["Tara Nair", "Backend engineer focused on hashing and prefix sums."],
  ["Nikhil Bansal", "ML engineer who still loves a good binary search."],
  ["Zoya Qureshi", "New grad, fresh from ICPC regionals, happy to help."],
  ["Ananya Iyer", "Frontend engineer who makes sliding windows click."],
  ["Farhan Ali", "Backend engineer at a logistics startup; graph problems fan."],
  ["Isha Kapoor", "SDE at a product company, patient with backtracking questions."],
  ["Aditya Rao", "Java developer who enjoys breaking problems into small steps."]
] as const;
const SLUGS = ["merge-intervals", "3sum", "permutations", "sort-colors", "count-number-of-nice-subarrays", "koko-eating-bananas", "rotate-image", "regular-expression-matching"];
const LANGUAGES = ["javascript", "python", "java", "cpp"];

async function main() {
  const prisma = (await import("../src/server/database/prisma.service")).getPrismaService();
  if (process.argv.includes("--undo")) {
    const requests = await prisma.$executeRaw`DELETE FROM "HelpRequest" WHERE "context"->>'demoSeed' = 'true'`;
    const profiles = await prisma.candidateProfile.deleteMany({ where: { ownerId: { startsWith: "demo-trailmate:" } } });
    console.log(`Removed ${requests} demo help requests and ${profiles.count} demo profiles.`);
    return;
  }

  const demoIds: string[] = [];
  for (const [index, [name, headline]] of DEMO_PROFILES.entries()) {
    const ownerId = `demo-trailmate:${index + 1}`;
    demoIds.push(ownerId);
    await prisma.candidateProfile.upsert({
      where: { ownerId },
      create: {
        ownerId,
        focusAreas: [],
        stories: [],
        headline,
        profileImage: `/images/profile/avatars/avatar-${String((index % 13) + 1).padStart(2, "0")}.jpg`,
        // Never matched to real requests: invitations stay off for sample people.
        helpNotificationsEnabled: false,
        resumeAnalysis: { fullName: name, demoSeed: true }
      },
      update: {}
    });
  }

  // [helper, people helped, how many of them said thanks]; ranking is by thanks, then helped.
  const helpers: Array<[string, number, number]> = [
    [demoIds[0]!, 18, 16], [demoIds[1]!, 16, 15], [demoIds[10]!, 15, 12], [demoIds[2]!, 14, 11],
    [YOU, 12, 10], [demoIds[3]!, 12, 9], [demoIds[11]!, 11, 8], [demoIds[4]!, 10, 7],
    [demoIds[5]!, 9, 6], [demoIds[12]!, 8, 5], [demoIds[6]!, 7, 4], [demoIds[7]!, 6, 3],
    [demoIds[13]!, 5, 2], [demoIds[8]!, 4, 1], [demoIds[9]!, 3, 1]
  ];
  const learners = [YOU, ...demoIds];
  let created = 0;
  for (const [helper, helped, thanked] of helpers) {
    const pool = learners.filter((id) => id !== helper);
    for (let index = 0; index < helped; index += 1) {
      const learner = pool[index % pool.length]!;
      const createdAt = new Date(Date.now() - (index * 2 + (created % 5) + 1) * 86_400_000 - (created % 9) * 3_600_000);
      const joinedAt = new Date(createdAt.getTime() + 120_000);
      const endedAt = new Date(joinedAt.getTime() + (8 + ((created * 7) % 28)) * 60_000);
      const language = LANGUAGES[created % LANGUAGES.length]!;
      const request = await prisma.helpRequest.create({
        data: {
          learnerId: learner,
          questionSlug: SLUGS[created % SLUGS.length]!,
          language,
          status: "RESOLVED",
          helperId: helper,
          context: { demoSeed: true, code: "// demo", language, hintsUsed: 1, timeSpentMs: 900_000 },
          claimedAt: new Date(createdAt.getTime() + 60_000),
          resolvedAt: endedAt,
          expiresAt: new Date(createdAt.getTime() + 10 * 60_000),
          createdAt
        }
      });
      await prisma.helpSession.create({
        data: {
          requestId: request.id,
          roomName: `demo-seed-${randomUUID()}`,
          startedAt: joinedAt,
          learnerJoinedAt: joinedAt,
          helperJoinedAt: joinedAt,
          endedAt,
          endedReason: "resolved",
          learnerRating: index < thanked ? 5 : null,
          createdAt: joinedAt
        }
      });
      created += 1;
    }
  }
  console.log(`Added ${DEMO_PROFILES.length} demo profiles and ${created} completed sessions across ${helpers.length} helpers.`);
}
void main().finally(() => process.exit());
