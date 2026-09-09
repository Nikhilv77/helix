import type { NextRequest } from "next/server";
import { architectureDesignRevealHintInputSchema } from "@/features/practice/architecture-design/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignOwner, parseArchitectureDesignJson } from "../_shared";


export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await architectureDesignOwner(RATE_LIMIT_POLICIES.practiceState);
    return apiSuccess({
      question: await app.architectureDesign.practice.revealHint(
        ownerId,
        await parseArchitectureDesignJson(request, architectureDesignRevealHintInputSchema)
      )
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
