import type { CandidateProfile } from "@/lib/shared/types";
import {
  ResumeRoastTargetSchema,
  type ResumeRoastResult,
  type ResumeRoastTarget
} from "@/lib/resume-roast/contracts";
import type { CandidateInterviewProfile } from "@/lib/interviews/personalized-plan";
import { AiProviderException } from "../ai/ai-provider.exception";
import { ApiRouteError } from "../http/api-error";
import type { PersonalizedPlanningStore } from "../interview/personalized-planning-store";
import type { ProfileService } from "../profile/profile.service";
import { buildResumeRoastSnapshot, type ResumeRoastSnapshot } from "./resume-signals";
import { RESUME_ROAST_PROMPT_VERSION } from "./resume-roast.prompt";
import { ResumeRoastGenerationError, ResumeRoastGenerator } from "./resume-roast.generator";
import { ResumeRoastStore, type StoredResumeRoast } from "./resume-roast.store";

export interface ResumeRoastSuggestion {
  role?: ResumeRoastTarget["role"];
  level?: ResumeRoastTarget["level"];
}

export interface ResumeRoastPublicRecord {
  id: string;
  target: ResumeRoastTarget;
  result: ResumeRoastResult;
}

/** JSON-safe state used by the Roast tab. It deliberately excludes resume data and version ids. */
export interface ResumeRoastState {
  hasResume: boolean;
  target: ResumeRoastTarget | null;
  suggestedTarget: ResumeRoastSuggestion | null;
  previousRoast: ResumeRoastPublicRecord | null;
}

export interface ResumeRoastClaimedGeneration {
  kind: "claimed";
  roastId: string;
  generationToken: string;
  target: ResumeRoastTarget;
  snapshot: ResumeRoastSnapshot;
}

export type ResumeRoastPreparation = ResumeRoastClaimedGeneration;

type ProfileReader = Pick<ProfileService, "get">;
type CandidateProfileStore = Pick<PersonalizedPlanningStore, "ensureCandidateProfile">;

/**
 * Authenticated application boundary for Resume Roast. Completed rows are
 * append-only history; this service never reuses one as a generation cache.
 */
export class ResumeRoastService {
  constructor(
    private readonly profiles: ProfileReader,
    private readonly planningStore: CandidateProfileStore,
    private readonly store: ResumeRoastStore,
    private readonly generator: Pick<ResumeRoastGenerator, "generate">
  ) {}

  async state(ownerId: string): Promise<ResumeRoastState> {
    const current = await this.currentResume(ownerId);
    if (!current) {
      return { hasResume: false, target: null, suggestedTarget: null, previousRoast: null };
    }

    const target = await this.store.getTarget(ownerId);
    const previousRoast = await this.store.getLatestReady(ownerId);
    return {
      hasResume: true,
      target,
      suggestedTarget: suggestTarget(current.profile),
      previousRoast: previousRoast ? publicRecord(previousRoast) : null
    };
  }

  /**
   * Creates a fresh history row before the sole model request. A previous
   * completed roast is never returned from this path.
   */
  async prepare(ownerId: string, targetInput: unknown): Promise<ResumeRoastPreparation> {
    const target = ResumeRoastTargetSchema.parse(targetInput);
    const current = await this.currentResume(ownerId);
    if (!current) throw new ApiRouteError(409, "RESUME_REQUIRED", "Add a resume in Profile first.");

    await this.store.saveTarget(ownerId, target);
    const generation = await this.store.createGeneration({
      ownerId,
      resumeProfileVersionId: current.version.id,
      promptVersion: RESUME_ROAST_PROMPT_VERSION,
      ...target
    });
    return {
      kind: "claimed",
      roastId: generation.roastId,
      generationToken: generation.generationToken,
      target,
      snapshot: current.snapshot
    };
  }

