import type {
  BlueprintDifficulty,
  BlueprintStageKind,
  QuestionFormat,
  SessionBlueprint
} from "@/features/interviews/domain/personalized-plan";
import type { DsaDesignRoundMetadata } from "@/features/interviews/domain/dsa-design-round";
import {
  storyPracticeAssessmentIdentityFromSetup,
  type StoryPracticeAssessmentIdentity
} from "@/features/practice/shared/server/contracts";
import type { AiCallTrace } from "@/server/ai/interfaces/system-designer-ai-provider.interface";
import type { InterviewRuntimeVersion } from "./runtime-version";

export const ROLES = ["backend", "frontend", "fullstack", "data", "ai-ml", "pm"] as const;
export const LEVELS = ["fresher", "0-2", "3-5", "5-plus"] as const;
export const ROUND_TYPES = ["behavioral", "technical", "hiring-manager"] as const;
export const INTENSITIES = ["friendly", "realistic", "brutal"] as const;

export type Role = (typeof ROLES)[number];
export type Level = (typeof LEVELS)[number];
export type RoundType = (typeof ROUND_TYPES)[number];
export type Intensity = (typeof INTENSITIES)[number];

export interface InterviewSetup {
  role: Role;
  level: Level;
  roundType: RoundType;
  intensity: Intensity;
  /** Free text: "what have you actually worked on?" — drives the whole plan. */
  context: string;
  /**
   * A chosen template's objectives. When present the round covers these and
   * nothing else, so picking "Defend your projects" cannot drift into a general
   * behavioural interview.
   */
  agenda?: string[];
  /** Which template produced the agenda, for history and reports. */
  templateId?: string;
  templateTitle?: string;
  /** Trusted plan duration; personalized blueprint launches set this server-side. */
  durationMinutes?: number;
  /** Trusted immutable source copied into the session when a blueprint launches. */
  personalizedPlanId?: string;
  personalizedBlueprint?: SessionBlueprint;
  /** Source identities retained when Core and Applied launch as one mixed round. */
  technicalDeepDive?: {
    kind: "technical-deep-dive";
    /** Missing/1 is legacy; 2 is the spoken project round; 3 adds project coding. */
    version?: 1 | 2 | 3;
    coreBlueprintId: string;
    appliedBlueprintId: string;
    project?: {
      sourceKind: "project" | "work-experience" | "scenario";
      sourceId: string;
      name: string;
      roleLabel?: string | null;
    };
    questionSources?: Array<{
      blueprintId: string;
      blueprintKind: "core-technical" | "applied-engineering";
      topicKey: string;
      rubricKeys: string[];
    }>;
  };
  /** Slugs selected for the live DSA workspace, in interview order. */
  dsaQuestionSlugs?: string[];
  /**
   * Public selection identity for the permanent combined round. Never put
   * answer keys or rubrics here: setup is sent to the browser.
   */
  dsaDesignRound?: DsaDesignRoundMetadata;
  /** DSA rounds use a compact set of practice questions instead of the default four-question arc. */
  questionCount?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /**
   * Marks the staged resume round, which is planned entirely from the kit
   * stored with the candidate's resume rather than from a model call.
   */
  resumeRound?: boolean;
  /**
   * Marks the computer fundamentals round, planned entirely from the authored
   * question bank rather than from a model call.
   */
  fundamentalsRound?: boolean;
  /**
   * Neutral durable identity for Core, Applied, and future story-practice
   * assessment rooms. Legacy domain-specific identities remain readable while
   * saved sessions migrate additively.
   */
  storyPracticeAssessment?: StoryPracticeAssessmentIdentity;
  storyPracticeAssessmentPresentation?: {
    evidenceAnchorLabel: string;
    stages: Array<{ id: "rapid" | "explain" | "scenario"; label: string; caption: string }>;
  };
  /**
   * Explicit durable identity for the frozen end-of-block DSA assessment.
   * This deliberately does not depend on a display title: both answer grading
   * and code execution use these IDs to resolve the server-only snapshot.
   */
  dsaBlockAssessment?: {
    kind: "dsa-block-assessment";
    blockId: string;
    assessmentId: string;
    snapshotVersion: number;
    rubricVersion: number;
  };
  /** Durable identity for a frozen Core Technical path assessment. */
  coreTechnicalAssessment?: {
    kind: "core-technical-assessment";
    blockId: string;
    assessmentId: string;
    snapshotVersion: number;
    evaluatorVersion: string;
  };
}

