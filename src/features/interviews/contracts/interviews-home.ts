import type { InterviewRoadmapSession } from "@/features/interviews/domain/interview-roadmap-sessions";
import type { InterviewHistoryItem } from "@/lib/shared/types";

export interface InterviewsHomeData {
  firstName: string;
  quota: { used: number; limit: number };
  /** Generic interview starts are enough to advance the rolling 24-hour quota. */
  quotaStartedAt: number[];
  sessions: InterviewHistoryItem[];
  roadmapSessions: InterviewRoadmapSession[];
}
