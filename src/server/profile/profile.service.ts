import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { CandidateInterviewProfile } from "@/lib/interviews/personalized-plan";
import {
  CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
  parseCandidateInterviewProfile
} from "@/lib/interviews/personalized-plan";
import type {
  CandidateProfile,
  CandidateProfileInput,
  CandidateResume,
  CandidateStory,
  Level,
  ResumeDocumentSummary,
  ResumeEducationEntry,
  ResumeEvidenceSummary,
  ResumeCodingTask,
  ResumeExperienceEntry,
  ResumeExperienceQuestion,
  ResumeInterviewKit,
  ResumePracticeQuestion,
  ResumeSkillQuestion,
  ResumeProjectEntry,
  ResumeRoadmapItem,
  Role,
  WorkspaceAccent
} from "@/lib/shared/types";
import type { Curriculum, CurriculumSession } from "@/lib/curriculum/curriculum";
import { DEFAULT_WORKSPACE_ACCENT, isWorkspaceAccent } from "@/lib/workspace/accent";
import { compileCandidateInterviewProfile } from "../interview/candidate-profile-compiler";
import type { PrismaService } from "../database/prisma.service";

const roles = new Set<Role>(["backend", "frontend", "fullstack", "data", "ai-ml", "pm"]);
const levels = new Set<Level>(["fresher", "0-2", "3-5", "5-plus"]);
const dsaEditorLanguages = new Set(["javascript", "python", "cpp", "java"]);
export type DsaEditorLanguagePreference = "javascript" | "python" | "cpp" | "java";

