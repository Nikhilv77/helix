import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { WORKSPACE_ACCENTS } from "@/lib/workspace/accent";

export const dynamic = "force-dynamic";

const accentSchema = z.object({
  accent: z.enum(WORKSPACE_ACCENTS)
});

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const accent = await getAppContainer().profileService.workspaceAccent(ownerId);
    return apiSuccess({ accent });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = accentSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Accent preference is invalid");
    }

    const accent = await getAppContainer().profileService.saveWorkspaceAccent(
      ownerId,
      parsed.data.accent
    );
    return apiSuccess({ accent });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
