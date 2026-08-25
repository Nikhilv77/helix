import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { roundCaps } from "@/server/interview/types";
import { MAYA, personaById } from "@/lib/avatars/personas";
import {
  createInterviewAgentCapability,
  requireInterviewAuthSecret
} from "@/server/interview/interview-auth";
import { existingInterviewOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

/** Generated once per session and cached so concurrent callers cannot create two rooms. */
export function roomNameFor(sessionId: string, connectionId = crypto.randomUUID()): string {
  return `interview-${sessionId}-${connectionId.slice(0, 8)}`;
}

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  teacherId: z.string().trim().max(60).optional()
});

interface CachedVoiceConnection {
  token: string;
  url: string;
  roomName: string;
  agentName: string;
  expiresAt: number;
}

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

    const ownerId = await existingInterviewOwnerId(request, app.config);
    if (!ownerId) {
      throw new ApiRouteError(401, "INTERVIEW_ACCESS_REQUIRED", "Interview access is required.");
    }

    // Owner-scoped lookup deliberately returns not-found for another user's
    // UUID, avoiding both data exposure and an ownership oracle.
    const state = await app.interviewService.getOwnedActive(ownerId, parsed.data.sessionId);
    const teacher = personaById(parsed.data.teacherId) ?? MAYA;

    if (state.phase === "done") {
      throw new ApiRouteError(409, "SESSION_COMPLETE", "This interview has ended", {});
    }

    // The token expires when the interview's own time budget does, so a leaked
    // token cannot outlive the cap it is meant to enforce.
    const remainingMs = roundCaps(state.setup).hardCapMs - (Date.now() - state.startedAt);
    if (remainingMs <= 0) {
      throw new ApiRouteError(409, "SESSION_EXPIRED", "This interview has run out of time", {});
    }

    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.livekitToken, state.id);
    const cached = await guard.getCached<CachedVoiceConnection>("livekit-connection", state.id);
    if (cached && cached.expiresAt > Date.now()) {
      return apiSuccess(connectionResponse(cached));
    }

    let lease;
    try {
      lease = await guard.acquire(
        {
          namespace: "livekit-token-create",
          ttlMs: 10_000,
          code: "VOICE_CONNECTION_IN_PROGRESS",
          message: "A voice connection is already being prepared for this interview."
        },
        state.id
      );
    } catch (error) {
      if (error instanceof ApiRouteError && error.code === "VOICE_CONNECTION_IN_PROGRESS") {
        const connection = await waitForConnection(guard, state.id);
        if (connection) return apiSuccess(connectionResponse(connection));
      }
      throw error;
    }

    try {
      // A request can lose the race between the cache read and lease acquisition.
      const raced = await guard.getCached<CachedVoiceConnection>("livekit-connection", state.id);
      if (raced && raced.expiresAt > Date.now()) {
        return apiSuccess(connectionResponse(raced));
      }

      const expiresAt = Date.now() + remainingMs;
      const roomName = roomNameFor(state.id);
      const agentCapability = createInterviewAgentCapability(
        state.id,
        expiresAt,
        requireInterviewAuthSecret(app.config)
      );
      const token = new AccessToken(livekitApiKey, livekitApiSecret, {
        // Reusing one identity means a second browser replaces the first instead
        // of creating a second active candidate connection in the same room.
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
        agents: [
          new RoomAgentDispatch({
            agentName: livekitAgentName,
            metadata: JSON.stringify({
              personaId: teacher.id,
              voice: teacher.voice,
              interviewCapability: agentCapability
            })
          })
        ]
      });

      const connection: CachedVoiceConnection = {
        token: await token.toJwt(),
        url: livekitUrl,
        roomName,
        agentName: livekitAgentName,
        expiresAt
      };
      await guard.setCached("livekit-connection", state.id, connection, remainingMs);
      return apiSuccess(connectionResponse(connection));
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function connectionResponse(connection: CachedVoiceConnection) {
  return {
    token: connection.token,
    url: connection.url,
    roomName: connection.roomName,
    agentName: connection.agentName,
    expiresInMs: Math.max(0, connection.expiresAt - Date.now())
  };
}

async function waitForConnection(
  guard: ReturnType<typeof getSharedGuard>,
  sessionId: string
): Promise<CachedVoiceConnection | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 75));
    const connection = await guard.getCached<CachedVoiceConnection>(
      "livekit-connection",
      sessionId
    );
    if (connection && connection.expiresAt > Date.now()) return connection;
  }
  return null;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
