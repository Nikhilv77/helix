import { z } from "zod";

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

/** Stable contract shared by initial onboarding and later resume replacement. */
export const resumeFileSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1).max(200),
  contentFingerprint: z
    .string()
    .regex(/^sha256-[a-f0-9]{64}$/)
    .optional()
});

/** Public, answer-free result returned by resume analysis and accepted at confirmation. */
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
