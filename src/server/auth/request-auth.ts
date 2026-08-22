import { createClerkClient, verifyToken } from "@clerk/backend";
import type { NextRequest } from "next/server";
import { AppConfigService } from "../config/app-config.service";
import { ApiRouteError } from "../http/api-error";

interface ClerkSessionAuth {
  isAuthenticated: boolean;
  userId: string | null;
}

interface ClerkJwtPayload {
  sub?: unknown;
  iss?: unknown;
}

export async function requireUserId(request: NextRequest, config: AppConfigService): Promise<string> {
  if (!config.clerkSecretKey) {
    throw new ApiRouteError(
      503,
      "CLERK_NOT_CONFIGURED",
      "Clerk authentication is not configured on the backend"
    );
  }

  // Browser calls use Clerk's session cookie, while workers and other API
  // clients use a Bearer token. Checking only the latter silently created
  // anonymous interview histories for signed-in browser users.
  const authenticatedRequest = await authenticateRequestToken(request, config).catch(() => null);
  if (authenticatedRequest) {
    return authenticatedRequest.userId;
  }

  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  }

  const verifiedBearer = await verifyBearerToken(token, config).catch(() => null);
  if (verifiedBearer) {
    return verifiedBearer.userId;
  }

  if (config.nodeEnv !== "production") {
    const developmentAuth = decodeDevelopmentClerkToken(token);
    if (developmentAuth) {
      return developmentAuth.userId;
    }
  }

  throw new ApiRouteError(401, "AUTH_INVALID", "The supplied authentication token is invalid");
}

async function authenticateRequestToken(
  request: NextRequest,
  config: AppConfigService
): Promise<{ userId: string } | null> {
  const clerkClient = createClerkClient({
    secretKey: config.clerkSecretKey
  });
  const requestState = await clerkClient.authenticateRequest(request, {
    acceptsToken: "session_token",
    authorizedParties: getAuthorizedParties(config)
  });
  const auth = requestState.toAuth() as unknown as ClerkSessionAuth;

  if (!auth.isAuthenticated || typeof auth.userId !== "string" || auth.userId.length === 0) {
    return null;
  }

  return { userId: auth.userId };
}

async function verifyBearerToken(
  token: string,
  config: AppConfigService
): Promise<{ userId: string } | null> {
  const payload = (await verifyToken(token, {
    secretKey: config.clerkSecretKey,
    authorizedParties: getAuthorizedParties(config)
  })) as ClerkJwtPayload;

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return null;
  }

  return { userId: payload.sub };
}

function decodeDevelopmentClerkToken(token: string): { userId: string } | null {
  const [, encodedPayload] = token.split(".");

  if (!encodedPayload) {
    return null;
  }

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const parsed = JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf8")) as ClerkJwtPayload;

    if (
      typeof parsed.sub !== "string" ||
      parsed.sub.length === 0 ||
      (typeof parsed.iss === "string" && !parsed.iss.includes("clerk"))
    ) {
      return null;
    }

    return { userId: parsed.sub };
  } catch {
    return null;
  }
}

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function getAuthorizedParties(config: AppConfigService): string[] | undefined {
  const origins = config.corsOrigins.filter((origin) => origin !== "*");
  return origins.length > 0 ? origins : undefined;
}
