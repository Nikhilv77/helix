import type { NextRequest } from "next/server";
import { architectureDesignAssessmentFinalizeInputSchema } from "@/features/practice/architecture-design/domain/assessment-contracts";
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
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseArchitectureDesignJson(
      request,
      architectureDesignAssessmentFinalizeInputSchema
    );
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "architecture-design-assessment-finalize",
        ttlMs: 120_000,
        code: "ARCHITECTURE_DESIGN_ASSESSMENT_FINALIZING",
        message: "This Architecture & Design assessment is already being finalized."
      },
      `${ownerId}:${input.assessmentId}`
    );
    return apiSuccess({
      assessment: await app.architectureDesign.assessment.finalize(ownerId, input)
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