export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Maya's plan is generated once and reused until the resume changes. */
  async curriculum(ownerId: string): Promise<Curriculum | null> {
    const stored = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { curriculum: true }
    });
    return curriculumFromJson(stored?.curriculum ?? null);
  }

  async saveCurriculum(ownerId: string, curriculum: Curriculum): Promise<void> {
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: { curriculum: toJson(curriculum), curriculumBuiltAt: new Date(curriculum.builtAt) }
    });
  }

  /**
   * The resume round's question bank. Written once per resume and read on every
   * later round, so the round itself never costs a model call.
   */
  async saveResumeInterviewKit(ownerId: string, kit: ResumeInterviewKit): Promise<void> {
    const stored = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { resumeAnalysis: true }
    });
    const analysis = stored?.resumeAnalysis ?? null;
    if (!analysis || !isRecord(analysis)) return;

    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: { resumeAnalysis: toJson({ ...analysis, interviewKit: kit }) }
    });
  }

  async get(ownerId: string): Promise<CandidateProfile> {
    const stored = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      include: {
        activeResumeVersion: { select: { sourceResumeFingerprint: true } }
      }
    });

    if (!stored) return emptyProfile();

    return withCompleteness({
      targetRole: isRole(stored.targetRole) ? stored.targetRole : null,
      level: isLevel(stored.level) ? stored.level : null,
      targetCompany: stored.targetCompany ?? "",
      targetDate: stored.targetDate?.toISOString().slice(0, 10) ?? null,
      headline: stored.headline ?? "",
      context: stored.context ?? "",
      coverImage: stored.coverImage ?? null,
      profileImage: stored.profileImage ?? null,
      workspaceAccent: isWorkspaceAccent(stored.workspaceAccent)
        ? stored.workspaceAccent
        : DEFAULT_WORKSPACE_ACCENT,
      teacherId: stored.teacherId,
      helpNotificationsEnabled: stored.helpNotificationsEnabled,
      teacherNotificationsEnabled: stored.teacherNotificationsEnabled,
      focusAreas: stringArray(stored.focusAreas),
      stories: storyArray(stored.stories),
      updatedAt: stored.updatedAt.getTime(),
      completeness: 0,
      onboardingCompletedAt: stored.onboardingCompletedAt?.getTime() ?? null,
      resume: resumeFromJson(
        stored.resumeAnalysis,
        stored.resumeFileName,
        stored.resumeUploadedAt,
        stored.resumeConfidence,
        stored.activeResumeVersionId,
        stored.activeResumeVersion?.sourceResumeFingerprint ?? null,
        stored.resumeMimeType
      )
    } satisfies CandidateProfile);
  }

  async save(ownerId: string, input: CandidateProfileInput): Promise<CandidateProfile> {
    const targetDate = input.targetDate ? new Date(`${input.targetDate}T12:00:00.000Z`) : null;

    await this.prisma.candidateProfile.upsert({
      where: { ownerId },
      create: {
        ownerId,
        targetRole: input.targetRole,
        level: input.level,
        targetCompany: clean(input.targetCompany),
        targetDate,
        headline: clean(input.headline),
        context: clean(input.context),
        coverImage: cleanNullable(input.coverImage),
        profileImage: cleanNullable(input.profileImage),
        focusAreas: toJson(input.focusAreas),
        stories: toJson(input.stories)
      },
      update: {
        targetRole: input.targetRole,
        level: input.level,
        targetCompany: clean(input.targetCompany),
        targetDate,
        headline: clean(input.headline),
        context: clean(input.context),
        coverImage: cleanNullable(input.coverImage),
        profileImage: cleanNullable(input.profileImage),
        focusAreas: toJson(input.focusAreas),
        stories: toJson(input.stories)
      }
    });

    return withCompleteness(await this.get(ownerId));
  }

  async workspaceAccent(ownerId: string): Promise<WorkspaceAccent> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { workspaceAccent: true }
    });

    return isWorkspaceAccent(profile?.workspaceAccent)
      ? profile.workspaceAccent
      : DEFAULT_WORKSPACE_ACCENT;
  }

  async saveWorkspaceAccent(ownerId: string, accent: WorkspaceAccent): Promise<WorkspaceAccent> {
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: { workspaceAccent: accent }
    });

    return accent;
  }

  async dsaEditorLanguage(ownerId: string): Promise<DsaEditorLanguagePreference> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { dsaEditorLanguage: true }
    });
    return isDsaEditorLanguage(profile?.dsaEditorLanguage)
      ? profile.dsaEditorLanguage
      : "javascript";
  }

  async saveDsaEditorLanguage(
    ownerId: string,
    language: DsaEditorLanguagePreference
  ): Promise<DsaEditorLanguagePreference> {
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: { dsaEditorLanguage: language }
    });
    return language;
  }

  async saveTeacher(ownerId: string, teacherId: string): Promise<string> {
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: { teacherId }
    });

    return teacherId;
  }

  async deleteAccountData(ownerId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.interviewSession.deleteMany({ where: { ownerId } }),
      this.prisma.project.deleteMany({ where: { ownerId } }),
      this.prisma.candidateProfile.deleteMany({ where: { ownerId } })
    ]);
  }

  async completeOnboarding(
    ownerId: string,
    input: {
      targetRole: Role;
      level: Level;
      /** Persona id, already validated by the route. Null keeps the default. */
      teacherId: string | null;
      headline: string;
      context: string;
      focusAreas: string[];
      stories: CandidateStory[];
      resume: {
        fileName: string;
        mimeType: string;
        contentFingerprint?: string;
        confidence: number;
        fullName: string;
        skills: string[];
        warnings: string[];
        experience: ResumeExperienceEntry[];
        education: ResumeEducationEntry[];
        certifications?: string[];
        projects: ResumeProjectEntry[];
        achievements: string[];
        practiceQuestions: ResumePracticeQuestion[];
        roadmap: ResumeRoadmapItem[];
        document: ResumeDocumentSummary;
        evidence: ResumeEvidenceSummary;
      };
    }
  ): Promise<CandidateProfile> {
    const now = new Date();
    const analysis = {
      fullName: input.resume.fullName,
      skills: input.resume.skills,
      warnings: input.resume.warnings,
      experience: input.resume.experience,
      education: input.resume.education,
      certifications: input.resume.certifications ?? [],
      projects: input.resume.projects,
      achievements: input.resume.achievements,
      practiceQuestions: input.resume.practiceQuestions,
      roadmap: input.resume.roadmap,
      document: input.resume.document,
      evidence: input.resume.evidence
    };

    await runResumeTransaction(this.prisma, async (transaction) => {
      await transaction.candidateProfile.upsert({
        where: { ownerId },
        create: {
          ownerId,
          targetRole: input.targetRole,
          level: input.level,
          teacherId: input.teacherId,
          headline: clean(input.headline),
          context: clean(input.context),
          coverImage: null,
          profileImage: null,
          focusAreas: toJson(input.focusAreas),
          stories: toJson(input.stories),
          resumeFileName: input.resume.fileName,
          resumeMimeType: input.resume.mimeType,
          resumeAnalysis: toJson(analysis),
          resumeUploadedAt: now,
          resumeVerifiedAt: now,
          resumeConfidence: input.resume.confidence,
          onboardingCompletedAt: now
        },
        update: {
          targetRole: input.targetRole,
          level: input.level,
          teacherId: input.teacherId,
          headline: clean(input.headline),
          context: clean(input.context),
          coverImage: null,
          profileImage: null,
          focusAreas: toJson(input.focusAreas),
          stories: toJson(input.stories),
          resumeFileName: input.resume.fileName,
          resumeMimeType: input.resume.mimeType,
          resumeAnalysis: toJson(analysis),
          resumeUploadedAt: now,
          resumeVerifiedAt: now,
          resumeConfidence: input.resume.confidence,
          onboardingCompletedAt: now,
          // The plan is built from resume evidence, so a new resume invalidates it.
          curriculum: Prisma.DbNull,
          curriculumBuiltAt: null
        }
      });

      const resume = candidateResume(input.resume, now);
      const version = await resolveResumeVersion(transaction, {
        ownerId,
        resume,
        mimeType: input.resume.mimeType,
        headline: input.headline,
        targetRole: input.targetRole,
        level: input.level,
        contentFingerprint: input.resume.contentFingerprint,
        now
      });
      await transaction.candidateProfile.update({
        where: { ownerId },
        data: { activeResumeVersionId: version.id }
      });
    });

    return this.get(ownerId);
  }

  /**
   * Atomically activates one immutable resume version and updates only the
   * resume-derived projection. Every user-controlled field and every Practice
   * or Interview record is intentionally outside this transaction.
   */
  async confirmResumeUpdate(
    ownerId: string,
    input: {
      fileName: string;
      mimeType: string;
      contentFingerprint: string;
      confidence: number;
      fullName: string;
      skills: string[];
      warnings: string[];
      experience: ResumeExperienceEntry[];
      education: ResumeEducationEntry[];
      certifications?: string[];
      projects: ResumeProjectEntry[];
      achievements: string[];
      practiceQuestions: ResumePracticeQuestion[];
      roadmap: ResumeRoadmapItem[];
      document: ResumeDocumentSummary;
      evidence: ResumeEvidenceSummary;
    }
  ): Promise<CandidateProfile> {
    const now = new Date();
    await runResumeTransaction(this.prisma, async (transaction) => {
      const current = await transaction.candidateProfile.findUnique({ where: { ownerId } });
      if (!current) throw new Error("Candidate profile not found");

      const proposed = candidateResume(input, now);
      const version = await resolveResumeVersion(transaction, {
        ownerId,
        resume: proposed,
        mimeType: input.mimeType,
        headline: current.headline ?? "",
        targetRole: isRole(current.targetRole) ? current.targetRole : null,
        level: isLevel(current.level) ? current.level : null,
        contentFingerprint: input.contentFingerprint,
        now
      });

      // Retrying the same confirmation is a true no-op, including timestamps.
      if (current.activeResumeVersionId === version.id) return;

      const snapshot = resumeFromJson(
        version.resumeSnapshot,
        version.resumeFileName,
        version.resumeUploadedAt,
        version.resumeConfidence,
        version.id,
        version.sourceResumeFingerprint,
        version.resumeMimeType
      );
      const active = snapshot ?? proposed;
      await transaction.candidateProfile.update({
        where: { ownerId },
        data: {
          activeResumeVersionId: version.id,
          resumeFileName: active.fileName,
          resumeMimeType: version.resumeMimeType ?? input.mimeType,
          resumeAnalysis: toJson(resumeAnalysis(active)),
          resumeUploadedAt: new Date(active.uploadedAt),
          resumeVerifiedAt: new Date(active.uploadedAt),
          resumeConfidence: active.confidence
        }
      });
    });
    return this.get(ownerId);
  }

  /** Creates/resolves the live resume snapshot without touching any plan. */
  async ensureActiveResumeVersion(
    ownerId: string,
    now = Date.now()
  ): Promise<CandidateInterviewProfile> {
    const stored = await this.prisma.candidateProfile.findUnique({ where: { ownerId } });
    if (!stored) throw new Error("Candidate profile not found");

    if (stored.activeResumeVersionId) {
      const active = await this.prisma.candidateInterviewProfileVersion.findFirst({
        where: { id: stored.activeResumeVersionId, ownerId }
      });
      if (active) return profileVersionFromRecord(active);
    }

    const profile = await this.get(ownerId);
    if (!profile.resume) throw new Error("Resume required");
    const generatedAt = new Date(now);
    const version = await runResumeTransaction(this.prisma, async (transaction) => {
      const resolved = await resolveResumeVersion(transaction, {
        ownerId,
        resume: profile.resume!,
        mimeType: stored.resumeMimeType ?? "application/pdf",
        headline: profile.headline,
        targetRole: profile.targetRole,
        level: profile.level,
        contentFingerprint: profile.resume?.contentFingerprint ?? undefined,
        now: generatedAt
      });
      await transaction.candidateProfile.update({
        where: { ownerId },
        data: { activeResumeVersionId: resolved.id }
      });
      return resolved;
    });
    return profileVersionFromRecord(version);
  }
}

