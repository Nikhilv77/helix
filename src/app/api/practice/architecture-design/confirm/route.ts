import type { NextRequest } from "next/server";
import { architectureDesignFocusConfirmationSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import {
  apiError,
  architectureDesignOwner,
  parseArchitectureDesignJson,
  requireArchitectureDesignEligibility
} from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app, profile } = await architectureDesignOwner(
      RATE_LIMIT_POLICIES.practiceState
    );
    await requireArchitectureDesignEligibility(app, profile);
    const input = await parseArchitectureDesignJson(
      request,
      architectureDesignFocusConfirmationSchema
    );
    return apiSuccess({ focus: await app.architectureDesign.preparation.confirm(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
