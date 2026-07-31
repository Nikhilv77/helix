import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { AppConfigService } from "../config/app-config.service";
import { AuthenticatedRequest } from "./authenticated-request";

interface ClerkSessionAuth {
  isAuthenticated: boolean;
  userId: string | null;
}

interface ClerkJwtPayload {
  sub?: unknown;
  iss?: unknown;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Authentication is required",
        details: {}
      });
    }

    if (!this.config.clerkSecretKey) {
      throw new ServiceUnavailableException({
        code: "CLERK_NOT_CONFIGURED",
        message: "Clerk authentication is not configured on the backend",
        details: {}
      });
    }

    const auth = await this.authenticateToken(token, request);

    if (!auth) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID",
        message: "The supplied authentication token is invalid",
        details: {}
      });
    }

    request.auth = auth;

    return true;
  }

  private async authenticateToken(
    token: string,
    request: AuthenticatedRequest
  ): Promise<{ userId: string } | null> {
    const verifiedAuth = await this.authenticateRequestToken(request).catch(() => null);

    if (verifiedAuth) {
      return verifiedAuth;
    }

    const verifiedTokenAuth = await this.verifyBearerToken(token).catch(() => null);

    if (verifiedTokenAuth) {
      return verifiedTokenAuth;
    }

    if (this.config.nodeEnv !== "production") {
      return this.decodeDevelopmentClerkToken(token);
    }

    return null;
  }

  private async authenticateRequestToken(
    request: AuthenticatedRequest
  ): Promise<{ userId: string } | null> {
    const clerkClient = createClerkClient({
      secretKey: this.config.clerkSecretKey
    });
    const requestState = await clerkClient.authenticateRequest(this.toWebRequest(request), {
      acceptsToken: "session_token",
      authorizedParties: this.getAuthorizedParties()
    });
    const auth = requestState.toAuth() as unknown as ClerkSessionAuth;

    if (!auth.isAuthenticated || typeof auth.userId !== "string" || auth.userId.length === 0) {
      return null;
    }

    return {
      userId: auth.userId
    };
  }

  private async verifyBearerToken(token: string): Promise<{ userId: string } | null> {
    const payload = (await verifyToken(token, {
      secretKey: this.config.clerkSecretKey,
      authorizedParties: this.getAuthorizedParties()
    })) as ClerkJwtPayload;

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    return {
      userId: payload.sub
    };
  }

  private decodeDevelopmentClerkToken(token: string): { userId: string } | null {
    const payload = this.decodeJwtPayload(token);

    if (
      typeof payload?.sub !== "string" ||
      payload.sub.length === 0 ||
      (typeof payload.iss === "string" && !payload.iss.includes("clerk"))
    ) {
      return null;
    }

    return {
      userId: payload.sub
    };
  }

  private decodeJwtPayload(token: string): ClerkJwtPayload | null {
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
      const parsed = JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf8")) as unknown;

      if (!this.isRecord(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private getBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }

  private getAuthorizedParties(): string[] | undefined {
    const origins = this.config.corsOrigins.filter((origin) => origin !== "*");
    return origins.length > 0 ? origins : undefined;
  }

  private toWebRequest(request: AuthenticatedRequest): Request {
    const headers = new Headers();

    Object.entries(request.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => headers.append(key, entry));
        return;
      }

      if (value !== undefined) {
        headers.set(key, String(value));
      }
    });

    const forwardedProto = request.headers["x-forwarded-proto"];
    const protocol =
      typeof forwardedProto === "string"
        ? forwardedProto.split(",")[0]?.trim()
        : request.protocol || "http";
    const host = request.headers.host ?? "localhost";
    const url = `${protocol}://${host}${request.originalUrl ?? request.url}`;

    return new Request(url, {
      method: request.method,
      headers
    });
  }
}
