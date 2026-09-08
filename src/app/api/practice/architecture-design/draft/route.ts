import type { NextRequest } from "next/server";
import { architectureDesignSaveDraftInputSchema } from "@/lib/practice/architecture-design/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignOwner, parseArchitectureDesignJson } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.practiceState);
    return apiSuccess({
      question: await app.architectureDesign.practice.saveDraft(
        ownerId,
        await parseArchitectureDesignJson(request, architectureDesignSaveDraftInputSchema)
      )
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
