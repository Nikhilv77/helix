import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

const contentSchema = z.object({
  content: z.string().max(20_000)
});

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const { slug } = await context.params;
    assertQuestion(slug);
    return apiSuccess(await getAppContainer().dsaNotesService.get(authenticatedOwnerId(userId), slug));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const { slug } = await context.params;
    assertQuestion(slug);
    const parsed = contentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Note content is invalid", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    return apiSuccess(
      await getAppContainer().dsaNotesService.save(
        authenticatedOwnerId(userId),
        slug,
        parsed.data.content
      )
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function assertQuestion(slug: string): void {
  if (!slug || slug.length > 140 || !findQuestion(slug)) {
    throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");
  }
}