export function withCompleteness(profile: CandidateProfile): CandidateProfile {
  const checks = [
    Boolean(profile.targetRole),
    Boolean(profile.level),
    profile.headline.trim().length >= 8,
    profile.context.trim().length >= 20,
    profile.focusAreas.length > 0,
    profile.stories.length > 0
  ];

  return {
    ...profile,
    completeness: Math.round((checks.filter(Boolean).length / checks.length) * 100)
  };
}

function emptyProfile(): CandidateProfile {
  return {
    targetRole: null,
    level: null,
    targetCompany: "",
    targetDate: null,
    headline: "",
    context: "",
    coverImage: null,
    profileImage: null,
    workspaceAccent: DEFAULT_WORKSPACE_ACCENT,
    teacherId: null,
    helpNotificationsEnabled: true,
    teacherNotificationsEnabled: true,
    focusAreas: [],
    stories: [],
    updatedAt: null,
    completeness: 0,
    onboardingCompletedAt: null,
    resume: null
  };
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNullable(value: string | null): string | null {
  return value ? clean(value) : null;
}

function isDsaEditorLanguage(
  value: string | null | undefined
): value is DsaEditorLanguagePreference {
  return typeof value === "string" && dsaEditorLanguages.has(value);
}

function isRole(value: string | null): value is Role {
  return Boolean(value && roles.has(value as Role));
}

function isLevel(value: string | null): value is Level {
  return Boolean(value && levels.has(value as Level));
}

function stringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 8);
}

