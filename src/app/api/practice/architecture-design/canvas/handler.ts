import type { NextRequest } from "next/server";
import { z } from "zod";
import { systemDesignCanvasDocumentSchema } from "@/features/interviews/domain/system-design-canvas";
import { ArchitecturePracticeCanvasConflictError } from "@/features/practice/architecture-design/server/canvas.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, architectureDesignMutationOwner, parseArchitectureDesignJson } from "../_shared";

const blockIdSchema = z.string().uuid();
const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  document: systemDesignCanvasDocumentSchema
});

export async function GET(request: NextRequest, blockId: string) {
  try {
    const { ownerId, app } = await architectureDesignMutationOwner();
    return apiSuccess(
      await app.architectureDesign.canvas.get(ownerId, blockIdSchema.parse(blockId))
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest, blockId: string) {
  try {
    const { ownerId, app } = await architectureDesignMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseArchitectureDesignJson(request, saveSchema);
    try {
      return apiSuccess(
        await app.architectureDesign.canvas.save(
          ownerId,
          blockIdSchema.parse(blockId),
          input.document,
          input.expectedRevision
        )
      );
    } catch (error) {
      if (error instanceof ArchitecturePracticeCanvasConflictError) {
        throw new ApiRouteError(
          409,
          "ARCHITECTURE_CANVAS_VERSION_CONFLICT",
          "This diagram changed in another tab. Your unsaved edits remain in this tab.",
          { current: error.current }
        );
      }
      throw error;
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
