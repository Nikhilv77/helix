export type Role = "backend" | "frontend" | "fullstack" | "data" | "ai-ml" | "pm";
export type Level = "fresher" | "0-2" | "3-5" | "5-plus";
export type RoundType = "behavioral" | "technical" | "hiring-manager";
export type Intensity = "friendly" | "realistic" | "brutal";

export interface InterviewSetup {
  role: Role;
  level: Level;
  roundType: RoundType;
  intensity: Intensity;
  context: string;
  /** Objectives from a chosen template. The round covers these and nothing else. */
  agenda?: string[];
  templateId?: string;
  templateTitle?: string;
}

export interface CandidateStory {
  id: string;
  title: string;
  situation: string;
  action: string;
  outcome: string;
  skills: string[];
}

export interface CandidateProfileInput {
  targetRole: Role | null;
  level: Level | null;
  targetCompany: string;
  targetDate: string | null;
  headline: string;
  context: string;
  focusAreas: string[];
  stories: CandidateStory[];
}

export interface CandidateProfile extends CandidateProfileInput {
  updatedAt: number | null;
  completeness: number;
  onboardingCompletedAt: number | null;
  resume: CandidateResume | null;
}

export interface CandidateResume {
  fileName: string;
  uploadedAt: number;
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
}

export interface ResumeExperienceEntry {
  organization: string;
  role: string;
  period: string;
  location: string;
  summary: string;
  achievements: string[];
  skills: string[];
}

export interface ResumeEducationEntry {
  institution: string;
  credential: string;
  field: string;
  period: string;
}

export interface ResumeProjectEntry {
  name: string;
  summary: string;
  outcome: string;
  skills: string[];
}

export interface ResumePracticeQuestion {
  id: string;
  competency: string;
  prompt: string;
  evidenceAnchor: string;
}

export interface ResumeRoadmapItem {
  id: string;
  title: string;
  rationale: string;
  actions: string[];
}

export interface ResumeDocumentSummary {
  format: "pdf" | "docx";
  pageCount: number;
  pageCountEstimated: boolean;
  sections: string[];
}

export interface ResumeEvidenceSummary {
  dateRanges: number;
  achievementLines: number;
  quantifiedAchievements: number;
  experienceEntries: number;
  projectEntries: number;
  educationEntries: number;
}

export interface ResumeExtractionResponse {
  profile: CandidateProfile;
  extraction: {
    fullName: string;
    headline: string;
    skills: string[];
    focusAreas: string[];
    stories: CandidateStory[];
    experience: ResumeExperienceEntry[];
    education: ResumeEducationEntry[];
    projects: ResumeProjectEntry[];
    achievements: string[];
    practiceQuestions: ResumePracticeQuestion[];
    roadmap: ResumeRoadmapItem[];
    confidence: number;
    warnings: string[];
    document: ResumeDocumentSummary;
    evidence: ResumeEvidenceSummary;
  };
}

export type Phase = "intro" | "questioning" | "wrap" | "done";
export type Speaker = "agent" | "user";
export type DecisionAction = "clarify" | "probe" | "challenge" | "move_on";
export type MissingDimension =
  "clarity" | "structure" | "specificity" | "ownership" | "outcome" | "none";
export type ForcedReason = "follow-up-budget" | "soft-time" | "hard-time";

export type TurnAction = DecisionAction | "interrupt" | "intro";

/** Timestamps are milliseconds from session start. */
export interface Turn {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
  /** Display metadata on agent turns, so a reload renders the same annotations. */
  action?: TurnAction;
  forcedBy?: ForcedReason | null;
  questionIndex?: number;
}

export interface InterviewQuestion {
  text: string;
  kind: "conversation" | "code";
  competency: string | null;
  language: string | null;
  codeTask: string | null;
  codeSnippet: string | null;
}

export interface StartResponse {
  sessionId: string;
  phase: Phase;
  questionCount: number;
  questionIndex: number;
  startedAt: number;
  utterance: string;
}

export interface DecideResponse {
  action: DecisionAction;
  utterance: string;
  missing: MissingDimension;
  forcedBy: ForcedReason | null;
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  followUpCount: number;
  elapsedMs: number;
}

export interface SessionResponse {
  sessionId: string;
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  followUpCount: number;
  startedAt: number;
  setup: InterviewSetup;
  turns: Turn[];
  currentQuestion: InterviewQuestion | null;
}

export type InterviewHistoryStatus = "completed" | "in_progress" | "expired";

export interface InterviewHistoryItem {
  sessionId: string;
  status: InterviewHistoryStatus;
  setup: InterviewSetup;
  startedAt: number;
  updatedAt: number;
  durationMs: number;
  questionCount: number;
  questionsCovered: number;
  answerCount: number;
}

export interface InterviewCompetencyReport {
  label: string;
  question: string;
  answered: boolean;
  answerPreview: string | null;
  evidenceScore: number;
  evidenceLevel: "strong" | "developing" | "missing";
  signals: string[];
  gap: string;
  nextStep: string;
}

export interface InterviewReport extends InterviewHistoryItem {
  competencies: InterviewCompetencyReport[];
  interaction: {
    probes: number;
    challenges: number;
    clarifications: number;
    interruptions: number;
  };
  codeExercise: {
    language: string;
    task: string;
    submitted: boolean;
  } | null;
  summary: {
    evidenceScore: number;
    strongest: string | null;
    recommendedFocus: string | null;
    nextStep: string;
  };
  transcript: Turn[];
}

export interface WorkspaceCompetency {
  label: string;
  score: number;
  attempts: number;
  trend: number;
}

export interface WorkspaceInsights {
  readinessScore: number | null;
  completedSessions: number;
  sessionsThisWeek: number;
  answeredQuestions: number;
  competencyMap: WorkspaceCompetency[];
  strongest: WorkspaceCompetency | null;
  recommendedFocus: WorkspaceCompetency | null;
}

export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  path?: string;
}
