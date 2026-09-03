import { describe, expect, it, vi } from "vitest";
import { compileCandidateInterviewProfile } from "../interview/candidate-profile-compiler";
import type { PrismaService } from "../database/prisma.service";
import { ProfileService } from "./profile.service";

const OWNER_ID = "user-profile-update";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const FINGERPRINT = `sha256-${"a".repeat(64)}`;
const NOW = new Date("2026-09-03T10:00:00.000Z");

function confirmation() {
  return {
    fileName: "new-resume.pdf",
    mimeType: "application/pdf",
    contentFingerprint: FINGERPRINT,
    confidence: 92,
    fullName: "Test Candidate",
    skills: ["TypeScript"],
    warnings: [],
    experience: [
      {
        organization: "Product Co",
        role: "Engineer",
        period: "2024 - Present",
        location: "",
        summary: "Built APIs.",
        achievements: ["Reduced latency by 30%."],
        skills: ["TypeScript"]
      }
    ],
    education: [],
    projects: [],
    achievements: ["Reduced latency by 30%."],
    practiceQuestions: [],
    roadmap: [],
    document: { format: "pdf" as const, pageCount: 1, pageCountEstimated: false, sections: [] },
    evidence: {
      dateRanges: 1,
      achievementLines: 1,
      quantifiedAchievements: 1,
      experienceEntries: 1,
      projectEntries: 0,
      educationEntries: 0
    }
  };
}

function rawProfile(activeResumeVersionId: string | null = null) {
  return {
    ownerId: OWNER_ID,
    targetRole: "backend",
    level: "3-5",
    targetCompany: "Protected Co",
    targetDate: new Date("2026-12-01T12:00:00.000Z"),
    headline: "My manually edited headline",
    context: "My manually edited profile context remains exactly unchanged.",
    coverImage: "/images/profile/covers/cover-1.png",
    profileImage: "/images/profile/avatars/avatar-1.png",
    workspaceAccent: "ember",
    dsaEditorLanguage: "javascript",
    teacherId: "maya",
    helpNotificationsEnabled: true,
    teacherNotificationsEnabled: false,
    focusAreas: ["System design"],
    stories: [],
    resumeFileName: "old.pdf",
    resumeMimeType: "application/pdf",
    resumeAnalysis: null,
    resumeUploadedAt: NOW,
    resumeVerifiedAt: NOW,
    resumeConfidence: 80,
    activeResumeVersionId,
    onboardingCompletedAt: NOW,
    curriculum: { protected: true },
    curriculumBuiltAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    activeResumeVersion: null
  };
}

function versionRecord() {
  const input = confirmation();
  const resume = {
    versionId: VERSION_ID,
    contentFingerprint: FINGERPRINT,
    fileName: input.fileName,
    uploadedAt: NOW.getTime(),
    confidence: input.confidence,
    fullName: input.fullName,
    skills: input.skills,
    warnings: input.warnings,
    experience: input.experience,
    education: input.education,
    projects: input.projects,
    achievements: input.achievements,
    practiceQuestions: input.practiceQuestions,
    roadmap: input.roadmap,
    document: input.document,
    evidence: input.evidence,
    interviewKit: null
  };
  const profile = compileCandidateInterviewProfile({
    resume,
    headline: "My manually edited headline",
    selectedRole: "backend",
    selectedLevel: "3-5",
    profileId: VERSION_ID,
    revision: 2,
    sourceResumeFingerprint: FINGERPRINT,
    generatedAt: NOW.getTime()
  });
  return {
    id: VERSION_ID,
    ownerId: OWNER_ID,
    revision: 2,
    schemaVersion: profile.schemaVersion,
    sourceResumeFingerprint: FINGERPRINT,
    profile,
    resumeSnapshot: {
      fullName: resume.fullName,
      skills: resume.skills,
      warnings: [],
      experience: resume.experience,
      education: [],
      projects: [],
      achievements: resume.achievements,
      practiceQuestions: [],
      roadmap: [],
      document: resume.document,
      evidence: resume.evidence,
      interviewKit: null
    },
    resumeFileName: input.fileName,
    resumeMimeType: input.mimeType,
    resumeUploadedAt: NOW,
    resumeConfidence: input.confidence,
    generatedAt: NOW,
    createdAt: NOW
  };
}

function setup(activeResumeVersionId: string | null) {
  const candidate = rawProfile(activeResumeVersionId);
  const version = versionRecord();
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(candidate, data);
    return candidate;
  });
  const transaction = {
    candidateProfile: {
      findUnique: vi.fn().mockResolvedValue(candidate),
      update
    },
    candidateInterviewProfileVersion: {
      findUnique: vi.fn().mockResolvedValue(version),
      findFirst: vi.fn(),
      create: vi.fn()
    }
  };
  const prisma = {
    ...transaction,
    candidateProfile: {
      ...transaction.candidateProfile,
      findUnique: vi.fn(async () => ({
        ...candidate,
        activeResumeVersion: candidate.activeResumeVersionId
          ? { sourceResumeFingerprint: FINGERPRINT }
          : null
      }))
    },
    $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction))
  } as unknown as PrismaService;
  return { service: new ProfileService(prisma), candidate, update, prisma };
}

describe("ProfileService resume confirmation", () => {
  it("updates only resume-derived fields and leaves manual, plan, and progress data untouched", async () => {
    const { service, candidate, update, prisma } = setup(null);
    await service.confirmResumeUpdate(OWNER_ID, confirmation());

    expect(update).toHaveBeenCalledTimes(1);
    const data = update.mock.calls[0]![0].data;
    expect(Object.keys(data).sort()).toEqual(
      [
        "activeResumeVersionId",
        "resumeAnalysis",
        "resumeConfidence",
        "resumeFileName",
        "resumeMimeType",
        "resumeUploadedAt",
        "resumeVerifiedAt"
      ].sort()
    );
    expect(candidate).toMatchObject({
      targetRole: "backend",
      level: "3-5",
      targetCompany: "Protected Co",
      headline: "My manually edited headline",
      context: "My manually edited profile context remains exactly unchanged.",
      teacherId: "maya",
      curriculum: { protected: true }
    });
    expect("personalizedInterviewPlanVersion" in prisma).toBe(false);
    expect("userRoadmap" in prisma).toBe(false);
  });

  it("treats repeated confirmation of the active fingerprint as an idempotent no-op", async () => {
    const { service, update } = setup(VERSION_ID);
    await service.confirmResumeUpdate(OWNER_ID, confirmation());
    expect(update).not.toHaveBeenCalled();
  });
});
