import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { personaById } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { LEVELS, ROLES } from "@/server/interview/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("OnboardingComplete");

const stringList = (max: number) => z.array(z.string().trim().min(1).max(240)).max(max);

const storySchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  situation: z.string().trim().max(1_500),
  action: z.string().trim().max(1_500),
  outcome: z.string().trim().max(1_500),
  skills: stringList(10)
});

const experienceSchema = z.object({
  organization: z.string().trim().max(180),
  role: z.string().trim().max(180),
  period: z.string().trim().max(120),
  location: z.string().trim().max(120),
  summary: z.string().trim().max(1_500),
  achievements: stringList(8),
  skills: stringList(12)
});

const educationSchema = z.object({
  institution: z.string().trim().max(180),
  credential: z.string().trim().max(180),
  field: z.string().trim().max(180),
  period: z.string().trim().max(120)
});

const projectSchema = z.object({
  name: z.string().trim().max(180),
  summary: z.string().trim().max(1_500),
  outcome: z.string().trim().max(1_500),
  skills: stringList(12)
});

const practiceQuestionSchema = z.object({
  id: z.string().min(1).max(120),
  competency: z.string().trim().max(160),
  prompt: z.string().trim().min(1).max(1_000),
  evidenceAnchor: z.string().trim().max(500)
});

const roadmapItemSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  rationale: z.string().trim().max(700),
  actions: stringList(8)
});

export const resumeFileSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1).max(200),
  contentFingerprint: z
    .string()
    .regex(/^sha256-[a-f0-9]{64}$/)
    .optional()
});

export const resumeExtractionSchema = z.object({
  fullName: z.string().trim().max(160),
  headline: z.string().trim().min(1).max(240),
  context: z.string().trim().min(1).max(3_000),
  skills: stringList(32),
  focusAreas: stringList(12),
  stories: z.array(storySchema).max(16),
  experience: z.array(experienceSchema).max(20),
  education: z.array(educationSchema).max(12),
  certifications: stringList(16).default([]),
  projects: z.array(projectSchema).max(20),
  achievements: stringList(16),
  practiceQuestions: z.array(practiceQuestionSchema).max(40),
  roadmap: z.array(roadmapItemSchema).max(24),
  confidence: z.number().min(0).max(100),
  warnings: stringList(10),
  document: z.object({
    format: z.enum(["pdf", "docx"]),
    pageCount: z.number().int().min(1).max(80),
    pageCountEstimated: z.boolean(),
    sections: stringList(24)
  }),
  evidence: z.object({
    dateRanges: z.number().int().min(0).max(500),
    achievementLines: z.number().int().min(0).max(1_000),
    quantifiedAchievements: z.number().int().min(0).max(1_000),
    experienceEntries: z.number().int().min(0).max(200),
    projectEntries: z.number().int().min(0).max(200),
    educationEntries: z.number().int().min(0).max(100)
  })
});

const completeSchema = z.object({
  targetRole: z.enum(ROLES),
  level: z.enum(LEVELS),
  /**
   * The teacher chosen on the first onboarding step. Validated against the
   * registry rather than stored as free text, so an unknown id cannot be
   * written to the profile and later fail to resolve to a model.
   */
  teacherId: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((id) => personaById(id)?.id ?? null),
  resumeFile: resumeFileSchema,
  extraction: resumeExtractionSchema
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const body = completeSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new ApiRouteError(
        400,
        "ONBOARDING_COMPLETE_INVALID",
        "Trailgrad could not finish onboarding from this resume preview."
      );
    }

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    const existing = await app.profileService.get(ownerId);
    if (existing.onboardingCompletedAt) {
      throw new ApiRouteError(
        409,
        "ONBOARDING_ALREADY_COMPLETED",
        "Use the resume update review to replace an existing resume."
      );
    }
    const { targetRole, level, teacherId, extraction, resumeFile } = body.data;
    const profile = await app.profileService.completeOnboarding(ownerId, {
      targetRole,
      level,
      teacherId,
      headline: extraction.headline,
      context: extraction.context,
      focusAreas: extraction.focusAreas,
      stories: extraction.stories,
      resume: {
        fileName: resumeFile.fileName,
        mimeType: resumeFile.mimeType,
        contentFingerprint: resumeFile.contentFingerprint,
        confidence: extraction.confidence,
        fullName: extraction.fullName,
        skills: extraction.skills,
        warnings: extraction.warnings,
        experience: extraction.experience,
        education: extraction.education,
        certifications: extraction.certifications,
        projects: extraction.projects,
        achievements: extraction.achievements,
        practiceQuestions: extraction.practiceQuestions,
        roadmap: extraction.roadmap,
        document: extraction.document,
        evidence: extraction.evidence
      }
    });
    const frontendRoadmap =
      targetRole === "fullstack"
        ? await app.frontendRoadmapService.ensureFrontendRoadmap(ownerId)
        : null;

    logger.log(
      JSON.stringify({
        event: "onboarding.completed",
        ownerId,
        targetRole,
        level,
        frontendRoadmapId: frontendRoadmap?.roadmapId ?? null
      })
    );

    // Welcome delivery is durable and idempotent, but it must never hold the
    // onboarding response hostage to Clerk or the email provider.
    after(() =>
      app.teacherNotificationService
        .welcome({
          ownerId,
          teacherId,
          candidateName: extraction.fullName,
          targetRole,
          focusAreas: extraction.focusAreas
        })
        .catch((error) =>
          logger.error(
            JSON.stringify({
              event: "teacher.welcome.failed",
              ownerId,
              reason: error instanceof Error ? error.message : String(error)
            })
          )
        )
    );

    return apiSuccess({
      profile,
      resumeFile,
      extraction,
      frontendRoadmap
    });
  } catch (error) {
    if (!(error instanceof ApiRouteError)) {
      logger.error(
        JSON.stringify({
          event: "onboarding.complete.failed",
          reason: error instanceof Error ? error.message : String(error)
        }),
        error
      );
    }
    return apiError(error, request.nextUrl.pathname);
  }
}
