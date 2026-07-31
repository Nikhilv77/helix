import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  CapacityCalculation,
  CapacityResponse,
  DesignSession,
  DiagramResponse,
  GeneratedDesignResponse,
  PaginationMeta,
  Project,
  ProjectStatus,
  RequirementsResponse,
  ValidationResponse
} from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
}

type AuthTokenProvider = () => Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;
const AUTH_TOKEN_RETRY_ATTEMPTS = 10;
const AUTH_TOKEN_RETRY_DELAY_MS = 100;

export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status: number;
  readonly path?: string;

  constructor(params: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    status: number;
    path?: string;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.details = params.details ?? {};
    this.status = params.status;
    this.path = params.path;
  }
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || value.success !== false || !isRecord(value.error)) return false;

  return (
    isString(value.error.code) &&
    isString(value.error.message) &&
    isRecord(value.error.details) &&
    isString(value.timestamp) &&
    isString(value.path)
  );
}

function isApiSuccessResponse<TData>(value: unknown): value is ApiSuccessResponse<TData> {
  return isRecord(value) && value.success === true && "data" in value && isRecord(value.meta);
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function getAuthToken(): Promise<string | null> {
  if (!authTokenProvider) {
    return null;
  }

  for (let attempt = 0; attempt < AUTH_TOKEN_RETRY_ATTEMPTS; attempt += 1) {
    const token = await authTokenProvider();

    if (token) {
      return token;
    }

    await delay(AUTH_TOKEN_RETRY_DELAY_MS);
  }

  return authTokenProvider();
}

async function parseResponse<TData>(response: Response): Promise<ApiSuccessResponse<TData>> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      throw new ApiClientError({
        code: payload.error.code,
        message: payload.error.message,
        details: payload.error.details,
        status: response.status,
        path: payload.path
      });
    }

    throw new ApiClientError({
      code: "HTTP_ERROR",
      message: `Request failed with status ${response.status}`,
      status: response.status
    });
  }

  if (isApiSuccessResponse<TData>(payload)) {
    return payload;
  }

  throw new ApiClientError({
    code: "INVALID_API_RESPONSE",
    message: "The API returned an unexpected response.",
    status: response.status
  });
}

export async function apiRequest<TData>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiSuccessResponse<TData>> {
  const authToken = await getAuthToken();

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  return parseResponse<TData>(response);
}

export interface ProjectListQuery {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "status";
  sortOrder?: "asc" | "desc";
}

export async function listProjects(query: ProjectListQuery = {}): Promise<{
  projects: Project[];
  meta: PaginationMeta;
}> {
  const requestQuery: Record<string, string | number | null | undefined> = {
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder
  };
  const response = await apiRequest<Project[]>("/projects", { query: requestQuery });
  return {
    projects: response.data,
    meta: response.meta as PaginationMeta
  };
}

export async function createProject(body: {
  name: string;
  description?: string;
}): Promise<Project> {
  return (await apiRequest<Project>("/projects", { method: "POST", body })).data;
}

export async function getProject(projectId: string): Promise<Project> {
  return (await apiRequest<Project>(`/projects/${projectId}`)).data;
}

export async function archiveProject(projectId: string): Promise<Project> {
  return (await apiRequest<Project>(`/projects/${projectId}/archive`, { method: "POST" })).data;
}

export async function restoreProject(projectId: string): Promise<Project> {
  return (await apiRequest<Project>(`/projects/${projectId}/restore`, { method: "POST" })).data;
}

export async function deleteProject(projectId: string): Promise<Project> {
  return (await apiRequest<Project>(`/projects/${projectId}`, { method: "DELETE" })).data;
}

export async function listProjectDesignSessions(projectId: string): Promise<DesignSession[]> {
  return (await apiRequest<DesignSession[]>(`/projects/${projectId}/design-sessions`)).data;
}

export async function createDesignSession(
  projectId: string,
  body: {
    title: string;
    problemStatement: string;
  }
): Promise<DesignSession> {
  return (
    await apiRequest<DesignSession>(`/projects/${projectId}/design-sessions`, {
      method: "POST",
      body
    })
  ).data;
}

export async function getDesignSession(sessionId: string): Promise<DesignSession> {
  return (await apiRequest<DesignSession>(`/design-sessions/${sessionId}`)).data;
}

export async function analyzeRequirements(sessionId: string): Promise<RequirementsResponse> {
  return (
    await apiRequest<RequirementsResponse>(`/design-sessions/${sessionId}/analyze-requirements`, {
      method: "POST"
    })
  ).data;
}

export async function getRequirements(sessionId: string): Promise<RequirementsResponse> {
  return (await apiRequest<RequirementsResponse>(`/design-sessions/${sessionId}/requirements`))
    .data;
}

export async function submitClarifications(
  sessionId: string,
  answers: Array<{ questionId: string; answer: string }>
): Promise<RequirementsResponse> {
  return (
    await apiRequest<RequirementsResponse>(`/design-sessions/${sessionId}/clarifications`, {
      method: "POST",
      body: { answers }
    })
  ).data;
}

export async function calculateCapacity(
  sessionId: string,
  overrides: Partial<CapacityCalculation["inputs"]>
): Promise<CapacityResponse> {
  return (
    await apiRequest<CapacityResponse>(`/design-sessions/${sessionId}/calculate-capacity`, {
      method: "POST",
      body: overrides
    })
  ).data;
}

export async function getCapacity(sessionId: string): Promise<CapacityResponse> {
  return (await apiRequest<CapacityResponse>(`/design-sessions/${sessionId}/capacity`)).data;
}

export async function generateDesign(sessionId: string): Promise<GeneratedDesignResponse> {
  return (
    await apiRequest<GeneratedDesignResponse>(`/design-sessions/${sessionId}/generate-design`, {
      method: "POST"
    })
  ).data;
}

export async function getGeneratedDesign(sessionId: string): Promise<GeneratedDesignResponse> {
  return (await apiRequest<GeneratedDesignResponse>(`/design-sessions/${sessionId}/design`)).data;
}

export async function generateDiagram(sessionId: string): Promise<DiagramResponse> {
  return (
    await apiRequest<DiagramResponse>(`/design-sessions/${sessionId}/generate-diagram`, {
      method: "POST"
    })
  ).data;
}

export async function getDiagram(sessionId: string): Promise<DiagramResponse> {
  return (await apiRequest<DiagramResponse>(`/design-sessions/${sessionId}/diagram`)).data;
}

export async function validateDesign(sessionId: string): Promise<ValidationResponse> {
  return (
    await apiRequest<ValidationResponse>(`/design-sessions/${sessionId}/validate-design`, {
      method: "POST"
    })
  ).data;
}

export async function getValidation(sessionId: string): Promise<ValidationResponse> {
  return (await apiRequest<ValidationResponse>(`/design-sessions/${sessionId}/validation`)).data;
}
