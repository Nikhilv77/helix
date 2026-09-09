import type { NextRequest } from "next/server";

import { dispatch, type RouteContext } from "./dispatcher";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest, context: RouteContext) {
  return dispatch(request, context, "GET");
}

export function POST(request: NextRequest, context: RouteContext) {
  return dispatch(request, context, "POST");
}

export function PUT(request: NextRequest, context: RouteContext) {
  return dispatch(request, context, "PUT");
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return dispatch(request, context, "PATCH");
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch(request, context, "DELETE");
}
