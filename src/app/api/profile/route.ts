import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { LEVELS, ROLES } from "@/server/interview/types";

export const dynamic = "force-dynamic";

const storySchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(100),
  situation: z.string().trim().max(600),
  action: z.string().trim().max(800),
  outcome: z.string().trim().max(600),
  skills: z.array(z.string().trim().min(1).max(40)).max(6)
});

const profileSchema = z.object({
  targetRole: z.enum(ROLES).nullable(),
  level: z.enum(LEVELS).nullable(),
  targetCompany: z.string().trim().max(100),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  headline: z.string().trim().max(140),
  context: z.string().trim().max(1600),
  focusAreas: z.array(z.string().trim().min(1).max(40)).max(8),
  stories: z.array(storySchema).max(8)
});

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    return apiSuccess(await getAppContainer().profileService.get(ownerId));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Profile validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    return apiSuccess(await getAppContainer().profileService.save(ownerId, parsed.data));
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
