export type RoadmapQuestionAttemptAction = "open" | "submit" | "complete" | "skip";

export interface EnsureFrontendRoadmapResult {
  roadmapId: string;
  created: boolean;
  totalSessions: number;
  totalQuestions: number;
  completedQuestions: number;
  attemptedQuestions: number;
  currentSessionTemplateSlug: string | null;
  currentChapterTemplateSlug: string | null;
  nextQuestionKey: string | null;
  overallProgressPercent: number;
}
