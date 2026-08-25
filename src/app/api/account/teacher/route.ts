import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { personaById } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";

export const dynamic = "force-dynamic";

const teacherSchema = z.object({
  teacherId: z
    .string()
    .trim()
    .max(60)
    .refine((value) => personaById(value) !== null, "Teacher is unavailable")
});

export async function PUT(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = teacherSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Teacher selection is invalid");
    }

    const teacherId = await getAppContainer().profileService.saveTeacher(
      ownerId,
      parsed.data.teacherId
    );
    return apiSuccess({ teacherId });
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
