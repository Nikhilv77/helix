import { Prisma } from "@prisma/client";
import { disciplineLabel } from "@/lib/shared/labels";
import type { Role } from "@/lib/shared/types";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import { getAppContainer } from "@/server/app-container";
import { getPrismaService } from "@/server/database/prisma.service";
import { nodeTrackAssessmentReports } from "./assessment-reports";

export interface ReportsPageData {
  reports: ReportsOverview;
  candidate: { name: string; discipline: string };
  quotaLimit: number;
  quotaStartedAt: number[];
}

/** Reports has its own read model; it never needs roadmap or DSA page data. */
export async function buildReportsPageData(ownerId: string, now = Date.now()) {
  const app = getAppContainer();
  const [reports, header, quotaStartedAt] = await Promise.all([
    app.interviewService.reportsOverview(
      ownerId,
      50,
      now,
      nodeTrackAssessmentReports(ownerId, now)
    ),
    getPrismaService().$queryRaw<Array<{ targetRole: string | null; fullName: string | null }>>(
      Prisma.sql`
        SELECT "targetRole", "resumeAnalysis"->>'fullName' AS "fullName"
        FROM "CandidateProfile" WHERE "ownerId" = ${ownerId}
      `
    ),
    app.candidateAnalyticsSnapshotStore.recentInterviewStartTimes(ownerId, now - 86_400_000)
  ]);
  const targetRole = header[0]?.targetRole;
  const role: Role | null =
    targetRole === "backend" ||
    targetRole === "frontend" ||
    targetRole === "fullstack" ||
    targetRole === "data" ||
    targetRole === "ai-ml" ||
    targetRole === "pm"
      ? targetRole
      : null;

  return {
    cacheable: true,
    data: {
      reports,
      candidate: {
        name: header[0]?.fullName?.trim() ?? "",
        discipline: role ? disciplineLabel(role) : ""
      },
      quotaLimit: app.config.interviewDailyLimit,
      quotaStartedAt
    } satisfies ReportsPageData
  };
}
