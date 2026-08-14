import { Prisma } from "@prisma/client";
import type {
  CandidateProfile,
  CandidateProfileInput,
  CandidateResume,
  CandidateStory,
  Level,
  ResumeDocumentSummary,
  ResumeEducationEntry,
  ResumeEvidenceSummary,
  ResumeExperienceEntry,
  ResumePracticeQuestion,
  ResumeProjectEntry,
  ResumeRoadmapItem,
  Role
} from "@/lib/types";
import type { Curriculum, CurriculumSession } from "@/lib/curriculum";
import type { PrismaService } from "../database/prisma.service";

const roles = new Set<Role>(["backend", "frontend", "fullstack", "data", "ai-ml", "pm"]);
const levels = new Set<Level>(["fresher", "0-2", "3-5", "5-plus"]);

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

  async get(ownerId: string): Promise<CandidateProfile> {
    const stored = await this.prisma.candidateProfile.findUnique({ where: { ownerId } });

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
      focusAreas: stringArray(stored.focusAreas),
      stories: storyArray(stored.stories),
      updatedAt: stored.updatedAt.getTime(),
      completeness: 0,
      onboardingCompletedAt: stored.onboardingCompletedAt?.getTime() ?? null,
      resume: resumeFromJson(
        stored.resumeAnalysis,
        stored.resumeFileName,
        stored.resumeUploadedAt,
        stored.resumeConfidence
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
      headline: string;
      context: string;
      focusAreas: string[];
      stories: CandidateStory[];
      resume: {
        fileName: string;
        mimeType: string;
        confidence: number;
        fullName: string;
        skills: string[];
        warnings: string[];
        experience: ResumeExperienceEntry[];
        education: ResumeEducationEntry[];
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
      projects: input.resume.projects,
      achievements: input.resume.achievements,
      practiceQuestions: input.resume.practiceQuestions,
      roadmap: input.resume.roadmap,
      document: input.resume.document,
      evidence: input.resume.evidence
    };

    await this.prisma.candidateProfile.upsert({
      where: { ownerId },
      create: {
        ownerId,
        targetRole: input.targetRole,
        level: input.level,
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

    return this.get(ownerId);
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

function resumeFromJson(
  value: Prisma.JsonValue | null,
  fileName: string | null,
  uploadedAt: Date | null,
  confidence: number | null
): CandidateResume | null {
  if (!fileName || !uploadedAt || !isRecord(value)) return null;

  return {
    fileName,
    uploadedAt: uploadedAt.getTime(),
    confidence: confidence ?? 0,
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    skills: Array.isArray(value.skills)
      ? value.skills.filter((skill): skill is string => typeof skill === "string").slice(0, 16)
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings
          .filter((warning): warning is string => typeof warning === "string")
          .slice(0, 5)
      : [],
    experience: resumeExperienceFromJson(value.experience),
    education: resumeEducationFromJson(value.education),
    projects: resumeProjectsFromJson(value.projects),
    achievements: plainStringArray(value.achievements, 8),
    practiceQuestions: resumeQuestionsFromJson(value.practiceQuestions),
    roadmap: resumeRoadmapFromJson(value.roadmap),
    document: resumeDocumentFromJson(value.document),
    evidence: resumeEvidenceFromJson(value.evidence)
  };
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
