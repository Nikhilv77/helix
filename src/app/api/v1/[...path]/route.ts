import type { NextRequest } from "next/server";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getAppContainer } from "@/server/app-container";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = params.path ?? [];

  try {
    const app = getAppContainer();

    if (matches(path, "health")) {
      const health = await app.healthService.getHealth();
      if (health.status === "unhealthy") {
        throw new ApiRouteError(503, "SERVICE_UNAVAILABLE", "Service unavailable", { health });
      }
      return apiSuccess(health);
    }

    throw new ApiRouteError(404, "NOT_FOUND", "Route not found", {
      method: "GET",
      path: `/${path.join("/")}`
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function matches(path: string[], ...segments: string[]): boolean {
  return path.length === segments.length && segments.every((segment, i) => path[i] === segment);
}
