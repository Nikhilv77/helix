import type { CandidateProfile } from "@/lib/shared/types";
import {
  ResumeRoastTargetSchema,
  type ResumeRoastResult,
  type ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import { ApiRouteError } from "@/server/http/api-error";
import { Logger } from "@/server/common/logger";
import type { AiCallTrace } from "@/server/ai/interfaces/system-designer-ai-provider.interface";
import type { ProfileService } from "@/features/profile/server/profile.service";
import { buildResumeRoastSnapshot, type ResumeRoastSnapshot } from "./resume-signals";
import { RESUME_ROAST_PROMPT_VERSION } from "./resume-roast.prompt";
import {
  RESUME_ROAST_GENERATION_BUDGET_MS,
  ResumeRoastGenerationError,
  ResumeRoastGenerator,
  type ResumeRoastAssessment
} from "./resume-roast.generator";
import { RESUME_ROAST_RUBRIC_VERSION } from "./resume-roast.rubric";
import { ResumeRoastStore, type StoredResumeRoast } from "./resume-roast.store";

/**
 * A GENERATING row older than this can't still be running: the generation
 * budget plus persistence fits well inside it. Such rows are failed so they
 * never block a new roast or show a spinner forever.
 */
export const RESUME_ROAST_GENERATION_STALE_MS = RESUME_ROAST_GENERATION_BUDGET_MS + 45_000;

export interface ResumeRoastSuggestion {
  role?: ResumeRoastTarget["role"];
  level?: ResumeRoastTarget["level"];
}

export interface ResumeRoastPublicRecord {
  id: string;
  target: ResumeRoastTarget;
  result: ResumeRoastResult;
  resumeVersionId?: string;
  resumeFileName?: string | null;
  createdAt?: number;
}

/** A roast already running for this owner, which a reload or second tab can follow. */
export interface ResumeRoastInProgress {
  roastId: string;
  target: ResumeRoastTarget;
  startedAt: number;
}

/** JSON-safe state used by the Roast tab. It deliberately excludes resume data and version ids. */
export interface ResumeRoastState {
  hasResume: boolean;
  target: ResumeRoastTarget | null;
  suggestedTarget: ResumeRoastSuggestion | null;
  previousRoast: ResumeRoastPublicRecord | null;
  history: ResumeRoastPublicRecord[];
  inProgress: ResumeRoastInProgress | null;
}

export interface ResumeRoastClaimedGeneration {
  kind: "claimed";
  roastId: string;
  generationToken: string;
  target: ResumeRoastTarget;
  snapshot: ResumeRoastSnapshot;
  /** Saved score for this resume and target; the scoring pass is skipped. */
  assessment: ResumeRoastAssessment | null;
}

export interface ResumeRoastJoinedGeneration {
  kind: "joined";
  inProgress: ResumeRoastInProgress;
}

export type ResumeRoastPreparation = ResumeRoastClaimedGeneration | ResumeRoastJoinedGeneration;

export type ResumeRoastGenerationState =
  | { status: "generating"; inProgress: ResumeRoastInProgress }
  | { status: "ready"; roast: ResumeRoastPublicRecord }
  | { status: "failed" };

type ProfileReader = Pick<ProfileService, "get" | "ensureActiveResumeVersion">;

const logger = new Logger("ResumeRoast");

/**
 * Authenticated application boundary for Resume Roast. Completed rows are
 * append-only history; this service never reuses one as a generation cache.
 */
export class ResumeRoastService {
  constructor(
    private readonly profiles: ProfileReader,
    private readonly store: ResumeRoastStore,
    private readonly generator: Pick<ResumeRoastGenerator, "generate">,
    private readonly now: () => number = Date.now
  ) {}

  async state(
    ownerId: string,
    suppliedProfile?: CandidateProfile | Promise<CandidateProfile>
  ): Promise<ResumeRoastState> {
    const [profile, target, history, active] = await Promise.all([
      suppliedProfile ?? this.profiles.get(ownerId),
      this.store.getTarget(ownerId),
      this.store.getReadyHistory(ownerId),
      this.store.getActiveGeneration(ownerId, this.staleBefore())
    ]);
    if (!buildResumeRoastSnapshot(profile.resume)) {
      return {
        hasResume: false,
        target: null,
        suggestedTarget: null,
        previousRoast: null,
        history: [],
        inProgress: null
      };
    }

    // Existing profiles normally already have a version. Preserve the legacy
    // first-read repair only for profiles created before version persistence.
    let versionId = profile.resume?.versionId;
    if (!versionId) {
      try {
        versionId = (await this.profiles.ensureActiveResumeVersion(ownerId)).id;
      } catch (error) {
        if (hasCode(error, "RESUME_REQUIRED")) {
          return {
            hasResume: false,
            target: null,
            suggestedTarget: null,
            previousRoast: null,
            history: [],
            inProgress: null
          };
        }
        throw error;
      }
    }
    let previousRoast = history.find((roast) => roast.resumeProfileVersionId === versionId);
    if (!previousRoast) {
      previousRoast =
        (await this.store.getLatestReady(ownerId, versionId)) ?? undefined;
    }
    return {
      hasResume: true,
      target,
      suggestedTarget: suggestTarget(profile),
      previousRoast: previousRoast ? publicRecord(previousRoast) : null,
      history: history.map(publicHistoryRecord),
      inProgress: active ? publicInProgress(active) : null
    };
  }

  /**
   * Claims the owner's single generation slot, or joins the roast that
   * already holds it. `beforeGenerate` (the rate limit) runs only once this
   * request has won the slot, so following a running roast never spends
   * quota, even when two tabs submit at the same instant.
   * A previous completed roast is never returned from this path.
   */
  async prepare(
    ownerId: string,
    targetInput: unknown,
    options: { beforeGenerate?: () => Promise<void> } = {}
  ): Promise<ResumeRoastPreparation> {
    const target = ResumeRoastTargetSchema.parse(targetInput);
    const staleBefore = this.staleBefore();
    const [current, active] = await Promise.all([
      this.currentResume(ownerId),
      this.store.getActiveGeneration(ownerId, staleBefore),
      this.store.failStaleGenerations(ownerId, staleBefore)
    ]);
    if (!current) throw new ApiRouteError(409, "RESUME_REQUIRED", "Add a resume in Profile first.");
    if (active) return { kind: "joined", inProgress: publicInProgress(active) };

    const [generation, assessment] = await Promise.all([
      this.store.createGeneration({
        ownerId,
        resumeProfileVersionId: current.version.id,
        promptVersion: RESUME_ROAST_PROMPT_VERSION,
        ...target
      }),
      this.store.getReusableAssessment(
        ownerId,
        current.version.id,
        target,
        RESUME_ROAST_RUBRIC_VERSION
      )
    ]);
    if (generation.kind === "conflict") {
      // Another request claimed the slot between our check and insert.
      const winner = await this.store.getActiveGeneration(ownerId, staleBefore);
      if (winner) return { kind: "joined", inProgress: publicInProgress(winner) };
      throw new ResumeRoastGenerationFailedError();
    }

    try {
      await Promise.all([options.beforeGenerate?.(), this.store.saveTarget(ownerId, target)]);
    } catch (error) {
      // Release the slot so a refused request never looks like a running roast.
      await this.store
        .fail(ownerId, generation.roastId, generation.generationToken)
        .catch(() => undefined);
      throw error;
    }
    return {
      kind: "claimed",
      roastId: generation.roastId,
      generationToken: generation.generationToken,
      target,
      snapshot: current.snapshot,
      assessment: assessment?.scorecard
        ? { scorecard: assessment.scorecard, verdict: assessment.verdict }
        : null
    };
  }

  /** Where a roast started by any request stands, for reloads and other tabs. */
  async generationState(ownerId: string, roastId: string): Promise<ResumeRoastGenerationState> {
    const status = await this.store.getGenerationStatus(ownerId, roastId, this.staleBefore());
    if (!status) throw new ApiRouteError(404, "RESUME_ROAST_NOT_FOUND", "That roast was not found.");
    if (status.status === "generating") {
      return {
        status: "generating",
        inProgress: { roastId, target: status.target, startedAt: status.startedAt.getTime() }
      };
    }
    if (status.status === "ready") return { status: "ready", roast: publicHistoryRecord(status.roast) };
    return { status: "failed" };
  }

  /**
   * Completes only the matching owner-scoped generation token. The caller
   * runs this independently of the browser connection, so a refresh or a
   * closed tab still ends in a saved roast; `signal` is for shutdown only.
   */
  async finishClaim(
    ownerId: string,
    claimed: ResumeRoastClaimedGeneration,
    signal?: AbortSignal
  ): Promise<ResumeRoastPublicRecord> {
    const startedAt = this.now();
    const calls: AiCallTrace[] = [];
    try {
      if (signal?.aborted) throw new ResumeRoastCancelledError();
      const result = await this.generator.generate({
        snapshot: claimed.snapshot,
        target: claimed.target,
        assessment: claimed.assessment,
        onTrace: (trace) => calls.push(trace),
        ...(signal ? { signal } : {})
      });
      if (signal?.aborted) throw new ResumeRoastCancelledError();

      const completed = await this.store.complete(
        ownerId,
        claimed.roastId,
        claimed.generationToken,
        result
      );
      if (!completed) throw new ResumeRoastGenerationFailedError();
      logGeneration({
        roastId: claimed.roastId,
        outcome: "ready",
        durationMs: this.now() - startedAt,
        scoreReused: Boolean(claimed.assessment),
        overall: result.scorecard?.overall,
        problems: result.problems.length,
        rewrite: result.rewrite !== null,
        calls
      });
      return { id: claimed.roastId, target: claimed.target, result };
    } catch (error) {
      // Token-scoped failure means a newer claim can never be overwritten.
      await this.store
        .fail(ownerId, claimed.roastId, claimed.generationToken)
        .catch(() => undefined);
      const mapped =
        error instanceof ResumeRoastCancelledError || signal?.aborted
          ? new ResumeRoastCancelledError()
          : error instanceof ResumeRoastGenerationFailedError
            ? error
            : error instanceof ResumeRoastGenerationError
              ? new ResumeRoastInvalidResponseError()
              : error instanceof AiProviderException && error.code === "AI_RATE_LIMITED"
                ? new ResumeRoastProviderRateLimitedError()
                : error instanceof AiProviderException && error.code === "AI_TIMEOUT"
                  ? new ResumeRoastTimeoutError()
                  : error instanceof AiProviderException && error.code === "AI_INVALID_RESPONSE"
                    ? new ResumeRoastInvalidResponseError()
                    : new ResumeRoastGenerationFailedError();
      logGeneration({
        roastId: claimed.roastId,
        outcome: "failed",
        durationMs: this.now() - startedAt,
        scoreReused: Boolean(claimed.assessment),
        errorCode: mapped.code,
        calls
      });
      throw mapped;
    }
  }

  async delete(ownerId: string, roastId: string): Promise<boolean> {
    return this.store.delete(ownerId, roastId);
  }

  private staleBefore(): Date {
    return new Date(this.now() - RESUME_ROAST_GENERATION_STALE_MS);
  }

  private async currentResume(ownerId: string): Promise<CurrentResume | null> {
    const profile = await this.profiles.get(ownerId);
    const snapshot = buildResumeRoastSnapshot(profile.resume);
    if (!snapshot) return null;

    let version: { id: string };
    try {
      version = profile.resume?.versionId
        ? { id: profile.resume.versionId }
        : await this.profiles.ensureActiveResumeVersion(ownerId);
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
  version: { id: string };
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

/**
 * One line per roast for production monitoring: how long it took, which
 * provider answered each pass, and why it failed. It deliberately carries
 * no resume text, model output or owner id.
 */
function logGeneration(entry: {
  roastId: string;
  outcome: "ready" | "failed";
  durationMs: number;
  scoreReused: boolean;
  overall?: number | undefined;
  problems?: number;
  rewrite?: boolean;
  errorCode?: string;
  calls: AiCallTrace[];
}): void {
  const { calls, ...rest } = entry;
  const record = {
    event: "resume_roast.generation",
    ...rest,
    usedFallback: calls.some((call) => call.operation.endsWith("-fallback")),
    calls: calls.map((call) => ({
      operation: call.operation,
      provider: call.provider,
      model: call.model,
      durationMs: call.durationMs,
      outcome: call.outcome,
      ...(call.errorCode ? { errorCode: call.errorCode } : {})
    }))
  };
  if (entry.outcome === "ready") logger.log(record);
  else logger.warn(record);
}

function publicInProgress(active: {
  roastId: string;
  target: ResumeRoastTarget;
  startedAt: Date;
}): ResumeRoastInProgress {
  return { roastId: active.roastId, target: active.target, startedAt: active.startedAt.getTime() };
}

function publicHistoryRecord(record: StoredResumeRoast): ResumeRoastPublicRecord {
  return {
    ...publicRecord(record),
    resumeVersionId: record.resumeProfileVersionId,
    resumeFileName: record.resumeFileName ?? null,
    createdAt: record.createdAt.getTime()
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

export class ResumeRoastProviderRateLimitedError extends ApiRouteError {
  constructor() {
    super(503, "RESUME_ROAST_PROVIDER_RATE_LIMITED", "James is busy. Try again in a minute.");
  }
}

export class ResumeRoastTimeoutError extends ApiRouteError {
  constructor() {
    super(504, "RESUME_ROAST_TIMEOUT", "James took too long. Try again.");
  }
}
