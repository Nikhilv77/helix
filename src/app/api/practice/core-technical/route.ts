import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { coreTechnicalOwner } from "./_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { ownerId, app } = await coreTechnicalOwner();
    return apiSuccess({ block: await app.coreTechnicalPracticeService.current(ownerId) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
