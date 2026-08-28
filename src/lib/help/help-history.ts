export type HelpHistorySide = "received" | "given";

export type HelpHistoryFilter = "all" | "active" | "resolved" | "expired" | "cancelled";

export interface HelpHistoryParticipant {
  label: string;
  headline: string | null;
  profileImage: string | null;
}

export interface ActivePeerHelp {
  requestId: string;
  seat: "learner" | "helper";
  slug: string;
  title: string;
  language: string;
  started: boolean;
  peer: HelpHistoryParticipant;
}

export interface CurrentPeerHelpEngagement {
  requestId: string;
  seat: "learner" | "helper";
  status: "OPEN" | "CLAIMED";
  slug: string;
  title: string;
  language: string;
  started: boolean;
  peer: HelpHistoryParticipant | null;
}

export interface TopPeerHelper {
  participant: HelpHistoryParticipant;
  helpedCount: number;
  thankedCount: number;
}

export interface HelpHistoryItem {
  id: string;
  question: {
    slug: string;
    title: string;
    topic: string;
    href: string;
  };
  language: string;
  status: "OPEN" | "CLAIMED" | "RESOLVED" | "EXPIRED" | "CANCELLED";
  participant: HelpHistoryParticipant | null;
  askedAt: number;
  claimedAt: number | null;
  resolvedAt: number | null;
  closedAt: number | null;
  sessionDurationMs: number | null;
  learnerRating: number | null;
  canReportOrBlock: boolean;
}

export interface HelpHistoryPage {
  items: HelpHistoryItem[];
  nextCursor: string | null;
}

export interface HelpOverview {
  helpReceived: number;
  peopleHelped: number;
  activeReceived: number;
  activeGiven: number;
  /** Completed conversations the learner explicitly marked helpful. */
  positiveHelps: number;
  /** Capped recognition for waiting two minutes when the learner never joined. */
  availabilityCredits: number;
  activeConversation: ActivePeerHelp | null;
  topHelpers: TopPeerHelper[];
}
