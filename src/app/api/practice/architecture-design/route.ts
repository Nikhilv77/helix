import type { NextRequest } from "next/server";
import { apiSuccess } from "@/server/http/api-response";
import { apiError, architectureDesignOwner } from "./_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { ownerId, app } = await architectureDesignOwner();
    return apiSuccess({ block: await app.architectureDesign.practice.current(ownerId) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
