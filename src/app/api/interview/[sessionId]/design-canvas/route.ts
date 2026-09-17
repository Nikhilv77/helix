import type { NextRequest } from "next/server";
import { z } from "zod";
import { systemDesignCanvasDocumentSchema } from "@/features/interviews/domain/system-design-canvas";
import { authorizeInterviewSession } from "@/features/interviews/server/session-access";
import { DesignCanvasVersionConflictError } from "@/features/interviews/server/session-store";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> | { sessionId: string } };

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  document: systemDesignCanvasDocumentSchema
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const sessionId = requireUuid((await context.params).sessionId);
    const app = getAppContainer();
    const access = await authorizeInterviewSession(request, app.config, sessionId, "read");
    if (access.kind !== "owner") {
      throw new ApiRouteError(
        403,
        "DESIGN_CANVAS_OWNER_REQUIRED",
        "Only the interview owner can access this design canvas."
      );
    }
    return apiSuccess(await app.interviewService.getSystemDesignCanvas(access.ownerId, sessionId));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const sessionId = requireUuid((await context.params).sessionId);
    const app = getAppContainer();
    const access = await authorizeInterviewSession(request, app.config, sessionId, "read");
    if (access.kind !== "owner") {
      throw new ApiRouteError(
        403,
        "DESIGN_CANVAS_OWNER_REQUIRED",
        "Only the interview owner can update this design canvas."
      );
    }
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.practiceState, sessionId);
    const parsed = saveSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "The design canvas is invalid.", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    try {
      return apiSuccess(
        await app.interviewService.saveSystemDesignCanvas(
          access.ownerId,
          sessionId,
          parsed.data.document,
          parsed.data.expectedRevision
        )
      );
    } catch (error) {
      if (error instanceof DesignCanvasVersionConflictError) {
        throw new ApiRouteError(
          409,
          "DESIGN_CANVAS_VERSION_CONFLICT",
          "This diagram changed in another tab. The newer version was preserved.",
          { current: error.current }
        );
      }
      throw error;
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function requireUuid(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
    messages: ["sessionId must be a UUID"]
  });
}
