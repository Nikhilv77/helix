import type { NextRequest } from "next/server";
import { architectureDesignAssessmentStartInputSchema } from "@/features/practice/architecture-design/domain/assessment-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignOwner, parseArchitectureDesignJson } from "../../_shared";

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseArchitectureDesignJson(
      request,
      architectureDesignAssessmentStartInputSchema
    );
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "architecture-design-assessment-start",
        ttlMs: 30_000,
        code: "ARCHITECTURE_DESIGN_ASSESSMENT_START_IN_PROGRESS",
        message: "This Architecture & Design assessment is already starting."
      },
      `${ownerId}:${input.assessmentId}`
    );
    return apiSuccess(
      await app.architectureDesign.assessmentRuntime.startOrResume(ownerId, input, {
        allowLocked: app.config.nodeEnv === "development"
      })
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
