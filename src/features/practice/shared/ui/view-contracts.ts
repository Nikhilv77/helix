import type { StoryPracticeArtifactData } from "./story-practice-artifact";

export type StoryPracticeDifficulty = "guided" | "standard" | "stretch";
export type StoryPracticeBlockStatus =
  "PRACTISING" | "ASSESSMENT_READY" | "ASSESSMENT_IN_PROGRESS" | "ASSESSED";
export type StoryPracticeQuestionStatus = "ACTIVE" | "COMPLETED" | "LEARNED";
export type StoryPracticeAssessmentStatus =
  "LOCKED" | "READY" | "IN_PROGRESS" | "FINALIZING" | "COMPLETED";
export type StoryPracticeQuestionFormat =
  | "mcq"
  | "predict-explain"
  | "written"
  | "spoken"
  | "artifact-diagnosis"
  | "debug-repair"
  | "micro-implementation"
  | "production-decision";

export type StoryPracticeDraftWork =
  | { kind: "choice"; selectedChoiceIndex: number }
  | { kind: "text"; text: string }
  | { kind: "code"; code: string };

export type StoryPracticeAttemptWork =
  Exclude<StoryPracticeDraftWork, { kind: "code" }> | { kind: "code"; code: string; runId: string };

export type StoryPracticeAttemptFeedbackView = {
  schemaVersion: 1;
  score: number;
  result: string;
  didWell: string;
  mechanism: string;
  missingOrIncorrect: string;
  productionConsequence: string;
  transferExample: string;
  interviewerFollowUp: string;
  missedEdgeCases: string[];
};

export type StoryPracticeRunResultView = {
  accepted: boolean;
  status:
    | "accepted"
    | "tests-failed"
    | "compile-error"
    | "runtime-error"
    | "timeout"
    | "memory-limit"
    | "output-limit"
    | "process-limit";
  publicTests: Array<{
    name: string;
    input: string;
    expected: string;
    passed: boolean;
    diagnostic?: string;
  }>;
  hiddenTests: { passed: number; total: number };
  durationMs: number;
  peakMemoryMb: number | null;
  diagnostic?: string;
};

export type StoryPracticeQuestionView = {
  id: string;
  blockId: string;
  order: number;
  status: StoryPracticeQuestionStatus;
  question: {
    format: StoryPracticeQuestionFormat;
    prompt: string;
    topicKeys: string[];
    artifact: StoryPracticeArtifactData;
    choices?: string[];
    hintCount: 3;
    starterCode?: string;
    interviewConnection?: string;
  };
  draft: StoryPracticeDraftWork | null;
  revealedHints: string[];
  authorizedAnswer: {
    concise: string;
    explanation: string;
    learningGuide?: {
      markdown: string;
      diagram: {
        title: string;
        steps: Array<{ label: string; detail: string }>;
      };
    };
    referenceSolution?: string;
  } | null;
  latestAttempt: {
    id: string;
    work: StoryPracticeAttemptWork;
    feedback: StoryPracticeAttemptFeedbackView;
    verificationStatus: string;
    score: number | null;
    createdAt: string;
  } | null;
  latestRun: {
    id: string;
    code: string;
    result: StoryPracticeRunResultView;
    createdAt: string;
  } | null;
};

export type StoryPracticeAssessmentSnapshotView = {
  prompts: Array<{
    id: string;
    order: number;
    kind: string;
    prompt: string;
    context: string | null;
  }>;
  submission: {
    requestId: string;
    responses: Array<{ promptId: string; answer: string }>;
    submittedAt: string;
  } | null;
};

export type StoryPracticeAssessmentReportView = {
  scores: {
    technicalAccuracy: number;
    mechanismReasoning: number;
    diagnosisEvidence: number;
    debuggingImplementation: number;
    communicationProduction: number;
  };
  overallScore: number;
  teacherSummary: string;
  strengths: string[];
  improvementAreas: string[];
  promptFeedback: Array<{ promptId: string; score: number; feedback: string }>;
  solvedVsLearned: {
    completedCount: number;
    learnedCount: number;
    masteryCreditNote: string;
  };
  deterministicEvidence: {
    acceptedCodeQuestionCount: number;
    totalCodeQuestionCount: number;
    implementationScoreCapped: boolean;
  };
  nextStory: {
    reason: string;
    selectedStory: {
      title: string;
      difficulty: StoryPracticeDifficulty;
      emphasizedConceptKeys: string[];
    };
  };
};

export type StoryPracticeAssessmentView = {
  id: string;
  status: StoryPracticeAssessmentStatus;
  assessment: StoryPracticeAssessmentSnapshotView | null;
  report: StoryPracticeAssessmentReportView | null;
  transcript: {
    entries: Array<{
      promptId: string;
      order: number;
      prompt: string;
      answer: string;
    }>;
  } | null;
};

export type StoryPracticeBlockView = {
  id: string;
  ordinal: number;
  isCurrent: boolean;
  status: StoryPracticeBlockStatus;
  story: {
    key: string;
    title: string;
    premise: string;
    incident: string;
    candidateRole: string;
    primaryTopicKey: string;
    secondaryTopicKeys: string[];
    mechanismKeys: string[];
    difficulty: StoryPracticeDifficulty;
    expectedMinutes: number;
    stages: Array<{ order: number; title: string }>;
  };
  selection: {
    difficulty: StoryPracticeDifficulty;
    reason: string;
  };
  questions: StoryPracticeQuestionView[];
  assessment: StoryPracticeAssessmentView | null;
};

export type StoryPracticeLibraryEntryView = {
  key: string;
  version: number;
  title: string;
  difficulties: StoryPracticeDifficulty[];
  topicKeys: string[];
  mechanismKeys: string[];
};

export type StoryPracticeHistorySummaryView = {
  id: string;
  ordinal: number;
  isCurrent: boolean;
  status: StoryPracticeBlockStatus;
  story: {
    key: string;
    title: string;
    primaryTopicKey: string;
    secondaryTopicKeys: string[];
    difficulty: StoryPracticeDifficulty;
    stages: Array<{ order: number }>;
  };
  completedQuestionCount: number;
  learnedQuestionCount: number;
  assessment: {
    id: string;
    status: StoryPracticeAssessmentStatus;
    overallScore: number | null;
  } | null;
};

export type StoryPracticeHistoryListView = StoryPracticeHistorySummaryView[];

export type StoryPracticeHistoryNavigationView = {
  selected: StoryPracticeHistorySummaryView;
  previousBlockId: string | null;
  nextBlockId: string | null;
  totalBlocks: number;
};