function storyArray(value: Prisma.JsonValue): CandidateStory[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === "string" ? item.id : "";
    const title = typeof item.title === "string" ? item.title : "";
    if (!id || !title) return [];

    return [
      {
        id,
        title,
        situation: typeof item.situation === "string" ? item.situation : "",
        action: typeof item.action === "string" ? item.action : "",
        outcome: typeof item.outcome === "string" ? item.outcome : "",
        skills: Array.isArray(item.skills)
          ? item.skills.filter((skill): skill is string => typeof skill === "string").slice(0, 6)
          : []
      }
    ];
  });
}

function isRecord(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function runResumeTransaction<T>(
  prisma: PrismaService,
  work: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034");
      if (!retryable || attempt === 2) throw error;
    }
  }
  throw new Error("Resume transaction retry exhausted");
}

function resumeFromJson(
  value: Prisma.JsonValue | null,
  fileName: string | null,
  uploadedAt: Date | null,
  confidence: number | null,
  versionId: string | null = null,
  contentFingerprint: string | null = null,
  mimeType: string | null = null
): CandidateResume | null {
  if (!fileName || !uploadedAt || !isRecord(value)) return null;

  return {
    versionId,
    contentFingerprint,
    fileName,
    mimeType,
    uploadedAt: uploadedAt.getTime(),
    confidence: confidence ?? 0,
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    skills: Array.isArray(value.skills)
      ? value.skills.filter((skill): skill is string => typeof skill === "string").slice(0, 24)
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings
          .filter((warning): warning is string => typeof warning === "string")
          .slice(0, 5)
      : [],
    experience: resumeExperienceFromJson(value.experience),
    education: resumeEducationFromJson(value.education),
    certifications: plainStringArray(value.certifications, 16),
    projects: resumeProjectsFromJson(value.projects),
    achievements: plainStringArray(value.achievements, 8),
    practiceQuestions: resumeQuestionsFromJson(value.practiceQuestions),
    roadmap: resumeRoadmapFromJson(value.roadmap),
    document: resumeDocumentFromJson(value.document),
    evidence: resumeEvidenceFromJson(value.evidence),
    interviewKit: resumeInterviewKitFromJson(value.interviewKit)
  };
}

