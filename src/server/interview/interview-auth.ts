import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiRouteError } from "../http/api-error";
import type { AppConfigService } from "../config/app-config.service";

export const INTERVIEW_OWNER_COOKIE = "trailgrad_interview_owner";
const OWNER_COOKIE_VERSION = "iow1";
const AGENT_TOKEN_VERSION = "iat1";
const AGENT_AUDIENCE = "trailgrad-interview-agent";

interface AgentCapabilityPayload {
  aud: typeof AGENT_AUDIENCE;
  exp: number;
  scp: Array<"answer" | "read">;
  sid: string;
}

export function requireInterviewAuthSecret(config: AppConfigService): string {
  const secret = config.interviewAuthSecret?.trim();
  if (!secret) {
    throw new ApiRouteError(
      503,
      "INTERVIEW_AUTH_NOT_CONFIGURED",
      "Interview authorization is not configured."
    );
  }
  return secret;
}

export function createAnonymousOwnerCookie(secret: string): {
  ownerId: string;
  value: string;
} {
  const anonymousId = randomBytes(32).toString("base64url");
  const unsigned = `${OWNER_COOKIE_VERSION}.${anonymousId}`;
  return {
    ownerId: `anon:${anonymousId}`,
    value: `${unsigned}.${signature(unsigned, secret)}`
  };
}

export function verifyAnonymousOwnerCookie(value: string, secret: string): string | null {
  const [version, anonymousId, suppliedSignature, extra] = value.split(".");
  if (
    version !== OWNER_COOKIE_VERSION ||
    !anonymousId ||
    !/^[A-Za-z0-9_-]{43}$/.test(anonymousId) ||
    !suppliedSignature ||
    extra !== undefined
  ) {
    return null;
  }

  const unsigned = `${version}.${anonymousId}`;
  if (!safeEqual(suppliedSignature, signature(unsigned, secret))) return null;
  return `anon:${anonymousId}`;
}

export function createInterviewAgentCapability(
  sessionId: string,
  expiresAtMs: number,
  secret: string
): string {
  const payload: AgentCapabilityPayload = {
    aud: AGENT_AUDIENCE,
    exp: Math.floor(expiresAtMs / 1000),
    scp: ["read", "answer"],
    sid: sessionId
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const unsigned = `${AGENT_TOKEN_VERSION}.${encodedPayload}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyInterviewAgentCapability(
  token: string,
  secret: string,
  nowMs = Date.now()
): AgentCapabilityPayload | null {
  const [version, encodedPayload, suppliedSignature, extra] = token.split(".");
  if (
    version !== AGENT_TOKEN_VERSION ||
    !encodedPayload ||
    !suppliedSignature ||
    extra !== undefined
  ) {
    return null;
  }

  const unsigned = `${version}.${encodedPayload}`;
  if (!safeEqual(suppliedSignature, signature(unsigned, secret))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<AgentCapabilityPayload>;
    if (
      payload.aud !== AGENT_AUDIENCE ||
      typeof payload.sid !== "string" ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      !Array.isArray(payload.scp) ||
      !payload.scp.every((scope) => scope === "read" || scope === "answer") ||
      payload.exp <= Math.floor(nowMs / 1000)
    ) {
      return null;
    }
    return payload as AgentCapabilityPayload;
  } catch {
    return null;
  }
}

export function isInterviewAgentCapability(token: string): boolean {
  return token.startsWith(`${AGENT_TOKEN_VERSION}.`);
}

function signature(value: string, secret: string): string {
  const key = createHash("sha256")
    .update("trailgrad/interview-authorization/v1\0")
    .update(secret)
    .digest();
  return createHmac("sha256", key).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
