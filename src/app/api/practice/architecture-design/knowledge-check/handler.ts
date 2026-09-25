import { NextRequest } from "next/server";
import { architectureDesignKnowledgeCheckInputSchema } from "@/features/practice/architecture-design/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignMutationOwner, parseArchitectureDesignJson } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await architectureDesignMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseArchitectureDesignJson(
      request,
      architectureDesignKnowledgeCheckInputSchema
    );
    const result = await app.architectureDesign.practice.checkKnowledge(ownerId, input);
    return apiSuccess({ result });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
