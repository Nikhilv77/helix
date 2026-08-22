import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { LEVELS, ROLES } from "@/server/interview/types";
import {
  extractResumeDocument,
  inspectResumeDocument,
  MIN_RESUME_TEXT_CHARACTERS,
  ResumeDocumentError,
  withVisualResumeText
} from "@/server/onboarding/resume/document";
import {
  groundResumeEvidence,
  hasGroundedEvidence,
  verifyResumeDocument
} from "@/server/onboarding/resume/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_FILE_SIZE = 1_000;
const MAX_FILE_SIZE = 6 * 1024 * 1024;

/**
 * The platform kills the request at maxDuration. Each AI call gets an explicit
 * slice of that budget so a slow provider surfaces as a clear error instead of
 * a truncated response with no body for the client to read.
 */
const ROUTE_BUDGET_MS = 52_000;
const VISUAL_EXTRACT_BUDGET_MS = 20_000;
const RESERVED_FOR_RESPONSE_MS = 3_000;

/**
 * Two model calls and a multi-megabyte upload per request make this the most
 * expensive endpoint in the app. The window is per instance, which is a floor
 * rather than a guarantee on serverless, but it stops a single tab from looping
 * uploads.
 */
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UPLOADS_PER_WINDOW = 6;
const uploadHistory = new Map<string, number[]>();

const logger = new Logger("ResumeUpload");

