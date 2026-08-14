import { auth, clerkClient, reverificationErrorResponse } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

const CLERK_COOKIE_NAMES = new Set(["__session", "__client", "__clerk_db_jwt"]);

function isClerkCookie(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    CLERK_COOKIE_NAMES.has(name) ||
    normalized.startsWith("__clerk") ||
    normalized.startsWith("clerk") ||
    normalized.includes("_clerk")
  );
}

export async function DELETE(request: NextRequest) {
  try {
    const authObject = await auth();
    const { userId } = authObject;
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const reverification = { level: "first_factor", afterMinutes: 1 } as const;
    const factorVerificationAge = authObject.factorVerificationAge;
    const firstFactorAge = factorVerificationAge?.[0];
    if (
      !factorVerificationAge ||
      firstFactorAge === undefined ||
      firstFactorAge === -1 ||
      firstFactorAge >= reverification.afterMinutes
    ) {
      return reverificationErrorResponse(reverification);
    }

    await getAppContainer().profileService.deleteAccountData(authenticatedOwnerId(userId));

    const client = await clerkClient();
    await client.users.deleteUser(userId);

    const response = apiSuccess({ deleted: true });
    response.headers.set("Clear-Site-Data", '"cookies", "storage"');
    response.headers.set("Cache-Control", "no-store");

    for (const cookie of request.cookies.getAll()) {
      if (!isClerkCookie(cookie.name)) continue;
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/"
      });
    }

    return response;
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
