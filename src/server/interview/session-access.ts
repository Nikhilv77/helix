import type { NextRequest } from "next/server";
import type { AppConfigService } from "../config/app-config.service";
import { ApiRouteError } from "../http/api-error";
import { isInterviewAgentCapability, verifyInterviewAgentCapability } from "./interview-auth";
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
  const bearer = bearerToken(request.headers.get("authorization"));
  if (bearer && isInterviewAgentCapability(bearer)) {
    const secret = config.interviewAuthSecret;
    const capability = secret ? verifyInterviewAgentCapability(bearer, secret) : null;
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

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && !extra ? token : null;
}
