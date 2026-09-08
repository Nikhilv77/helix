import type { NextRequest } from "next/server";
import { architectureDesignContinueInputSchema } from "@/lib/practice/architecture-design/assessment-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignOwner, parseArchitectureDesignJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseArchitectureDesignJson(request, architectureDesignContinueInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "architecture-design-continue",
        ttlMs: 300_000,
        code: "ARCHITECTURE_DESIGN_CONTINUATION_IN_PROGRESS",
        message: "The next Architecture & Design scenario is already being prepared."
      },
      ownerId
    );
    return apiSuccess(await app.architectureDesign.continuation.continue(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
