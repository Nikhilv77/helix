import { ProjectStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { requireUserId } from "@/server/auth/request-auth";
import { getAppContainer } from "@/server/app-container";
import type { SortOrder } from "@/server/common/dto/pagination-query.dto";
import type { ProjectSortField } from "@/server/projects/dto/list-projects-query.dto";
import type { CreateProjectDto } from "@/server/projects/dto/create-project.dto";
import type { UpdateProjectDto } from "@/server/projects/dto/update-project.dto";
import type { CreateDesignSessionDto } from "@/server/design-sessions/dto/create-design-session.dto";
import type { UpdateDesignSessionDto } from "@/server/design-sessions/dto/update-design-session.dto";
import type { SubmitClarificationsDto } from "@/server/design-sessions/dto/submit-clarifications.dto";
import type { CreateKnowledgeDocumentDto } from "@/server/knowledge/dto/create-knowledge-document.dto";
import type { RetrievalSearchRequest } from "@/server/retrieval/retrieval.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

export async function GET(request: NextRequest, context: RouteContext) {
  return handleRequest("GET", request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRequest("POST", request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRequest("PATCH", request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRequest("DELETE", request, context);
}

async function handleRequest(method: string, request: NextRequest, context: RouteContext) {
  const path = await getPath(context);

  try {
    const result = await dispatch(method, request, path);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function dispatch(method: string, request: NextRequest, path: string[]) {
  const app = getAppContainer();

  if (method === "GET" && matches(path, "health")) {
    const health = await app.healthService.getHealth();
    if (health.status === "unhealthy") {
      throw new ApiRouteError(503, "SERVICE_UNAVAILABLE", "Service unavailable", {
        health
      });
    }
    return health;
  }

  if (matches(path, "projects")) {
    const userId = await requireUserId(request, app.config);

    if (method === "GET") {
      return app.projectsService.listProjects(parseProjectListQuery(request), userId);
    }

    if (method === "POST") {
      return app.projectsService.createProject(await readJsonAs<CreateProjectDto>(request), userId);
    }
  }

  if (path[0] === "projects" && path[1] && path.length === 2) {
    const userId = await requireUserId(request, app.config);
    const projectId = requireUuid(path[1], "projectId");

    if (method === "GET") return app.projectsService.getProject(projectId, userId);
    if (method === "PATCH") return app.projectsService.updateProject(projectId, await readJsonAs<UpdateProjectDto>(request), userId);
    if (method === "DELETE") return app.projectsService.deleteProject(projectId, userId);
  }

  if (path[0] === "projects" && path[1] && path.length === 3) {
    const userId = await requireUserId(request, app.config);
    const projectId = requireUuid(path[1], "projectId");

    if (method === "POST" && path[2] === "archive") {
      return app.projectsService.archiveProject(projectId, userId);
    }

    if (method === "POST" && path[2] === "restore") {
      return app.projectsService.restoreProject(projectId, userId);
    }
  }

  if (path[0] === "projects" && path[1] && path[2] === "design-sessions" && path.length === 3) {
    const userId = await requireUserId(request, app.config);
    const projectId = requireUuid(path[1], "projectId");

    if (method === "GET") {
      return app.designSessionsService.listProjectDesignSessions(projectId, userId);
    }

    if (method === "POST") {
      return app.designSessionsService.createDesignSession(projectId, await readJsonAs<CreateDesignSessionDto>(request), userId);
    }
  }

  if (path[0] === "design-sessions" && path[1]) {
    const userId = await requireUserId(request, app.config);
    const sessionId = requireUuid(path[1], "designSessionId");

    if (path.length === 2) {
      if (method === "GET") return app.designSessionsService.getDesignSession(sessionId, userId);
      if (method === "PATCH") return app.designSessionsService.updateDesignSession(sessionId, await readJsonAs<UpdateDesignSessionDto>(request), userId);
      if (method === "DELETE") return app.designSessionsService.deleteDesignSession(sessionId, userId);
    }

    if (method === "POST" && path[2] === "analyze-requirements") {
      return app.designSessionsService.analyzeRequirements(sessionId, userId);
    }
    if (method === "GET" && path[2] === "requirements") {
      return app.designSessionsService.getRequirements(sessionId, userId);
    }
    if (method === "POST" && path[2] === "clarifications") {
      return app.designSessionsService.submitClarifications(sessionId, await readJsonAs<SubmitClarificationsDto>(request), userId);
    }
    if (method === "POST" && path[2] === "calculate-capacity") {
      return app.designSessionsService.calculateCapacity(sessionId, await readJson(request), userId);
    }
    if (method === "GET" && path[2] === "capacity") {
      return app.designSessionsService.getCapacity(sessionId, userId);
    }
    if (method === "POST" && path[2] === "generate-design") {
      return app.designSessionsService.generateDesign(sessionId, userId);
    }
    if (method === "GET" && path[2] === "design") {
      return app.designSessionsService.getDesign(sessionId, userId);
    }
    if (method === "POST" && path[2] === "generate-diagram") {
      return app.designSessionDiagramsService.generateDiagram(sessionId, userId);
    }
    if (method === "GET" && path[2] === "diagram") {
      return app.designSessionDiagramsService.getDiagram(sessionId, userId);
    }
    if (method === "POST" && path[2] === "validate-design") {
      return app.designValidationService.validateDesign(sessionId, userId);
    }
    if (method === "GET" && path[2] === "validation") {
      return app.designValidationService.getValidation(sessionId, userId);
    }
  }

  if (path[0] === "knowledge" && path[1] === "documents") {
    if (path.length === 2) {
      if (method === "GET") return app.knowledgeService.listDocuments();
      if (method === "POST") return app.knowledgeService.createDocument(await readJsonAs<CreateKnowledgeDocumentDto>(request));
    }

    if (path[2]) {
      const documentId = requireUuid(path[2], "documentId");
      if (method === "GET" && path.length === 3) return app.knowledgeService.getDocument(documentId);
      if (method === "DELETE" && path.length === 3) return app.knowledgeService.deleteDocument(documentId);
      if (method === "POST" && path[3] === "embed") return app.embeddingsService.embedDocument(documentId);
    }
  }

  if (path[0] === "knowledge" && path[1] === "embeddings") {
    if (method === "GET" && path[2] === "status") return app.embeddingsService.getStatus();
    if (method === "POST" && path[2] === "rebuild") return app.embeddingsService.rebuildEmbeddings();
  }

  if (method === "POST" && matches(path, "retrieval", "search")) {
    return app.retrievalService.search(await readJsonAs<RetrievalSearchRequest>(request));
  }

  if (method === "POST" && matches(path, "tools", "capacity-calculator")) {
    return app.toolsService.calculateCapacity(await readJson(request));
  }

  throw new ApiRouteError(404, "NOT_FOUND", "Route not found", {
    method,
    path: `/${path.join("/")}`
  });
}

async function getPath(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return params.path ?? [];
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readJsonAs<T>(request: NextRequest): Promise<T> {
  return (await readJson(request)) as T;
}

function parseProjectListQuery(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = toPositiveInt(searchParams.get("page"), 1);
  const limit = Math.min(toPositiveInt(searchParams.get("limit"), 20), 100);
  const status = parseProjectStatus(searchParams.get("status"));
  const sortBy = parseProjectSortField(searchParams.get("sortBy"));
  const sortOrder: SortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const search = searchParams.get("search")?.trim() || undefined;

  return {
    page,
    limit,
    status,
    search,
    sortBy,
    sortOrder
  };
}

function parseProjectStatus(value: string | null): ProjectStatus | undefined {
  if (!value) return undefined;
  return Object.values(ProjectStatus).includes(value as ProjectStatus) ? (value as ProjectStatus) : undefined;
}

function parseProjectSortField(value: string | null): ProjectSortField {
  return value === "updatedAt" || value === "name" || value === "status" ? value : "createdAt";
}

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requireUuid(value: string, field: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }

  throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
    messages: [`${field} must be a UUID`]
  });
}

function matches(path: string[], ...segments: string[]): boolean {
  return path.length === segments.length && segments.every((segment, index) => path[index] === segment);
}
