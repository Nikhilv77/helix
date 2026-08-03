import { createHash } from "node:crypto";
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
  const userId = await requireUserId(request, config).catch(() => null);
  if (userId) {
    return `user:${userId}`;
  }

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
