import type { NextRequest } from "next/server";

import { GET as activeGet } from "../active/handler";
import { GET as historyGet } from "../history/handler";
import { GET as inboxGet } from "../inbox/handler";
import { GET as overviewGet } from "../overview/handler";
import { GET as reportsGet, POST as reportsPost } from "../reports/handler";
import { DELETE as requestDelete, GET as requestGet, POST as requestPost } from "../request/handler";
import { POST as requestIdPost } from "../request/[id]/handler";
import { GET as roomGet, PUT as roomPut } from "../room/[id]/handler";
import { POST as safetyPost } from "../safety/handler";
import { GET as sessionGet, POST as sessionPost } from "../session/[id]/handler";
import { GET as statusGet } from "../status/handler";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError } from "@/server/http/api-response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };
type IdContext = { params: Promise<{ id: string }> };
type HelpHandler = (request: NextRequest, context: IdContext) => Promise<Response>;

const withoutId =
  (handler: (request: NextRequest) => Promise<Response>): HelpHandler =>
  (request) =>
    handler(request);

const handlers: Readonly<Record<string, Readonly<Record<string, HelpHandler>>>> = {
  GET: {
    active: withoutId(activeGet),
    history: withoutId(historyGet),
    inbox: withoutId(inboxGet),
    overview: withoutId(overviewGet),
    reports: withoutId(reportsGet),
    request: withoutId(requestGet),
    "room/:id": roomGet,
    "session/:id": sessionGet,
    status: withoutId(statusGet)
  },
  POST: {
    reports: withoutId(reportsPost),
    request: withoutId(requestPost),
    "request/:id": requestIdPost,
    safety: withoutId(safetyPost),
    "session/:id": sessionPost
  },
  PUT: {
    "room/:id": roomPut
  },
  DELETE: {
    request: withoutId(requestDelete)
  }
};

export function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const resource = path[0] ?? "";
  const id = path[1] ?? "";
  const hasId = path.length === 2 && ["request", "room", "session"].includes(resource);
  const key = hasId ? `${resource}/:id` : path.join("/");
  const handler = handlers[method]?.[key];

  if (!handler) {
    return apiError(
      new ApiRouteError(404, "NOT_FOUND", "Help route not found", {
        method,
        path: `/${path.join("/")}`
      }),
      request.nextUrl.pathname
    );
  }

  return handler(request, { params: Promise.resolve({ id: hasId ? id : "" }) });
}