const selectionSchema = z.object({
  targetRole: z.enum(ROLES),
  level: z.enum(LEVELS)
});

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const remainingMs = () => ROUTE_BUDGET_MS - (Date.now() - startedAt);

  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    enforceUploadRate(ownerId);

    const form = await request.formData();
    const file = form.get("resume");
    const selection = selectionSchema.safeParse({
      targetRole: form.get("targetRole"),
      level: form.get("level")
    });

    if (!selection.success) {
      throw new ApiRouteError(
        400,
        "ONBOARDING_SELECTION_REQUIRED",
        "Choose a role and experience level first."
      );
    }
    if (!(file instanceof File)) {
      throw new ApiRouteError(400, "RESUME_REQUIRED", "Choose a resume to continue.");
    }
    if (file.size < MIN_FILE_SIZE || file.size > MAX_FILE_SIZE) {
      throw new ApiRouteError(
        400,
        "RESUME_SIZE_INVALID",
        "Resume files must be between 1 KB and 6 MB."
      );
    }

    const safeName = basename(file.name)
      .replace(/[^a-zA-Z0-9._ -]/g, "")
      .slice(0, 120);
    const buffer = Buffer.from(await file.arrayBuffer());
    let document = await extractResumeDocument({
      fileName: safeName,
      mimeType: file.type,
      buffer
    });
    const resumeService = getAppContainer().resumeService;

    if (document.format === "pdf" && document.text.length < MIN_RESUME_TEXT_CHARACTERS) {
      try {
        const visualText = await resumeService.readVisualPdf({
          buffer,
          pageCount: document.pageCount,
          timeoutMs: Math.max(5_000, Math.min(VISUAL_EXTRACT_BUDGET_MS, remainingMs()))
        });
        document = withVisualResumeText(document, visualText);
      } catch (error) {
        if (error instanceof ResumeDocumentError) throw error;
        logger.error(
          JSON.stringify({
            event: "resume.visual_extract.failed",
            ownerId,
            pageCount: document.pageCount,
            reason: describeError(error)
          })
        );
        throw new ApiRouteError(
          503,
          "RESUME_VISUAL_EXTRACTION_UNAVAILABLE",
          "Trailgrad could not read this visual PDF right now. Your file was not saved."
        );
      }
    }
    const documentEvidence = inspectResumeDocument(document, selection.data.level);

    const analysisBudget = remainingMs() - RESERVED_FOR_RESPONSE_MS;
    if (analysisBudget < 5_000) {
      logger.warn(
        JSON.stringify({
          event: "resume.budget_exhausted",
          ownerId,
          elapsedMs: Date.now() - startedAt
        })
      );
      throw new ApiRouteError(
        504,
        "RESUME_ANALYSIS_TIMEOUT",
        "Reading this resume took too long. Try a shorter PDF or DOCX export."
      );
    }

    let analysis;
    try {
      analysis = await resumeService.analyze({
        text: document.text,
        targetRole: selection.data.targetRole,
        level: selection.data.level,
        evidence: documentEvidence,
        // Two attempts, each inside half the remaining budget.
        timeoutMs: Math.floor(analysisBudget / 2),
        maxAttempts: 2
      });
    } catch (error) {
      const reason = describeError(error);
      logger.error(
        JSON.stringify({
          event: "resume.analysis.failed",
          ownerId,
          format: document.format,
          pageCount: document.pageCount,
          textLength: document.text.length,
          reason
        })
      );
      throw new ApiRouteError(
        reason.code === "AI_TIMEOUT" ? 504 : 503,
        reason.code === "AI_TIMEOUT" ? "RESUME_ANALYSIS_TIMEOUT" : "RESUME_ANALYSIS_UNAVAILABLE",
        reason.code === "AI_TIMEOUT"
          ? "Reading this resume took too long. Try again in a moment — your file was not saved."
          : "Trailgrad could not analyze the resume right now. Your file was not saved."
      );
    }

    if (
      !verifyResumeDocument(analysis, { level: selection.data.level, evidence: documentEvidence })
    ) {
      logger.log(
        JSON.stringify({
          event: "resume.rejected",
          ownerId,
          documentType: analysis.documentType,
          confidence: analysis.confidence,
          identitySupported: analysis.candidateIdentitySupported,
          chronologyCoherent: analysis.chronologyCoherent,
          personalCareerEvidence: analysis.personalCareerEvidence
        })
      );
      throw new ApiRouteError(
        422,
        "RESUME_NOT_VERIFIED",
        analysis.rejectionReason ||
          "This document could not be verified as a personal candidate resume.",
        {
          documentType: analysis.documentType,
          identitySupported: analysis.candidateIdentitySupported,
          chronologyCoherent: analysis.chronologyCoherent,
          personalCareerEvidence: analysis.personalCareerEvidence
        }
      );
    }

    const { experience, education, projects, achievements } = groundResumeEvidence(
      analysis,
      document.text
    );
    const practiceQuestions = analysis.practiceQuestions.map((question) => ({
      ...question,
      id: randomUUID()
    }));
    const roadmap = analysis.roadmap.map((item) => ({ ...item, id: randomUUID() }));

    // Separately: did anything survive grounding? A verified resume that yields
    // no traceable entry means the extraction was invented, not that the
    // candidate uploaded a fake.
    if (!hasGroundedEvidence({ experience, education, projects, achievements })) {
      logger.warn(
        JSON.stringify({
          event: "resume.ungrounded",
          ownerId,
          proposedExperience: analysis.experience.length,
          proposedProjects: analysis.projects.length,
          proposedEducation: analysis.education.length
        })
      );
      throw new ApiRouteError(
        422,
        "RESUME_EVIDENCE_UNVERIFIED",
        "Trailgrad could not trace any experience, project, or education entry back to this document. Try the original export rather than a scan or screenshot."
      );
    }

    // Thin practice material is a degraded result, not a rejection. The
    // candidate keeps their verified profile and Maya works from the evidence.
    if (practiceQuestions.length < 3 || roadmap.length < 3 || analysis.stories.length === 0) {
      logger.warn(
        JSON.stringify({
          event: "resume.extraction.thin",
          ownerId,
          practiceQuestions: practiceQuestions.length,
          roadmap: roadmap.length,
          stories: analysis.stories.length
        })
      );
    }

    const confidence = Math.round(analysis.confidence * 55 + documentEvidence.confidence * 45);
    const warnings = [...new Set([...documentEvidence.warnings, ...analysis.warnings])].slice(0, 5);
    const stories = analysis.stories.map((story) => ({ ...story, id: randomUUID() }));
    const documentSummary = {
      format: document.format,
      pageCount: document.pageCount,
      pageCountEstimated: document.pageCountEstimated,
      sections: documentEvidence.sections
    };
    const evidenceSummary = {
      dateRanges: documentEvidence.dateRanges,
      achievementLines: documentEvidence.achievementLines,
      quantifiedAchievements: documentEvidence.quantifiedAchievements,
      experienceEntries: documentEvidence.experienceEntries,
      projectEntries: documentEvidence.projectEntries,
      educationEntries: documentEvidence.educationEntries
    };
    const fullName = documentEvidence.identity.name || analysis.fullName;
    const resumeFile = {
      fileName: safeName || "resume",
      mimeType: file.type || inferMimeType(safeName)
    };
    const extraction = {
      fullName,
      headline: analysis.headline,
      context: analysis.summary,
      skills: analysis.skills,
      focusAreas: analysis.focusAreas,
      stories,
      experience,
      education,
      projects,
      achievements,
      practiceQuestions,
      roadmap,
      confidence,
      warnings,
      document: documentSummary,
      evidence: evidenceSummary
    };
    const previewProfile: CandidateProfile = {
      targetRole: selection.data.targetRole,
      level: selection.data.level,
      targetCompany: "",
      targetDate: null,
      headline: extraction.headline,
      context: extraction.context,
      coverImage: null,
      profileImage: null,
      workspaceAccent: "ember",
      focusAreas: extraction.focusAreas,
      stories,
      updatedAt: null,
      completeness: Math.round(
        ([
          selection.data.targetRole,
          selection.data.level,
          extraction.headline,
          extraction.context
        ].filter(Boolean).length /
          4) *
          100
      ),
      onboardingCompletedAt: null,
      resume: {
        fileName: resumeFile.fileName,
        uploadedAt: Date.now(),
        confidence,
        fullName,
        skills: extraction.skills,
        warnings,
        experience,
        education,
        projects,
        achievements,
        practiceQuestions,
        roadmap,
        document: documentSummary,
        evidence: evidenceSummary
      }
    };

    logger.log(
      JSON.stringify({
        event: "resume.preview.accepted",
        ownerId,
        durationMs: Date.now() - startedAt,
        format: document.format,
        confidence,
        experience: experience.length,
        projects: projects.length,
        education: education.length,
        practiceQuestions: practiceQuestions.length
      })
    );

    return apiSuccess({
      profile: previewProfile,
      resumeFile,
      extraction,
      frontendRoadmap: null
    });
  } catch (error) {
    if (error instanceof ResumeDocumentError) {
      logger.log(
        JSON.stringify({
          event: "resume.document_rejected",
          code: error.code,
          details: error.details
        })
      );
      return apiError(
        new ApiRouteError(422, error.code, error.message, error.details),
        request.nextUrl.pathname
      );
    }
    if (!(error instanceof ApiRouteError)) {
      logger.error(
        JSON.stringify({ event: "resume.unhandled", reason: describeError(error) }),
        error
      );
    }
    return apiError(error, request.nextUrl.pathname);
  }
}

function enforceUploadRate(ownerId: string): void {
  const now = Date.now();
  const recent = (uploadHistory.get(ownerId) ?? []).filter(
    (timestamp) => now - timestamp < UPLOAD_WINDOW_MS
  );

  if (recent.length >= UPLOADS_PER_WINDOW) {
    throw new ApiRouteError(
      429,
      "RESUME_UPLOAD_RATE_LIMITED",
      "That is a lot of resume uploads in a short window. Try again in a few minutes."
    );
  }

  recent.push(now);
  uploadHistory.set(ownerId, recent);

  if (uploadHistory.size > 5_000) {
    for (const [key, timestamps] of uploadHistory) {
      if (timestamps.every((timestamp) => now - timestamp >= UPLOAD_WINDOW_MS)) {
        uploadHistory.delete(key);
      }
    }
  }
}

function describeError(error: unknown): { code: string; message: string } {
  if (error && typeof error === "object" && "code" in error) {
    return {
      code: String((error as { code: unknown }).code),
      message: error instanceof Error ? error.message : "unknown error"
    };
  }
  return {
    code: "UNKNOWN",
    message: error instanceof Error ? error.message : String(error)
  };
}

function inferMimeType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