export type InterviewStage =
  /** Resume + behavioural interview: career story, current role, and project evidence. */
  | "career"
  | "current-role"
  | "project"
  | "behavioral"
  | "skills"
  | "code"
  | "experience"
  /** Computer fundamentals: rapid checks, then mechanism, then diagnosis. */
  | "rapid"
  | "explain"
  | "scenario"
  /** Candidate-led system-design interview acts. */
  | "design-frame"
  | "design-canvas"
  | "design-deep-dive"
  | "design-pressure"
  | "design-defend";

export interface PlannedQuestion {
  /** Spoken verbatim. The decider never rewrites this. */
  text: string;
  /** Exact resume/project claim that motivated this question. */
  evidenceAnchor?: string;
  /** Structured presentation metadata. Optional for sessions saved before code rounds existed. */
  kind?: "conversation" | "code" | "mcq";
  /** Candidate-facing section shared by separate rounds and legacy combined sessions. */
  interviewSection?: "dsa" | "design";
  /** Candidate-facing section in the permanent Core Technical & Projects round. */
  technicalProjectsSection?: "technical-calibration" | "project-deep-dive";
  projectAct?: "context" | "mechanism" | "failure" | "tradeoffs" | "coding";
  language?: string;
  codeTask?: string;
  codeSnippet?: string;
  starterCode?: string;
  /** Stable ID into the server-only assessment snapshot's answer key. */
  dsaAssessmentReviewItemId?: string;
  /** Candidate-safe source problem reference for block-assessment MCQs. */
  dsaReviewContext?: {
    title: string;
    difficulty: string;
    problemStatement: string;
    constraints: string[];
    examples: Array<{ input: string; output: string; explanation?: string }>;
  };
  /** Public, immutable render contract for a frozen transfer coding problem. */
  dsaTransferQuestion?: {
    slug: string;
    title: string;
    primaryPattern: string;
    difficulty: string;
    expectedTimeMinutes: number;
    problemStatement: string | null;
    promptSummary: string;
    constraints: string[];
    examples: Array<{ input: string; output: string; explanation?: string }>;
    starterCode: Record<"javascript" | "python" | "cpp" | "java", string>;
  };
  /**
   * Server-only listening guide for an authored DSA transfer problem. It is
   * deliberately omitted by the interview API serializer.
   */
  dsaInterviewerGuide?: {
    concepts: string[];
    strongSignals: string[];
    commonMistakes: string[];
    followUpPrompts: string[];
    edgeCases: string[];
  };
  /** Server-only answer and rubric evidence for a Core Technical prompt. */
  coreTechnicalInterviewerGuide?: {
    expectedAnswer: string;
    rubric: Array<{ criterion: string; points: number }>;
  };
  /** Neutral server-only guide for Core, Applied, and future story-practice assessments. */
  storyPracticeInterviewerGuide?: {
    practice: StoryPracticeAssessmentIdentity["practice"];
    label: string;
    expectedAnswer: string;
    rubric: Array<{ criterion: string; points: number }>;
  };
  /** Server-only grounded evidence for a project interview act. */
  technicalProjectInterviewerGuide?: {
    sourceKind: "project" | "work-experience" | "scenario";
    sourceId: string;
    groundedFacts: string[];
    allowedSkillKeys: string[];
    strongSignals: string[];
    contradictionChecks: string[];
    rubric: Array<{ criterion: string; points: number }>;
  };
  /** Which stage of a resume round this question belongs to. */
  stage?: InterviewStage;
  /** The resume skill a skills-stage question came from. */
  skill?: string;
  /** Options for `kind: "mcq"`. */
  options?: string[];
  /** Index into `options`. Graded on the server and never serialised to the client. */
  answerIndex?: number;
  /** Spoken after an mcq is graded, so grading costs no model call. */
  explanation?: string;
  /** How the candidate is expected to answer. */
  answerFormat?: "mcq" | "typed" | "spoken";
  /** Bank slug a question was drawn from, for its concept card. */
  sourceSlug?: string;
  /** Human-readable skill area, used to keep the interview arc balanced. */
  competency?: string;
  /** Runtime metadata stamped from a trusted personalized blueprint. */
  blueprintStage?: BlueprintStageKind;
  blueprintDifficulty?: BlueprintDifficulty;
  blueprintFormat?: QuestionFormat;
  topicKey?: string;
  skillKeys?: string[];
  rubricKeys?: string[];
  /** Round-level report parameters this question is intentionally capable of assessing. */
  evaluationParameterKeys?: string[];
  /** Original Core/Applied provenance for a derived Technical Deep Dive slot. */
  sourceBlueprintId?: string;
  sourceBlueprintKind?: "core-technical" | "applied-engineering";
  sourceTopicKey?: string;
  sourceRubricKeys?: string[];
  maxFollowUps?: number;
  /** What the interviewer is trying to learn, not spoken to the candidate. */
  intent?: string;
  mustHit: string[];
  /** Fallback probe used when the decider call fails or times out. */
  probeIfMissing: string;
  /** Lets the closing turn return one safe, simulated hiring-manager answer. */
  acceptsCandidateQuestions?: boolean;
  /**
   * Questions sharing a value belong to one candidate-facing section. The
   * state machine uses this only for pacing; it is never shown as hidden
   * evaluation guidance.
   */
  pacingSection?: string;
  /** This anchor must be reached before a soft-time wrap may finish the round. */
  requiredForPacing?: boolean;
  /** Conservative time reservation used when deciding whether to skip support questions. */
  estimatedDurationMs?: number;
}