function candidateResume(
  input: {
    fileName: string;
    confidence: number;
    fullName: string;
    skills: string[];
    warnings: string[];
    experience: ResumeExperienceEntry[];
    education: ResumeEducationEntry[];
    certifications?: string[];
    projects: ResumeProjectEntry[];
    achievements: string[];
    practiceQuestions: ResumePracticeQuestion[];
    roadmap: ResumeRoadmapItem[];
    document: ResumeDocumentSummary;
    evidence: ResumeEvidenceSummary;
  },
  uploadedAt: Date
): CandidateResume {
  return {
    versionId: null,
    contentFingerprint:
      "contentFingerprint" in input && typeof input.contentFingerprint === "string"
        ? input.contentFingerprint
        : null,
    fileName: input.fileName,
    mimeType: "mimeType" in input && typeof input.mimeType === "string" ? input.mimeType : null,
    uploadedAt: uploadedAt.getTime(),
    confidence: input.confidence,
    fullName: input.fullName,
    skills: input.skills,
    warnings: input.warnings,
    experience: input.experience,
    education: input.education,
    certifications: input.certifications ?? [],
    projects: input.projects,
    achievements: input.achievements,
    practiceQuestions: input.practiceQuestions,
    roadmap: input.roadmap,
    document: input.document,
    evidence: input.evidence,
    interviewKit: null
  };
}

function resumeAnalysis(resume: CandidateResume) {
  return {
    fullName: resume.fullName,
    skills: resume.skills,
    warnings: resume.warnings,
    experience: resume.experience,
    education: resume.education,
    certifications: resume.certifications ?? [],
    projects: resume.projects,
    achievements: resume.achievements,
    practiceQuestions: resume.practiceQuestions,
    roadmap: resume.roadmap,
    document: resume.document,
    evidence: resume.evidence,
    interviewKit: resume.interviewKit
  };
}

async function resolveResumeVersion(
  transaction: Prisma.TransactionClient,
  input: {
    ownerId: string;
    resume: CandidateResume;
    mimeType: string;
    headline: string;
    targetRole: Role | null;
    level: Level | null;
    contentFingerprint?: string;
    now: Date;
  }
) {
  const probe = compileCandidateInterviewProfile({
    resume: input.resume,
    headline: input.headline,
    selectedRole: input.targetRole,
    selectedLevel: input.level,
    profileId: randomUUID(),
    revision: 1,
    generatedAt: input.now.getTime(),
    sourceResumeFingerprint: input.contentFingerprint
  });
  const key = {
    ownerId: input.ownerId,
    sourceResumeFingerprint: probe.sourceResumeFingerprint,
    schemaVersion: CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION
  };
  const existing = await transaction.candidateInterviewProfileVersion.findUnique({
    where: { ownerId_sourceResumeFingerprint_schemaVersion: key }
  });
  if (existing) return existing;

  const latest = await transaction.candidateInterviewProfileVersion.findFirst({
    where: { ownerId: input.ownerId },
    orderBy: { revision: "desc" },
    select: { revision: true }
  });
  const profile = compileCandidateInterviewProfile({
    resume: input.resume,
    headline: input.headline,
    selectedRole: input.targetRole,
    selectedLevel: input.level,
    profileId: randomUUID(),
    revision: (latest?.revision ?? 0) + 1,
    generatedAt: input.now.getTime(),
    sourceResumeFingerprint: probe.sourceResumeFingerprint
  });
  return transaction.candidateInterviewProfileVersion.create({
    data: {
      id: profile.id,
      ownerId: input.ownerId,
      revision: profile.revision,
      schemaVersion: profile.schemaVersion,
      sourceResumeFingerprint: profile.sourceResumeFingerprint,
      profile: toJson(profile),
      resumeSnapshot: toJson(resumeAnalysis(input.resume)),
      resumeFileName: input.resume.fileName,
      resumeMimeType: input.mimeType,
      resumeUploadedAt: input.now,
      resumeConfidence: input.resume.confidence,
      generatedAt: input.now
    }
  });
}

