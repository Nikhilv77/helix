import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import { presentHelpInboxRequest } from "@/server/help/help-inbox-presenter";
import { HelpRequestError, HelpRequestStatus } from "@/server/help/help-request.types";
import { MAX_COLLABORATION_STATE_BYTES } from "@/server/help/help-session.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const saveSchema = z.object({ state: z.string().min(1).max(750_000) }).strict();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await requireOwner();
    const id = await requestId(context);
    const app = getAppContainer();
    const helpRequest = await app.helpRequestService.byId(id);
    const seat = participantSeat(helpRequest, ownerId);
    if (!seat) throw new ApiRouteError(403, "HELP_ROOM_FORBIDDEN", "This room is private");
    if (helpRequest.status !== HelpRequestStatus.CLAIMED) {
      throw new ApiRouteError(409, "HELP_ROOM_CLOSED", "This help room is no longer active");
    }

    const session = await app.helpSessionService.forRequest(id);
    const participants = await app.helpHistoryService.participants(
      [helpRequest.learnerId, helpRequest.helperId].filter((value): value is string =>
        Boolean(value)
      )
    );
    const learner = participants.get(helpRequest.learnerId) ?? null;
    const helper = helpRequest.helperId ? (participants.get(helpRequest.helperId) ?? null) : null;
    const presented = presentHelpInboxRequest(helpRequest, true, learner);
    return apiSuccess({
      requestId: id,
      seat,
      peer: seat === "learner" ? helper : learner,
      slug: presented.slug,
      title: presented.title,
      questionPrompt: presented.questionPrompt,
      language: presented.language,
      capturedWorkspace: presented.capturedWorkspace,
      collaborationState: session?.collaborationState
        ? Buffer.from(session.collaborationState).toString("base64")
        : null
    });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await requireOwner();
    const id = await requestId(context);
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiRouteError(400, "BAD_REQUEST", "Room state is invalid");

    let state: Buffer;
    try {
      state = Buffer.from(parsed.data.state, "base64");
    } catch {
      throw new ApiRouteError(400, "BAD_REQUEST", "Room state is invalid");
    }
    if (state.byteLength === 0 || state.byteLength > MAX_COLLABORATION_STATE_BYTES) {
      throw new ApiRouteError(413, "HELP_ROOM_STATE_TOO_LARGE", "Room state is too large");
    }

    const saved = await getAppContainer().helpSessionService.saveCollaborationState(
      id,
      ownerId,
      state
    );
    return apiSuccess({ saved });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}

async function requestId(context: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    throw new ApiRouteError(400, "BAD_REQUEST", "A valid room id is required");
  }
  return id;
}

function participantSeat(
  request: { learnerId: string; helperId: string | null },
  ownerId: string
): "learner" | "helper" | null {
  if (request.learnerId === ownerId) return "learner";
  if (request.helperId === ownerId) return "helper";
  return null;
}

function translate(error: unknown): unknown {
  if (!(error instanceof HelpRequestError)) return error;
  if (error.reason === "NOT_FOUND") {
    return new ApiRouteError(404, "HELP_NOT_FOUND", "That help room does not exist");
  }
  if (error.reason === "NOT_THE_HELPER" || error.reason === "NOT_THE_LEARNER") {
    return new ApiRouteError(403, "HELP_ROOM_FORBIDDEN", "This room is private");
  }
  return new ApiRouteError(409, `HELP_${error.reason}`, "That room cannot be changed now");
}