export type Phase = "intro" | "questioning" | "wrap" | "done";
export type Speaker = "agent" | "user";
export type DecisionAction = "clarify" | "probe" | "challenge" | "respond" | "move_on";
export type MissingDimension =
  "clarity" | "structure" | "specificity" | "ownership" | "outcome" | "none";
export type LiveCandidateIntent =
  "answer" | "decline" | "end" | "question-or-clarification" | "other";

/** Decision authored by Gemini Live; the server still validates it through the state machine. */
export interface LiveConversationProposal {
  action: DecisionAction;
  missing: MissingDimension;
  /** Semantic intent reported by Gemini Live; optional for older connected clients. */
  candidateIntent?: LiveCandidateIntent;
  reason: string;
  acknowledgement: string;
  line: string;
  candidateResponse?: string;
}

export type EvidenceDimension = "ownership" | "decision" | "specificity" | "outcome";

export interface EvidenceLedger {
  ownership: string[];
  decision: string[];
  specificity: string[];
  outcome: string[];
  gaps: EvidenceDimension[];
  /** Grounding needed to aggregate demonstrated skill ability after the round. */
  blueprint?: {
    planId: string;
    blueprintId: string;
    blueprintKind?: "core-technical" | "applied-engineering";
    stage: BlueprintStageKind;
    topicKey: string;
    skillKeys: string[];
    rubricKeys: string[];
    answerExcerpts: string[];
  };
}

export type TechnicalVerdict =
  "correct" | "mostly-correct" | "partially-correct" | "incorrect" | "insufficient-evidence";

export interface QuestionRubricEvaluation {
  rubricKey: string;
  score: number;
  rationale: string;
  /** Exact, evaluator-grounded excerpts that support this parameter score. */
  evidenceQuotes?: string[];
}

/** Durable Judge0 evidence. Compilation alone is never treated as correctness. */
export interface CodeExecutionEvidence {
  language: string;
  status: string;
  accepted: boolean;
  testsPassed: number;
  testCount: number;
  compileOutput: string;
  stderr: string;
  time: string | null;
  memory: number | null;
  recordedAt: number;
  /** SHA-256 of the candidate editor text; binds a run to the later submission. */
  codeHash?: string;
}

/** Persisted technical judgement used by reports and adaptive planning. */
export interface QuestionEvaluation {
  source: "semantic-evaluator" | "local-mcq" | "evaluation-unavailable";
  score: number;
  verdict: TechnicalVerdict;
  confidence: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  rubricScores: QuestionRubricEvaluation[];
  /** Short exact excerpts from the saved answer that support the judgement. */
  evidenceQuotes?: string[];
  answerExcerpts: string[];
  execution: CodeExecutionEvidence | null;
  evaluatedAt: number;
  /** Reproducibility and provider telemetry; absent on legacy sessions. */
  runtime?: {
    engineVersion: string;
    promptVersion: string;
    durationMs: number;
    recovered: boolean;
    calls: AiCallTrace[];
  };
}

