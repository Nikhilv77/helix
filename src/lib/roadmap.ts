import type { MayaInsightKind, RoadmapProgressStatus } from "@prisma/client";

export interface FrontendRoadmapHome {
  roadmapId: string;
  title: string;
  role: "frontend";
  currentSessionTemplateSlug: string | null;
  currentChapterTemplateSlug: string | null;
  nextQuestionKey: string | null;
  nextQuestionHref: string;
  totalSessions: number;
  completedSessions: number;
  totalChapters: number;
  totalQuestions: number;
  attemptedQuestions: number;
  completedQuestions: number;
  estimatedMinutesRemaining: number;
  totalMinutes: number;
  overallProgressPercent: number;
  questionMix: { easy: number; medium: number; hard: number };
  sessions: FrontendRoadmapSession[];
  chapters: FrontendRoadmapChapter[];
  insights: FrontendRoadmapInsight[];
}

export interface FrontendRoadmapSession {
  id: string;
  order: number;
  title: string;
  purpose: string;
  covers: string[];
  status: RoadmapProgressStatus;
  totalQuestions: number;
  completedQuestions: number;
  progressPercent: number;
  href: string;
}

export interface FrontendRoadmapChapter {
  id: string;
  order: number;
  title: string;
  whyItMatters: string;
  questions: number;
  completedQuestions: number;
  minutes: number;
  counts: { easy: number; medium: number; hard: number };
  status: RoadmapProgressStatus;
  progressPercent: number;
  firstQuestionSlug: string | null;
}

/** One question inside a chapter, carrying this user's own state. */
export interface FrontendRoadmapChapterQuestion {
  slug: string;
  title: string;
  order: number;
  difficulty: string;
  minutes: number;
  status: RoadmapProgressStatus;
  attemptCount: number;
  completedAt: Date | null;
}

/** A chapter opened on its own: the questions plus where the user is in them. */
export interface FrontendRoadmapChapterDetail {
  slug: string;
  title: string;
  order: number;
  status: RoadmapProgressStatus;
  totalQuestions: number;
  completedQuestions: number;
  attemptedQuestions: number;
  progressPercent: number;
  questions: FrontendRoadmapChapterQuestion[];
  /** First question not yet completed or skipped, for the resume CTA. */
  nextQuestionSlug: string | null;
}

export interface FrontendRoadmapInsight {
  id: string;
  kind: MayaInsightKind;
  title: string;
  body: string;
  evidenceLabel: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  priority: number;
}
