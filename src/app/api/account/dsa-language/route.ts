import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

const preferenceSchema = z.object({
  language: z.enum(["javascript", "python", "cpp", "java"])
});

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Programming language is invalid");
    }
    const language = await getAppContainer().profileService.saveDsaEditorLanguage(
      authenticatedOwnerId(userId),
      parsed.data.language
    );
    return apiSuccess({ language });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
