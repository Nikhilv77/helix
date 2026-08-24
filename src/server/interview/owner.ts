import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { AppConfigService } from "../config/app-config.service";
import { requireUserId } from "../auth/request-auth";

/**
 * Interviews work logged out, so the daily cap needs an identity even without
 * Clerk. Signed-in users are keyed by their Clerk id; everyone else falls back
 * to a coarse fingerprint. This is a rate-limit key, not an auth boundary.
 */
export async function resolveOwnerId(
  request: NextRequest,
  config: AppConfigService
): Promise<string> {
  // Route handlers already run inside Clerk's request context. Prefer it over
  // manually re-authenticating the cookie, which can otherwise fall through
  // to an anonymous key for a signed-in workspace user.
  const { userId } = await auth();
  if (userId) return authenticatedOwnerId(userId);

  const requestUserId = await requireUserId(request, config).catch(() => null);
  if (requestUserId) return authenticatedOwnerId(requestUserId);

  return anonymousOwnerId(request);
}

/** The legacy browser-scoped key used only when a visitor is not signed in. */
export function anonymousOwnerId(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "local";
  const agent = request.headers.get("user-agent") ?? "";
  const fingerprint = createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0, 24);

  return `anon:${fingerprint}`;
}

/** Canonical durable owner key for server-rendered, Clerk-authenticated pages. */
export function authenticatedOwnerId(userId: string): string {
  return `user:${userId}`;
}
