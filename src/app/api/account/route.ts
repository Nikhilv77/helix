import { auth, clerkClient, reverificationErrorResponse } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

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

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
