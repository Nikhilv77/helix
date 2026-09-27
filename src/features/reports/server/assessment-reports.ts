import type { InterviewReport } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";

/**
 * Finished Node.js track assessments (Core Technical, Applied Engineering, and
 * Architecture), each as its own assessment report. Reports and Overview list
 * these beside interview rounds; their raw interview sessions are left out, so
 * each assessment counts once.
 */
export async function nodeTrackAssessmentReports(
  ownerId: string,
  now = Date.now()
): Promise<InterviewReport[]> {
  const app = getAppContainer();
  const rounds = await Promise.all([
    app.coreTechnicalWorkspaceAnalyticsService.rounds(ownerId, 50, now),
    app.appliedEngineeringWorkspaceAnalyticsService.rounds(ownerId, 50, now),
    app.architectureDesign.workspaceAnalytics.rounds(ownerId, 50, now)
  ]);
  return rounds.flatMap((round) => round.reports);
}
