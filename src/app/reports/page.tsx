import { ReportsView } from "@/components/workspace/reports-view";
import { disciplineLabel } from "@/lib/labels";
import type { ReportsOverview } from "@/lib/reports";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

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
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();

  const [overview, quota] = await Promise.all([
    // History lives in the session store; if it cannot be read the page still
    // renders its empty state rather than failing the whole route.
    container.interviewService.reportsOverview(ownerId).catch(() => null),
    container.interviewService.quota(ownerId).catch(() => ({ used: 0, limit: 2 }))
  ]);

  const fullName = profile.resume?.fullName?.trim() ?? "";

  return (
    <ReportsView
      overview={overview ?? emptyOverview(Date.now())}
      quota={quota}
      firstName={fullName.split(/\s+/)[0] ?? ""}
      candidate={{
        name: fullName,
        discipline: profile.targetRole ? disciplineLabel(profile.targetRole) : ""
      }}
    />
  );
}