  /** Completes only the matching owner-scoped generation token. */
  async finishClaim(
    ownerId: string,
    claimed: ResumeRoastClaimedGeneration,
    signal: AbortSignal
  ): Promise<ResumeRoastPublicRecord> {
    try {
      if (signal.aborted) throw new ResumeRoastCancelledError();
      const result = await this.generator.generate({
        snapshot: claimed.snapshot,
        target: claimed.target,
        signal
      });
      if (signal.aborted) throw new ResumeRoastCancelledError();

      const completed = await this.store.complete(
        ownerId,
        claimed.roastId,
        claimed.generationToken,
        result
      );
      if (!completed) throw new ResumeRoastGenerationFailedError();
      return { id: claimed.roastId, target: claimed.target, result };
    } catch (error) {
      // Token-scoped failure means a newer claim can never be overwritten.
      await this.store
        .fail(ownerId, claimed.roastId, claimed.generationToken)
        .catch(() => undefined);
      if (error instanceof ResumeRoastCancelledError || signal.aborted) {
        throw new ResumeRoastCancelledError();
      }
      if (error instanceof ResumeRoastGenerationFailedError) throw error;
      if (error instanceof ResumeRoastGenerationError) throw new ResumeRoastInvalidResponseError();
      if (error instanceof AiProviderException) {
        if (error.code === "AI_TIMEOUT") throw new ResumeRoastTimeoutError();
        if (error.code === "AI_INVALID_RESPONSE") throw new ResumeRoastInvalidResponseError();
      }
      throw new ResumeRoastGenerationFailedError();
    }
  }

  async delete(ownerId: string, roastId: string): Promise<boolean> {
    return this.store.delete(ownerId, roastId);
  }

  private async currentResume(ownerId: string): Promise<CurrentResume | null> {
    const profile = await this.profiles.get(ownerId);
    const snapshot = buildResumeRoastSnapshot(profile.resume);
    if (!snapshot) return null;

    let version: CandidateInterviewProfile;
    try {
      version = await this.planningStore.ensureCandidateProfile(ownerId);
    } catch (error) {
      // A concurrent resume removal is still the regular Profile handoff, not
      // a failed Roast session. Avoid propagating profile details into logs.
      if (hasCode(error, "RESUME_REQUIRED")) return null;
      throw error;
    }
    return { profile, snapshot, version };
  }
}

interface CurrentResume {
  profile: CandidateProfile;
  snapshot: ResumeRoastSnapshot;
  version: CandidateInterviewProfile;
}

function publicRecord(record: StoredResumeRoast): ResumeRoastPublicRecord {
  return {
    id: record.id,
    target: {
      role: record.role,
      companyEnvironment: record.companyEnvironment,
      level: record.level
    },
    result: record.result
  };
}

function suggestTarget(profile: CandidateProfile): ResumeRoastSuggestion | null {
  const role =
    profile.targetRole === "backend"
      ? "backend-engineer"
      : profile.targetRole === "frontend"
        ? "frontend-engineer"
        : profile.targetRole === "fullstack"
          ? "full-stack-engineer"
          : profile.targetRole === "data" || profile.targetRole === "ai-ml"
            ? "data-or-ml-engineer"
            : undefined;
  const level =
    profile.level === "fresher"
      ? "internship-or-new-grad"
      : profile.level === "0-2"
        ? "junior"
        : profile.level === "3-5"
          ? "mid-level"
          : profile.level === "5-plus"
            ? "senior"
            : undefined;
  return role || level ? { ...(role ? { role } : {}), ...(level ? { level } : {}) } : null;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export class ResumeRoastCancelledError extends ApiRouteError {
  constructor() {
    super(499, "RESUME_ROAST_CANCELLED", "Resume Roast generation was cancelled.");
  }
}

export class ResumeRoastInvalidResponseError extends ApiRouteError {
  constructor() {
    super(502, "RESUME_ROAST_INVALID_RESPONSE", "James could not safely prepare that feedback.");
  }
}

export class ResumeRoastGenerationFailedError extends ApiRouteError {
  constructor() {
    super(503, "RESUME_ROAST_GENERATION_FAILED", "James could not prepare a roast right now.");
  }
}

export class ResumeRoastTimeoutError extends ApiRouteError {
  constructor() {
    super(504, "RESUME_ROAST_TIMEOUT", "James took too long. Try again.");
  }
}