function profileVersionFromRecord(record: {
  id: string;
  revision: number;
  schemaVersion: number;
  sourceResumeFingerprint: string;
  generatedAt: Date;
  profile: Prisma.JsonValue;
}): CandidateInterviewProfile {
  const profile = parseCandidateInterviewProfile(record.profile);
  if (
    profile.id !== record.id ||
    profile.revision !== record.revision ||
    profile.schemaVersion !== record.schemaVersion ||
    profile.sourceResumeFingerprint !== record.sourceResumeFingerprint ||
    profile.generatedAt !== record.generatedAt.getTime()
  ) {
    throw new Error("Stored candidate profile version does not match its immutable snapshot");
  }
  return profile;
}

function resumeInterviewKitFromJson(
  value: Prisma.JsonValue | undefined
): ResumeInterviewKit | null {
  if (value === undefined || value === null || !isRecord(value)) return null;
  const record = value;

  const skillQuestions = Array.isArray(record.skillQuestions)
    ? record.skillQuestions.flatMap((item): ResumeSkillQuestion[] => {
        if (!isRecord(item)) return [];
        const prompt = stringValue(item.prompt);
        if (!prompt) return [];
        const format =
          item.format === "mcq" || item.format === "typed" || item.format === "spoken"
            ? item.format
            : "typed";
        const options = plainStringArray(item.options, 4);
        // A multiple choice question without a usable option set would leave the
        // candidate with nothing to click, so it degrades to a typed answer.
        if (format === "mcq" && options.length < 2) return [];

        return [
          {
            skill: stringValue(item.skill),
            competency: stringValue(item.competency) || "Technical depth",
            format,
            prompt,
            options: format === "mcq" ? options : [],
            answerIndex:
              typeof item.answerIndex === "number" && item.answerIndex >= 0
                ? Math.min(Math.floor(item.answerIndex), Math.max(0, options.length - 1))
                : 0,
            explanation: stringValue(item.explanation),
            expects: plainStringArray(item.expects, 3)
          }
        ];
      })
    : [];

  const rawTask =
    record.codingTask !== undefined && record.codingTask !== null && isRecord(record.codingTask)
      ? record.codingTask
      : null;
  const codingTask: ResumeCodingTask | null =
    rawTask && stringValue(rawTask.brief)
      ? {
          skill: stringValue(rawTask.skill),
          language: stringValue(rawTask.language) || "javascript",
          title: stringValue(rawTask.title) || "Coding task",
          brief: stringValue(rawTask.brief),
          starterCode: stringValue(rawTask.starterCode),
          expects: plainStringArray(rawTask.expects, 3)
        }
      : null;

  const experienceQuestions = Array.isArray(record.experienceQuestions)
    ? record.experienceQuestions.flatMap((item): ResumeExperienceQuestion[] => {
        if (!isRecord(item)) return [];
        const prompt = stringValue(item.prompt);
        if (!prompt) return [];

        return [
          {
            prompt,
            evidenceAnchor: stringValue(item.evidenceAnchor),
            competency: stringValue(item.competency) || "Ownership",
            expects: plainStringArray(item.expects, 3),
            probeIfMissing: stringValue(item.probeIfMissing)
          }
        ];
      })
    : [];

  if (!skillQuestions.length && !codingTask && !experienceQuestions.length) return null;
  return { skillQuestions, codingTask, experienceQuestions };
}

