import type { InterviewsHomeData } from "@/features/interviews/contracts/interviews-home";
import { interviewRoadmapSessions } from "@/features/interviews/domain/interview-roadmap-sessions";
import { SESSION_TTL_MS } from "@/features/interviews/server/session-constants";
import { cachedPersonalizedPlan } from "@/features/interviews/server/cached-personalized-plan";
import { getAppContainer } from "@/server/app-container";
import type { BuiltWorkspacePage } from "@/features/analytics/server/workspace-page-snapshot.store";
import type { CandidateProfile } from "@/lib/shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildInterviewsHome(
  ownerId: string,
  profile: CandidateProfile
): Promise<BuiltWorkspacePage<InterviewsHomeData>> {
  const app = getAppContainer();
  let cacheable = true;
  const recoverPlan = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch(() => {
      cacheable = false;
      return fallback;
    });

  const [quota, genericSessions, coreRounds, appliedRounds, personalizedPlan] = await Promise.all([
    app.interviewService.quota(ownerId),
    app.interviewService.history(ownerId, 50),
    app.coreTechnicalWorkspaceAnalyticsService.rounds(ownerId),
    app.appliedEngineeringWorkspaceAnalyticsService.rounds(ownerId),
    recoverPlan(cachedPersonalizedPlan(ownerId, profile), null)
  ]);
  const sessions = [...genericSessions, ...coreRounds.history, ...appliedRounds.history]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 50);
  const now = Date.now();
  const nextRoomExpiry = sessions
    .filter((session) => session.status === "in_progress")
    .map((session) => session.updatedAt + SESSION_TTL_MS)
    .filter((expiry) => expiry > now)
    .sort((left, right) => left - right)[0];
  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";
  return {
    cacheable,
    expiresAt: nextRoomExpiry ? new Date(nextRoomExpiry) : null,
    data: {
      firstName,
      quota,
      quotaStartedAt: genericSessions
        .filter((session) => session.startedAt >= now - DAY_MS)
        .map((session) => session.startedAt),
      sessions,
      roadmapSessions: interviewRoadmapSessions({
        personalizedPlan,
        roadmap: null,
        history: sessions
      })
    }
  };
}

export async function buildInterviewsHomeForOwner(ownerId: string) {
  const profile = await getAppContainer().profileService.get(ownerId);
  return buildInterviewsHome(ownerId, profile);
}

/** Quota decreases as old starts leave the rolling window without a database write. */
export function currentInterviewQuota(data: InterviewsHomeData, now = Date.now()) {
  return {
    used: Math.min(
      data.quota.limit,
      data.quotaStartedAt.filter((startedAt) => startedAt >= now - DAY_MS).length
    ),
    limit: data.quota.limit
  };
}
