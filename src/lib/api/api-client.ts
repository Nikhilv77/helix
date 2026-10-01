import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  DecideResponse,
  CandidateProfile,
  CandidateProfileInput,
  Level,
  ResumeExtractionResponse,
  Role,
  SessionResponse,
  WorkspaceAccent
} from "../shared/types";
import type {
  BaselineSection,
  PreparationOnboardingStage,
  PreparationOnboardingState
} from "@/features/preparation-onboarding/domain/preparation-onboarding";
import type { PersonalizedInterviewPlan } from "@/features/interviews/domain/personalized-plan";
import { markSummaryDataChanged } from "@/lib/workspace/summary-cache-invalidation";

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status: number;

  constructor(params: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    status: number;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.details = params.details ?? {};
    this.status = params.status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request<TData>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {}
): Promise<TData> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store"
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !isSuccess(payload)) {
    const error = isErrorEnvelope(payload)
      ? payload.error
      : { code: "REQUEST_FAILED", message: "Request failed", details: {} };

    throw new ApiClientError({
      code: error.code,
      message: error.message,
      details: error.details,
      status: response.status
    });
  }

  if (options.method && options.method !== "GET") markSummaryDataChanged();
  return payload.data as TData;
}

/** Browser-safe transport for feature-owned API clients. */
export const apiRequest = request;

function isSuccess(value: unknown): value is ApiSuccessResponse<unknown> {
  return isRecord(value) && value.success === true && "data" in value;
}

function isErrorEnvelope(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && value.success === false && isRecord(value.error);
}

export function submitAnswer(params: {
  sessionId: string;
  turnId?: string;
  userAnswer: string;
  startMs: number;
  endMs: number;
  submissionSource?: "voice" | "workspace";
  liveProposal?: {
    action: "clarify" | "probe" | "challenge" | "respond" | "move_on";
    missing: "clarity" | "structure" | "specificity" | "ownership" | "outcome" | "none";
    candidateIntent?: "answer" | "decline" | "end" | "question-or-clarification" | "other";
    reason: string;
    acknowledgement: string;
    line: string;
    candidateResponse?: string;
  };
  /** How long the previous turn's wait was, for latency logs. */
  clientTimings?: {
    speechToRequestMs: number | null;
    requestMs: number | null;
    responseToAudioMs: number | null;
    speechToAudioMs: number | null;
  };
}): Promise<DecideResponse> {
  // One turn ID for every attempt: the server replays a turn it already
  // saved, so a retry can never record the same answer twice.
  const body = { ...params, turnId: params.turnId ?? crypto.randomUUID() };
  return withTurnRetries((signal) =>
    request<DecideResponse>("/api/interview/decide", { method: "POST", body, signal })
  );
}

const TURN_ATTEMPT_TIMEOUT_MS = 20_000;
const TURN_RETRY_DELAYS_MS = [600, 1_500, 3_000] as const;
/** Busy states that clear on their own once the previous turn finishes. */
const RETRYABLE_TURN_CODES = new Set(["ANSWER_IN_PROGRESS", "ANSWER_EVALUATION_IN_PROGRESS"]);

/**
 * A spoken answer must survive a dropped request, a cold start, or a turn the
 * server is still finishing. Validation and ownership errors fail at once.
 */
export async function withTurnRetries<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))
): Promise<T> {
  for (let index = 0; ; index += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TURN_ATTEMPT_TIMEOUT_MS);
    try {
      return await attempt(controller.signal);
    } catch (error) {
      const delay = TURN_RETRY_DELAYS_MS[index];
      if (delay === undefined || !isRetryableTurnError(error)) throw error;
      const requested =
        error instanceof ApiClientError && typeof error.details.retryAfterMs === "number"
          ? Math.min(5_000, error.details.retryAfterMs)
          : 0;
      await wait(Math.max(delay, requested));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRetryableTurnError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return (
      error.status >= 500 ||
      RETRYABLE_TURN_CODES.has(error.code) ||
      (error.status === 409 && error.details.retryable === true)
    );
  }
  // fetch rejects with a TypeError when the network fails, and with an
  // AbortError when the attempt timed out.
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

export function skipDsaBlockAssessmentCode(params: {
  sessionId: string;
  turnId?: string;
  startMs: number;
  endMs: number;
}): Promise<DecideResponse> {
  return request<DecideResponse>("/api/interview/dsa/block-assessment/skip", {
    method: "POST",
    body: { ...params, turnId: params.turnId ?? crypto.randomUUID() }
  });
}

export const skipBlockAssessmentCode = skipDsaBlockAssessmentCode;

export function getSession(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/interview/${sessionId}`, { signal });
}

export function endInterview(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/interview/${sessionId}`, { method: "DELETE" });
}

export function getProfile(): Promise<CandidateProfile> {
  return request<CandidateProfile>("/api/profile");
}

export function reconcileInterviewOwner(): Promise<{ moved: number }> {
  return request<{ moved: number }>("/api/interview/reconcile-owner", { method: "POST" });
}

export function getPersonalizedInterviewPlan(): Promise<PersonalizedInterviewPlan> {
  return request<PersonalizedInterviewPlan>("/api/interview-plan");
}

