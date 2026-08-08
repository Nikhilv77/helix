import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ReportsView } from "@/components/workspace/reports-view";
import type { ReportsOverview } from "@/lib/reports";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Reports",
  "Every Trailgrad interview round you have run, scored and compared side by side."
);

function emptyOverview(now: number): ReportsOverview {
  return {
    generatedAt: now,
    totalRounds: 0,
    completedRounds: 0,
    inProgressRounds: 0,
    scoredRounds: 0,
    questionsAnswered: 0,
    questionsAsked: 0,
    totalMinutes: 0,
    readinessScore: null,
    latestScore: null,
    firstScore: null,
    bestScore: null,
    scoreDelta: null,
    trend: [],
    competencies: [],
    matrix: { rounds: [], rows: [] },
    roundTypes: [],
    pressure: { probes: 0, challenges: 0, clarifications: 0, interruptions: 0, perRound: 0 },
    recurringGaps: [],
    rounds: [],
    latest: null,
    best: null
  };
}

/** Every round, scored and compared — the cross-round view of your reports. */
export default async function ReportsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();

  const [profile, overview, quota] = await Promise.all([
    container.profileService.get(ownerId),
    // History lives in the session store; if it cannot be read the page still
    // renders its empty state rather than failing the whole route.
    container.interviewService.reportsOverview(ownerId).catch(() => null),
    container.interviewService.quota(ownerId).catch(() => ({ used: 0, limit: 2 }))
  ]);

  return (
    <ReportsView
      overview={overview ?? emptyOverview(Date.now())}
      quota={quota}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
    />
  );
}
