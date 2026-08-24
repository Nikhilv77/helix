export type Role = "backend" | "frontend" | "fullstack" | "data" | "ai-ml" | "pm";
export type Level = "fresher" | "0-2" | "3-5" | "5-plus";
export type RoundType = "behavioral" | "technical" | "hiring-manager";
export type Intensity = "friendly" | "realistic" | "brutal";
export type { WorkspaceAccent } from "@/lib/workspace/accent";

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
  dsaQuestionSlugs?: string[];  /** Marks the staged resume round, which the workspace renders differently. */
  resumeRound?: boolean;
  /** Marks the computer fundamentals round. */
  fundamentalsRound?: boolean;
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
  coverImage: string | null;
  profileImage: string | null;
}

export interface CandidateProfile extends CandidateProfileInput {
  workspaceAccent: import("@/lib/workspace/accent").WorkspaceAccent;
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
  /** Null until the kit has been generated for this resume. */
  interviewKit: ResumeInterviewKit | null;
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

/**
 * Everything the resume round needs, generated once from the resume and stored
 * with it. Starting the round then costs no model call at all.
 */
export interface ResumeInterviewKit {
  skillQuestions: ResumeSkillQuestion[];
  codingTask: ResumeCodingTask | null;
  experienceQuestions: ResumeExperienceQuestion[];
}

export interface ResumeSkillQuestion {
  skill: string;
  competency: string;
  format: "mcq" | "typed" | "spoken";
  prompt: string;
  /** Four options for `mcq`, empty otherwise. */
  options: string[];
  /** Index into `options`. Graded on the server, never sent to the browser. */
  answerIndex: number;
  /** One line on why the answer is right, spoken after an mcq is graded. */
  explanation: string;
  /** Observable evidence a strong spoken or typed answer contains. */
  expects: string[];
}

export interface ResumeCodingTask {
  skill: string;
  language: string;
  title: string;
  brief: string;
  starterCode: string;
  expects: string[];
}

export interface ResumeExperienceQuestion {
  prompt: string;
  evidenceAnchor: string;
  competency: string;
  expects: string[];
  probeIfMissing: string;
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
  resumeFile: {
    fileName: string;
    mimeType: string;
  };
  frontendRoadmap: {
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
  } | null;
  extraction: {
    fullName: string;
    headline: string;
    context: string;
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
  /** Set on Maya's reply to a locally graded multiple choice answer. */
  correct?: boolean;
  /** The question `correct` refers to. */
  gradedQuestionIndex?: number;
}

/** The model a fundamentals question was testing, shown once it is answered. */
export interface InterviewConcept {
  areaTitle: string;
  explanation: string;
  title: string;
  summary: string;
  points: string[];
}

export type InterviewQuestionKind = "conversation" | "code" | "mcq";
/** Which stage of a resume round a question belongs to. */
export type InterviewStage =
  | "skills"
  | "code"
  | "experience"
  /** Computer fundamentals: rapid checks, then mechanism, then diagnosis. */
  | "rapid"
  | "explain"
  | "scenario";

export interface InterviewQuestion {
  text: string;
  evidenceAnchor: string | null;
  kind: InterviewQuestionKind;
  competency: string | null;
  language: string | null;
  codeTask: string | null;
  codeSnippet: string | null;
  stage: InterviewStage | null;
  /** The resume skill a skills-stage question came from. */
  skill: string | null;
  /** Present for `kind: "mcq"`. The correct index is never sent to the client. */
  options: string[] | null;
  /** How the candidate is expected to answer this question. */
  answerFormat: "mcq" | "typed" | "spoken" | null;
  /** What a strong answer contains, shown as a hint on typed questions. */
  expects: string[] | null;
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
  /** Stage of each planned question, for the resume round's stage rail. */
  stages?: Array<InterviewStage | null>;
  /** This round's hard time cap. Absent on sessions saved before per-round caps. */
  hardCapMs?: number;
  /** Teaching card for the question just finished, in a fundamentals round. */
  answeredConcept?: InterviewConcept | null;
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
  evidenceAnchor?: string | null;
  answered: boolean;
  answerPreview: string | null;
  evidenceScore: number;
  evidenceLevel: "strong" | "developing" | "missing";
  evidenceBreakdown?: {
    ownership: number;
    decision: number;
    specificity: number;
    outcome: number;
  };
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
