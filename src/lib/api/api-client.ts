import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  DecideResponse,
  CandidateProfile,
  CandidateProfileInput,
  Level,
  ResumeExtractionResponse,
  Role,
  InterviewSetup,
  SessionResponse,
  StartResponse,
  WorkspaceAccent
} from "../shared/types";
import type {
  BaselineSection,
  PreparationOnboardingStage,
  PreparationOnboardingState
} from "../preparation/preparation-onboarding";
import type { PersonalizedInterviewPlan } from "../interviews/personalized-plan";
import type { WorkspaceSearchResponse } from "../search/workspace-search";

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

  return payload.data as TData;
}

function isSuccess(value: unknown): value is ApiSuccessResponse<unknown> {
  return isRecord(value) && value.success === true && "data" in value;
}

function isErrorEnvelope(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && value.success === false && isRecord(value.error);
}

export function startInterview(setup: InterviewSetup): Promise<StartResponse> {
  return request<StartResponse>("/api/interview/start", { method: "POST", body: setup });
}

export function submitAnswer(params: {
  sessionId: string;
  turnId?: string;
  userAnswer: string;
  startMs: number;
  endMs: number;
}): Promise<DecideResponse> {
  return request<DecideResponse>("/api/interview/decide", {
    method: "POST",
    body: { ...params, turnId: params.turnId ?? crypto.randomUUID() }
  });
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

export function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/interview/${sessionId}`);
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

export function searchWorkspace(
  query: string,
  signal?: AbortSignal
): Promise<WorkspaceSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return request<WorkspaceSearchResponse>(`/api/search?${params.toString()}`, { signal });
}

export async function uploadResume(input: {
  file: File;
  targetRole: Role;
  level: Level;
  mode?: "onboarding" | "replace";
  signal?: AbortSignal;
}): Promise<ResumeExtractionResponse> {
  const body = new FormData();
  body.set("resume", input.file);
  body.set("targetRole", input.targetRole);
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
): Promise<ResumeExtractionResponse> {
  if (!result.profile.targetRole || !result.profile.level) {
    throw new ApiClientError({
      code: "ONBOARDING_SELECTION_MISSING",
      message: "Choose your role and experience level again.",
      status: 400
    });
  }

  return request<ResumeExtractionResponse>("/api/onboarding/complete", {
    method: "POST",
    body: {
      targetRole: result.profile.targetRole,
      level: result.profile.level,
      teacherId: teacherId ?? null,
      resumeFile: result.resumeFile,
      extraction: result.extraction
    }
  });
}
