import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { HARD_CAP_MS } from "@/server/interview/types";

export const dynamic = "force-dynamic";

/** A fresh room guarantees that reconnecting triggers a fresh agent dispatch. */
export function roomNameFor(sessionId: string, connectionId = crypto.randomUUID()): string {
  return `interview-${sessionId}-${connectionId.slice(0, 8)}`;
}

const requestSchema = z.object({
  sessionId: z.string().uuid()
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const { livekitUrl, livekitApiKey, livekitApiSecret, livekitAgentName } = app.config;

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new ApiRouteError(503, "LIVEKIT_NOT_CONFIGURED", "Voice is not configured", {
        missing: [
          livekitUrl ? null : "LIVEKIT_URL",
          livekitApiKey ? null : "LIVEKIT_API_KEY",
          livekitApiSecret ? null : "LIVEKIT_API_SECRET"
        ].filter(Boolean)
      });
    }

    // Throws SESSION_NOT_FOUND if the interview does not exist.
    const state = await app.interviewService.get(parsed.data.sessionId);

    if (state.phase === "done") {
      throw new ApiRouteError(409, "SESSION_COMPLETE", "This interview has ended", {});
    }

    // The token expires when the interview's 15 minutes do, so a leaked token
    // cannot outlive the cap it is meant to enforce.
    const remainingMs = HARD_CAP_MS - (Date.now() - state.startedAt);
    if (remainingMs <= 0) {
      throw new ApiRouteError(409, "SESSION_EXPIRED", "This interview has run out of time", {});
    }

    const roomName = roomNameFor(state.id);
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `candidate-${state.id}`,
      ttl: Math.ceil(remainingMs / 1000)
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      // Reliable data packets carry typed answers to the same interviewer.
      canPublishData: true
    });

    // The agent registers under an explicit name, which means it does NOT
    // auto-join rooms. Without this the candidate lands in an empty room and
    // waits forever. Attaching the dispatch to the token means joining is the
    // only step — the interviewer is summoned with them.
    token.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: livekitAgentName })]
    });

    return apiSuccess({
      token: await token.toJwt(),
      url: livekitUrl,
      roomName,
      agentName: livekitAgentName,
      expiresInMs: remainingMs
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
