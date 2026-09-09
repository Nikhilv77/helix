import type { NextRequest } from "next/server";
import { architectureDesignPrepareInputSchema } from "@/features/practice/architecture-design/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import {
  apiError,
  architectureDesignOwner,
  parseArchitectureDesignJson,
  requireArchitectureDesignEligibility
} from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app, profile } = await architectureDesignOwner(
      RATE_LIMIT_POLICIES.answerEvaluation
    );
    await requireArchitectureDesignEligibility(app, profile);
    const input = await parseArchitectureDesignJson(request, architectureDesignPrepareInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "architecture-design-prepare",
        ttlMs: 300_000,
        code: "ARCHITECTURE_DESIGN_PREPARATION_IN_PROGRESS",
        message: "This Architecture & Design scenario is already being prepared."
      },
      ownerId
    );
    return apiSuccess(await app.architectureDesign.preparation.prepare(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
