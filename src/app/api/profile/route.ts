import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isProfileAvatarSource } from "@/features/profile/domain/profile-images";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The Profile page edits only its cover and avatar. Everything else on the
 * profile (role, level, target, headline, summary, stories) is set by
 * onboarding, preparation and resume confirmation, which also rebuild the
 * practice plan; accepting it here would let a request change the plan's
 * inputs without that work. Other keys in the body are ignored.
 */
const profileImagesSchema = z
  .object({
    coverImage: z
      .enum([
        "/images/profile/covers/cover-1.png",
        "/images/profile/covers/cover-2.png",
        "/images/profile/covers/cover-3.png",
        "/images/profile/covers/cover-4.png",
        "/images/profile/covers/cover-5.png",
        "/images/profile/covers/cover-6.png",
        "/images/profile/covers/cover-7.png",
        "/images/profile/covers/cover-8.png"
      ])
      .nullable(),
    profileImage: z
      .string()
      .refine(isProfileAvatarSource, "Choose one of the available profile images")
      .nullable()
  })
  .partial();

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
    const parsed = profileImagesSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Profile validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    // Images feed no practice or analytics projection, so nothing is rebuilt.
    return apiSuccess(await getAppContainer().profileService.saveImages(ownerId, parsed.data));
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

/** Marks the one-time Overview tour as heard; sent once its audio starts. */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const body = (await request.json().catch(() => null)) as { overviewIntroduced?: unknown } | null;
    if (body?.overviewIntroduced !== true) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Only overviewIntroduced can be updated here.");
    }
    await getAppContainer().profileService.markOverviewIntroduced(authenticatedOwnerId(userId));
    return apiSuccess({ overviewIntroduced: true });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
