import { auth } from "@clerk/nextjs/server";
import type { NextRequest, NextResponse } from "next/server";
import { AppConfigService } from "../config/app-config.service";
import { requireUserId } from "../auth/request-auth";
import {
  createAnonymousOwnerCookie,
  INTERVIEW_OWNER_COOKIE,
  requireInterviewAuthSecret,
  verifyAnonymousOwnerCookie
} from "./interview-auth";

export interface ResolvedInterviewOwner {
  ownerId: string;
  /** Present only when this response must establish a new anonymous browser. */
  cookieValue?: string;
}

/**
 * Interviews work logged out, so the daily cap needs an identity even without
 * Clerk. Signed-in users are keyed by their Clerk id; everyone else receives a
 * cryptographically random, signed browser identity.
 */
export async function resolveInterviewOwner(
  request: NextRequest,
  config: AppConfigService
): Promise<ResolvedInterviewOwner> {
  const authenticated = await authenticatedOwnerFromRequest(request, config);
  if (authenticated) return { ownerId: authenticated };

  const existing = anonymousOwnerIdFromRequest(request, config);
  if (existing) return { ownerId: existing };

  const created = createAnonymousOwnerCookie(requireInterviewAuthSecret(config));
  return { ownerId: created.ownerId, cookieValue: created.value };
}

/** Resolves an already-established owner without silently creating access. */
export async function existingInterviewOwnerId(
  request: NextRequest,
  config: AppConfigService
): Promise<string | null> {
  return (
    (await authenticatedOwnerFromRequest(request, config)) ??
    anonymousOwnerIdFromRequest(request, config)
  );
}

export function anonymousOwnerIdFromRequest(
  request: NextRequest,
  config: AppConfigService
): string | null {
  const value = request.cookies.get(INTERVIEW_OWNER_COOKIE)?.value;
  if (!value || !config.interviewAuthSecret) return null;
  return verifyAnonymousOwnerCookie(value, config.interviewAuthSecret);
}

export function attachInterviewOwnerCookie<T extends NextResponse>(
  response: T,
  owner: ResolvedInterviewOwner,
  config: AppConfigService
): T {
  if (!owner.cookieValue) return response;
  response.cookies.set(INTERVIEW_OWNER_COOKIE, owner.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60
  });
  return response;
}

export function clearInterviewOwnerCookie<T extends NextResponse>(
  response: T,
  config: AppConfigService
): T {
  response.cookies.set(INTERVIEW_OWNER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

/** Canonical durable owner key for server-rendered, Clerk-authenticated pages. */
export function authenticatedOwnerId(userId: string): string {
  return `user:${userId}`;
}

/**
 * Inverse of {@link authenticatedOwnerId}. Null for anonymous owners, which
 * have no Clerk user behind them and so cannot be looked up or emailed.
 */
export function ownerIdToUserId(ownerId: string): string | null {
  return ownerId.startsWith("user:") ? ownerId.slice("user:".length) : null;
}

async function authenticatedOwnerFromRequest(
  request: NextRequest,
  config: AppConfigService
): Promise<string | null> {
  // Route handlers already run inside Clerk's request context. Prefer it over
  // manually re-authenticating the cookie, which can otherwise fall through
  // to an anonymous identity for a signed-in workspace user.
  const clerkAuth = await auth().catch(() => null);
  if (clerkAuth?.userId) return authenticatedOwnerId(clerkAuth.userId);

  const requestUserId = await requireUserId(request, config).catch(() => null);
  return requestUserId ? authenticatedOwnerId(requestUserId) : null;
}
