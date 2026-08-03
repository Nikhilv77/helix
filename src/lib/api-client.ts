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
  StartResponse
} from "./types";

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
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<TData> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
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
  userAnswer: string;
  startMs: number;
  endMs: number;
}): Promise<DecideResponse> {
  return request<DecideResponse>("/api/interview/decide", { method: "POST", body: params });
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

export function saveProfile(profile: CandidateProfileInput): Promise<CandidateProfile> {
  return request<CandidateProfile>("/api/profile", { method: "PUT", body: profile });
}

export async function uploadResume(input: {
  file: File;
  targetRole: Role;
  level: Level;
  signal?: AbortSignal;
}): Promise<ResumeExtractionResponse> {
  const body = new FormData();
  body.set("resume", input.file);
  body.set("targetRole", input.targetRole);
  body.set("level", input.level);

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
