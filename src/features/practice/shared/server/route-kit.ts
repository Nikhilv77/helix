import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import type { AppConfigService } from "@/server/config/app-config.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { requireCompletedPreparationOnboardingState } from "@/server/auth/preparation-onboarding-api-guard";
import {
  getSharedGuard,
  type LockPolicy,
  type RateLimitPolicy,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import type { StoryPracticeEligibility, StoryPracticeOwnerContext } from "./contracts";

type RouteApp = {
  config: AppConfigService;
  profileService: {
    get(ownerId: string): Promise<CandidateProfile>;
    workspaceShellState(ownerId: string): Promise<{
      onboardingCompletedAt: number | null;
      preparationCompletedAt: number | null;
      targetRole: CandidateProfile["targetRole"];
    } | null>;
  };
};

/**
 * Reads the profile and spends the rate limit in parallel (database and Redis
 * are separate round trips). A profile failure is reported before a limit.
 */
export async function profileAndRateLimit<T>(
  profile: Promise<T>,
  rateLimit: Promise<void> | undefined
): Promise<T> {
  const [read, limit] = await Promise.allSettled([profile, rateLimit]);
  if (read.status === "rejected") throw read.reason;
  if (limit.status === "rejected") throw limit.reason;
  return read.value;
}

type RouteErrorResponder = (error: unknown, path: string) => Response;

export function createStoryPracticeRouteAccess<TApp extends RouteApp>(config: {
  errorPrefix: string;
  label: string;
  getApp(): TApp;
  requireOnboarding(profile: CandidateProfile): void;
  eligibility(app: TApp, profile: CandidateProfile): Promise<StoryPracticeEligibility>;
}) {
  async function owner(
    policy?: RateLimitPolicy
  ): Promise<StoryPracticeOwnerContext<TApp, CandidateProfile>> {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);
    const app = config.getApp();
    const profile = await profileAndRateLimit(
      app.profileService.get(ownerId),
      policy && getSharedGuard(app.config).enforce(policy, ownerId)
    );
    config.requireOnboarding(profile);
    return { ownerId, app, profile };
  }

  async function compactOwner(policy?: RateLimitPolicy) {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);
    const app = config.getApp();
    const state = await profileAndRateLimit(
      app.profileService.workspaceShellState(ownerId),
      policy && getSharedGuard(app.config).enforce(policy, ownerId)
    );
    requireCompletedPreparationOnboardingState(state);
    return { ownerId, app, targetRole: state.targetRole };
  }

  async function requireEligibility(app: TApp, profile: CandidateProfile) {
    const eligibility = await config.eligibility(app, profile);
    if (!eligibility.available) {
      throw new ApiRouteError(
        eligibility.reason === "RUNNER_UNAVAILABLE" ? 503 : 409,
        `${config.errorPrefix}_${eligibility.reason}`,
        eligibility.message
      );
    }
    return eligibility;
  }

  async function parseJson<TSchema extends z.ZodTypeAny>(
    request: NextRequest,
    schema: TSchema
  ): Promise<z.output<TSchema>> {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(
        400,
        `${config.errorPrefix}_INVALID_REQUEST`,
        `That ${config.label} request is invalid.`,
        {
          messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        }
      );
    }
    return parsed.data;
  }

  return { owner, compactOwner, parseJson, requireEligibility };
}

export function createStoryPracticeReadHandler<TApp, TProfile, TResult>(config: {
  owner(): Promise<StoryPracticeOwnerContext<TApp, TProfile>>;
  execute(context: StoryPracticeOwnerContext<TApp, TProfile>): Promise<TResult>;
  present?: (result: TResult) => unknown;
  onError?: RouteErrorResponder;
}) {
  return async function GET(request: NextRequest): Promise<Response> {
    try {
      const context = await config.owner();
      const result = await config.execute(context);
      return apiSuccess(config.present ? config.present(result) : result);
    } catch (error) {
      return (config.onError ?? apiError)(error, request.nextUrl.pathname);
    }
  };
}

export function createStoryPracticeMutationHandler<
  TSchema extends z.ZodTypeAny,
  TApp extends { config: AppConfigService },
  TProfile,
  TResult
>(config: {
  policy: RateLimitPolicy;
  owner(policy: RateLimitPolicy): Promise<StoryPracticeOwnerContext<TApp, TProfile>>;
  schema: TSchema;
  parseJson(request: NextRequest, schema: TSchema): Promise<z.output<TSchema>>;
  requireEligibility?: (app: TApp, profile: TProfile) => Promise<unknown>;
  lease?: LockPolicy & {
    identity(context: StoryPracticeOwnerContext<TApp, TProfile>, input: z.output<TSchema>): string;
  };
  execute(
    context: StoryPracticeOwnerContext<TApp, TProfile>,
    input: z.output<TSchema>
  ): Promise<TResult>;
  present?: (result: TResult) => unknown;
  onError?: RouteErrorResponder;
}) {
  return async function POST(request: NextRequest): Promise<Response> {
    let lease: SharedLease | undefined;
    try {
      const context = await config.owner(config.policy);
      if (config.requireEligibility) {
        await config.requireEligibility(context.app, context.profile);
      }
      const input = await config.parseJson(request, config.schema);
      if (config.lease) {
        const { identity, ...policy } = config.lease;
        lease = await getSharedGuard(context.app.config).acquire(policy, identity(context, input));
      }
      const result = await config.execute(context, input);
      return apiSuccess(config.present ? config.present(result) : result);
    } catch (error) {
      return (config.onError ?? apiError)(error, request.nextUrl.pathname);
    } finally {
      await lease?.release();
    }
  };
}
