import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import {
  DSA_NOTE_DRAWING_VERSION,
  MAX_DSA_NOTE_PAGES,
  MAX_DSA_NOTE_POINTS,
  MAX_DSA_NOTE_POINTS_PER_STROKE,
  MAX_DSA_NOTE_STROKES
} from "@/lib/dsa/dsa-note-drawing";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

const pointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  pressure: z.number().finite().min(0).max(1)
});

const drawingSchema = z
  .object({
    version: z.literal(DSA_NOTE_DRAWING_VERSION),
    pages: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          strokes: z.array(
            z.object({
              id: z.string().min(1).max(80),
              color: z.string().regex(/^#[0-9a-f]{6}$/i),
              width: z.number().finite().min(1).max(24),
              opacity: z.number().finite().min(0.05).max(1),
              points: z.array(pointSchema).min(1).max(MAX_DSA_NOTE_POINTS_PER_STROKE)
            })
          )
        })
      )
      .min(1)
      .max(MAX_DSA_NOTE_PAGES)
  })
  .superRefine((drawing, context) => {
    const strokes = drawing.pages.reduce((total, page) => total + page.strokes.length, 0);
    const points = drawing.pages.reduce(
      (pageTotal, page) =>
        pageTotal +
        page.strokes.reduce((strokeTotal, stroke) => strokeTotal + stroke.points.length, 0),
      0
    );
    if (strokes > MAX_DSA_NOTE_STROKES) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: `Drawing cannot contain more than ${MAX_DSA_NOTE_STROKES} strokes`
      });
    }
    if (points > MAX_DSA_NOTE_POINTS) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: `Drawing cannot contain more than ${MAX_DSA_NOTE_POINTS} points`
      });
    }
  });

const contentSchema = z.object({
  content: z.string().max(20_000),
  drawing: drawingSchema.optional()
});

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const { slug } = await context.params;
    assertQuestion(slug);
    return apiSuccess(
      await getAppContainer().dsaNotesService.get(authenticatedOwnerId(userId), slug)
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const { slug } = await context.params;
    assertQuestion(slug);
    const parsed = contentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Note content is invalid", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    return apiSuccess(
      await getAppContainer().dsaNotesService.save(
        authenticatedOwnerId(userId),
        slug,
        parsed.data.content,
        parsed.data.drawing
      )
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function assertQuestion(slug: string): void {
  if (!slug || slug.length > 140 || !findQuestion(slug)) {
    throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");
  }
}