/** Timestamps are offsets in milliseconds from the session start. */
export interface Turn {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
  /**
   * Display metadata on agent turns, so a page reload can render the same
   * annotations the live decision produced. Not part of the persisted Turn
   * shape in Phase 6 — speaker/text/startMs/endMs is what goes to Prisma.
   */
  action?: TurnAction;
  forcedBy?: ForcedReason | null;
  /** Which planned question this turn belonged to. */
  questionIndex?: number;
  /** Set on Maya's reply to a multiple choice answer, which is graded locally. */
  correct?: boolean;
  /** The question `correct` refers to, since the turn itself already advanced. */
  gradedQuestionIndex?: number;
  /** Explicit candidate opt-out for an assessment prompt; scored as zero. */
  skipped?: boolean;
  /** Candidate explicitly ended the interview; shown in transcript but never scored as an answer. */
  endedInterview?: boolean;
  /** Conversational request (for example, needing a break); never assessed as an answer. */
  assessmentExcluded?: boolean;
  /** Trusted origin of an answer; workspace marks a real code submission. */
  submissionSource?: "voice" | "workspace";
  /** Safe operational metadata for the decision that produced an agent turn. */
  runtime?: {
    engineVersion: string;
    promptVersion: string;
    durationMs: number;
    usedFallback: boolean;
    calls: AiCallTrace[];
  };
}

export type TurnAction = DecisionAction | "interrupt" | "intro";

export interface InterviewState {
  id: string;
  setup: InterviewSetup;
  plan: PlannedQuestion[];
  phase: Phase;
  questionIndex: number;
  /** Optional questions bypassed to preserve later core sections when pace slips. */
  skippedQuestionIndexes?: number[];
  /** Probes and challenges share one budget per question. */
  followUpCount: number;
  /** Epoch milliseconds. */
  startedAt: number;
  turns: Turn[];
  /** Durable evidence per planned question/resume claim. */
  evidence?: Record<string, EvidenceLedger>;
  /** Semantic/local correctness judgements keyed by planned-question index. */
  questionEvaluations?: Record<string, QuestionEvaluation>;
  /** Latest Judge0 result per code question, recorded before answer submission. */
  codeExecutions?: Record<string, CodeExecutionEvidence>;
  /** Frozen with the session so historical decisions remain attributable. */
  runtimeVersion?: InterviewRuntimeVersion;
}

export interface Decision {
  action: DecisionAction;
  missing: MissingDimension;
  /** Internal rationale. Never spoken. */
  reason: string;
  /** What the agent says. For move_on this already includes the next question. */
  utterance: string;
  /** Set when a guard overrode the model's requested action. */
  forcedBy: ForcedReason | null;
}

/** Exact API result retained for idempotent answer retries. */
export interface InterviewAnswerResponse {
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

export type ForcedReason = "follow-up-budget" | "pacing" | "soft-time" | "hard-time";

export const MAX_FOLLOW_UPS = 2;
export const QUESTION_COUNT = 4;
export const HARD_CAP_MS = 15 * 60 * 1000;
/** After this point the machine wraps up regardless of questions remaining. */
export const SOFT_WRAP_MS = 13 * 60 * 1000;

/**
 * The resume round runs a conversational arc across at most eight questions,
 * one of which may be written at the keyboard. It gets a little more room than
 * a default four-question interview without turning into a long technical screen.
 */
export const RESUME_HARD_CAP_MS = 24 * 60 * 1000;
export const RESUME_SOFT_WRAP_MS = 21 * 60 * 1000;
export const HIRING_MANAGER_HARD_CAP_MS = 30 * 60 * 1000;
export const HIRING_MANAGER_SOFT_WRAP_MS = 27 * 60 * 1000;
const PERSONALIZED_WRAP_BUFFER_MS = 2 * 60 * 1000;

export interface RoundCaps {
  softWrapMs: number;
  hardCapMs: number;
}

export function roundCaps(setup: InterviewSetup | undefined): RoundCaps {
  if (setup?.roundType === "hiring-manager") {
    return {
      softWrapMs: HIRING_MANAGER_SOFT_WRAP_MS,
      hardCapMs: HIRING_MANAGER_HARD_CAP_MS
    };
  }
  if (setup?.resumeRound) {
    return { softWrapMs: RESUME_SOFT_WRAP_MS, hardCapMs: RESUME_HARD_CAP_MS };
  }
  if (setup?.durationMinutes) {
    const hardCapMs = Math.max(5, Math.min(60, setup.durationMinutes)) * 60 * 1000;
    return {
      softWrapMs: Math.max(3 * 60 * 1000, hardCapMs - PERSONALIZED_WRAP_BUFFER_MS),
      hardCapMs
    };
  }
  return { softWrapMs: SOFT_WRAP_MS, hardCapMs: HARD_CAP_MS };
}

export function isResumableBlockAssessment(setup: InterviewSetup | undefined): boolean {
  return (
    setup?.dsaBlockAssessment?.kind === "dsa-block-assessment" ||
    storyPracticeAssessmentIdentityFromSetup(setup) !== null
  );
}
