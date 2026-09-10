import type { NextRequest } from "next/server";
import type { AppConfigService } from "@/server/config/app-config.service";
import { ApiRouteError } from "@/server/http/api-error";
import {
  INTERVIEW_AGENT_CAPABILITY_HEADER,
  isInterviewAgentCapability,
  verifyInterviewAgentCapability
} from "./interview-auth";
import { existingInterviewOwnerId } from "./owner";

export type InterviewSessionAccess = { kind: "agent" } | { kind: "owner"; ownerId: string };

export type InterviewSessionPermission = "answer" | "end" | "read";

/**
 * Accepts either the browser owner (Clerk or signed anonymous cookie) or the
 * short-lived voice-worker capability minted for exactly this session.
 */
export async function authorizeInterviewSession(
  request: NextRequest,
  config: AppConfigService,
  sessionId: string,
  permission: InterviewSessionPermission
): Promise<InterviewSessionAccess> {
  const agentCredential = request.headers.get(INTERVIEW_AGENT_CAPABILITY_HEADER)?.trim();
  if (agentCredential) {
    const secret = config.interviewAuthSecret;
    const capability =
      secret && isInterviewAgentCapability(agentCredential)
        ? verifyInterviewAgentCapability(agentCredential, secret)
        : null;
    if (!capability) {
      throw new ApiRouteError(401, "INTERVIEW_CAPABILITY_INVALID", "Interview access expired.");
    }
    if (capability.sid !== sessionId) {
      throw new ApiRouteError(
        403,
        "INTERVIEW_CAPABILITY_MISMATCH",
        "This credential cannot access that interview."
      );
    }
    if (permission === "end" || !capability.scp.includes(permission)) {
      throw new ApiRouteError(
        403,
        "INTERVIEW_CAPABILITY_FORBIDDEN",
        "This credential cannot perform that interview action."
      );
    }
    return { kind: "agent" };
  }

  const ownerId = await existingInterviewOwnerId(request, config);
  if (!ownerId) {
    throw new ApiRouteError(401, "INTERVIEW_ACCESS_REQUIRED", "Interview access is required.");
  }
  return { kind: "owner", ownerId };
}