export function saveProfile(profile: CandidateProfileInput): Promise<CandidateProfile> {
  return request<CandidateProfile>("/api/profile", { method: "PUT", body: profile });
}

type PreparationOnboardingResponse = { state: PreparationOnboardingState; planReady: boolean };

export function advancePreparationTarget(input: {
  targetRole: Role;
  level: Level;
  targetCompany: string;
  targetDate: string | null;
  nextStage: PreparationOnboardingStage;
}): Promise<PreparationOnboardingResponse> {
  return request<PreparationOnboardingResponse>("/api/preparation-onboarding", {
    method: "POST",
    body: { action: "advance-target", ...input }
  });
}

export function startPreparationBaseline(): Promise<PreparationOnboardingResponse> {
  return request<PreparationOnboardingResponse>("/api/preparation-onboarding", {
    method: "POST",
    body: { action: "start-baseline" }
  });
}

export function submitPreparationBaseline(input: {
  section: BaselineSection;
  choiceId: string;
}): Promise<PreparationOnboardingResponse> {
  return request<PreparationOnboardingResponse>("/api/preparation-onboarding", {
    method: "POST",
    body: { action: "submit-baseline", ...input }
  });
}

export async function deleteAccount(): Promise<{ deleted: boolean }> {
  const response = await fetch("/api/account", {
    method: "DELETE",
    cache: "no-store"
  });

  const payload: unknown = await response.json().catch(() => null);

  if (isRecord(payload) && "clerk_error" in payload) {
    return payload as never;
  }

  if (!response.ok || !isSuccess(payload)) {
    const error = isErrorEnvelope(payload)
      ? payload.error
      : { code: "REQUEST_FAILED", message: "Request failed", details: {} };

    throw new ApiClientError({
      code: error.code,
      message: error.message,
      details: error.details,
      status: response.status
    });
  }

  return payload.data as { deleted: boolean };
}

export function getWorkspaceAccent(): Promise<{ accent: WorkspaceAccent }> {
  return request<{ accent: WorkspaceAccent }>("/api/account/accent");
}

export function saveWorkspaceAccent(accent: WorkspaceAccent): Promise<{ accent: WorkspaceAccent }> {
  return request<{ accent: WorkspaceAccent }>("/api/account/accent", {
    method: "PUT",
    body: { accent }
  });
}

export function saveWorkspaceTeacher(teacherId: string): Promise<{ teacherId: string }> {
  return request<{ teacherId: string }>("/api/account/teacher", {
    method: "PUT",
    body: { teacherId }
  });
}

export interface NotificationPreferences {
  helpNotificationsEnabled: boolean;
  teacherNotificationsEnabled: boolean;
}

export function saveNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<Partial<NotificationPreferences>> {
  return request<Partial<NotificationPreferences>>("/api/notifications/preferences", {
    method: "PUT",
    body: preferences
  });
}

export async function uploadResume(input: {
  file: File;
  targetRole?: Role;
  level: Level;
  mode?: "onboarding" | "replace";
  signal?: AbortSignal;
}): Promise<ResumeExtractionResponse> {
  const body = new FormData();
  body.set("resume", input.file);
  if (input.targetRole) body.set("targetRole", input.targetRole);
  body.set("level", input.level);
  if (input.mode === "replace") body.set("mode", "replace");

  const response = await fetch("/api/onboarding/resume", {
    method: "POST",
    body,
    cache: "no-store",
    signal: input.signal
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok || !isSuccess(payload)) {
    // A response with no readable envelope means the request died in transit
    // or was cut short by the platform, not that the resume was rejected.
    const error = isErrorEnvelope(payload)
      ? payload.error
      : {
          code: "RESUME_UPLOAD_FAILED",
          message:
            "The upload did not complete. Check your connection and try the same file again.",
          details: {}
        };
    throw new ApiClientError({
      code: error.code,
      message: error.message,
      details: error.details,
      status: response.status
    });
  }

  return payload.data as ResumeExtractionResponse;
}

export function confirmResumeUpdate(
  result: ResumeExtractionResponse
): Promise<{ profile: CandidateProfile }> {
  return request<{ profile: CandidateProfile }>("/api/profile/resume", {
    method: "POST",
    body: {
      resumeFile: result.resumeFile,
      extraction: result.extraction,
      confirmationToken: result.confirmationToken,
      previewExpiresAt: result.previewExpiresAt
    }
  });
}

export function completeOnboarding(
  result: ResumeExtractionResponse,
  teacherId?: string | null
): Promise<{ completed: true }> {
  if (!result.profile.targetRole || !result.profile.level) {
    throw new ApiClientError({
      code: "ONBOARDING_SELECTION_MISSING",
      message:
        "Trailgrad could not infer a role or confirm your experience level from this preview.",
      status: 400
    });
  }

  return request<{ completed: true }>("/api/onboarding/complete", {
    method: "POST",
    body: {
      targetRole: result.profile.targetRole,
      level: result.profile.level,
      teacherId: teacherId ?? null,
      resumeFile: result.resumeFile,
      extraction: result.extraction,
      confirmationToken: result.confirmationToken,
      previewExpiresAt: result.previewExpiresAt
    }
  });
}
