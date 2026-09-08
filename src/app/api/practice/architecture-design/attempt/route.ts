import type { NextRequest } from "next/server";
import { architectureDesignAttemptInputSchema } from "@/lib/practice/architecture-design/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignOwner, parseArchitectureDesignJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseArchitectureDesignJson(request, architectureDesignAttemptInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "architecture-design-attempt",
        ttlMs: 60_000,
        code: "ARCHITECTURE_DESIGN_ATTEMPT_IN_PROGRESS",
        message: "An Architecture & Design attempt is already being evaluated."
      },
      `${ownerId}:${input.questionId}`
    );
    return apiSuccess(await app.architectureDesign.practice.submitAttempt(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