function resumeExperienceFromJson(value: Prisma.JsonValue | undefined): ResumeExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const organization = stringValue(item.organization);
    const role = stringValue(item.role);
    if (!organization && !role) return [];
    return [
      {
        organization,
        role,
        period: stringValue(item.period),
        location: stringValue(item.location),
        summary: stringValue(item.summary),
        achievements: plainStringArray(item.achievements, 4),
        skills: plainStringArray(item.skills, 8)
      }
    ];
  });
}

function resumeEducationFromJson(value: Prisma.JsonValue | undefined): ResumeEducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const institution = stringValue(item.institution);
    if (!institution) return [];
    return [
      {
        institution,
        credential: stringValue(item.credential),
        field: stringValue(item.field),
        period: stringValue(item.period)
      }
    ];
  });
}

function resumeProjectsFromJson(value: Prisma.JsonValue | undefined): ResumeProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = stringValue(item.name);
    if (!name) return [];
    return [
      {
        name,
        summary: stringValue(item.summary),
        outcome: stringValue(item.outcome),
        skills: plainStringArray(item.skills, 8)
      }
    ];
  });
}

function resumeQuestionsFromJson(value: Prisma.JsonValue | undefined): ResumePracticeQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = stringValue(item.id);
    const prompt = stringValue(item.prompt);
    if (!id || !prompt) return [];
    return [
      {
        id,
        prompt,
        competency: stringValue(item.competency),
        evidenceAnchor: stringValue(item.evidenceAnchor)
      }
    ];
  });
}

function resumeRoadmapFromJson(value: Prisma.JsonValue | undefined): ResumeRoadmapItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = stringValue(item.id);
    const title = stringValue(item.title);
    if (!id || !title) return [];
    return [
      {
        id,
        title,
        rationale: stringValue(item.rationale),
        actions: plainStringArray(item.actions, 3)
      }
    ];
  });
}

function plainStringArray(value: Prisma.JsonValue | undefined, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, limit);
}

function stringValue(value: Prisma.JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function resumeDocumentFromJson(value: Prisma.JsonValue | undefined): ResumeDocumentSummary {
  if (value === undefined || !isRecord(value)) {
    return { format: "pdf", pageCount: 1, pageCountEstimated: true, sections: [] };
  }
  const source = value;

  return {
    format: source.format === "docx" ? "docx" : "pdf",
    pageCount: numberValue(source.pageCount, 1),
    pageCountEstimated: source.pageCountEstimated === true,
    sections: Array.isArray(source.sections)
      ? source.sections
          .filter((section): section is string => typeof section === "string")
          .slice(0, 10)
      : []
  };
}

function resumeEvidenceFromJson(value: Prisma.JsonValue | undefined): ResumeEvidenceSummary {
  if (value === undefined || !isRecord(value)) {
    return {
      dateRanges: 0,
      achievementLines: 0,
      quantifiedAchievements: 0,
      experienceEntries: 0,
      projectEntries: 0,
      educationEntries: 0
    };
  }
  const source = value;
  return {
    dateRanges: numberValue(source.dateRanges),
    achievementLines: numberValue(source.achievementLines),
    quantifiedAchievements: numberValue(source.quantifiedAchievements),
    experienceEntries: numberValue(source.experienceEntries),
    projectEntries: numberValue(source.projectEntries),
    educationEntries: numberValue(source.educationEntries)
  };
}

function numberValue(value: Prisma.JsonValue | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function curriculumFromJson(value: Prisma.JsonValue | null): Curriculum | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) return null;

  const sessions = value.sessions.flatMap((session) =>
    isRecord(session) && typeof session.id === "string" && typeof session.title === "string"
      ? [session as unknown as CurriculumSession]
      : []
  );
  if (sessions.length === 0) return null;

  return {
    builtAt: numberValue(value.builtAt, Date.now()),
    headline: stringValue(value.headline),
    sessions
  };
}
