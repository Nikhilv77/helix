import type { HelpHistoryParticipant } from "./help-history";
import type { WorkspaceState } from "./snapshot";

export interface HelpInboxRequest {
  id: string;
  slug: string;
  title: string;
  questionPrompt: string | null;
  difficulty: string | null;
  language: string;
  status: string;
  headline: string | null;
  blockedOn: string | null;
  understands: string[];
  opener: string | null;
  estimatedMinutes: number | null;
  failingTests: number | null;
  hintsUsed: number;
  timeSpentMs: number;
  askedAt: number;
  capturedWorkspace: WorkspaceState | null;
  learner: HelpHistoryParticipant | null;
}

export interface HelpInboxData {
  open: HelpInboxRequest[];
  claimed: HelpInboxRequest[];
  helpedPeopleCount: number;
}
