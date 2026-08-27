import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { isOperator } from "@/server/help/operator";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reviewSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    const app = await requireOperator();
    const reports = await app.helpSafetyService.pendingReports();

    // The request each report is about, so the queue is readable without
    // opening a second tab per row.
    const requests = await Promise.all(
      reports.map((report) =>
        app.helpRequestService.byId(report.requestId).catch(() => null)
      )
    );

    return apiSuccess({
      reports: reports.map((report, index) => {
        const related = requests[index];
        const question = related ? findQuestion(related.questionSlug)?.question : null;

        return {
          id: report.id,
          reason: report.reason,
          detail: report.detail,
          reporterId: report.reporterId,
          reportedId: report.reportedId,
          filedAt: report.createdAt.getTime(),
          requestId: report.requestId,
          questionTitle: question?.title ?? related?.questionSlug ?? null,
          questionSlug: related?.questionSlug ?? null,
          requestStatus: related?.status ?? null
        };
      })
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function POST(request: NextRequest) {
  try {
    const app = await requireOperator();
    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiRouteError(400, "BAD_REQUEST", "A report id is required");

    return apiSuccess({ reviewed: await app.helpSafetyService.markReviewed(parsed.data.id) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

/**
 * 404, not 403.
 *
 * Telling a non-operator that the queue exists but is forbidden confirms there
 * is something here worth finding. To everyone else this route simply is not.
 */
async function requireOperator() {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(404, "NOT_FOUND", "Not found");

  const app = getAppContainer();
  if (!isOperator(app.config, authenticatedOwnerId(userId))) {
    throw new ApiRouteError(404, "NOT_FOUND", "Not found");
  }

  return app;
}
