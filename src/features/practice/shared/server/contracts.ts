export const STORY_PRACTICE_BLOCK_STATUSES = [
  "PRACTISING",
  "ASSESSMENT_READY",
  "ASSESSMENT_IN_PROGRESS",
  "ASSESSED"
] as const;

export const STORY_PRACTICE_QUESTION_STATUSES = ["ACTIVE", "COMPLETED", "LEARNED"] as const;

export const STORY_PRACTICE_ASSESSMENT_STATUSES = [
  "LOCKED",
  "READY",
  "IN_PROGRESS",
  "FINALIZING",
  "COMPLETED"
] as const;

export type StoryPracticeBlockStatus = (typeof STORY_PRACTICE_BLOCK_STATUSES)[number];
export type StoryPracticeQuestionStatus = (typeof STORY_PRACTICE_QUESTION_STATUSES)[number];
export type StoryPracticeAssessmentStatus = (typeof STORY_PRACTICE_ASSESSMENT_STATUSES)[number];

export const STORY_PRACTICE_ASSESSMENT_KINDS = [
  "core-technical",
  "applied-engineering"
] as const;

export type StoryPracticeAssessmentKind = (typeof STORY_PRACTICE_ASSESSMENT_KINDS)[number];

/** Durable identity stored with a shared live assessment-room session. */
export type StoryPracticeAssessmentIdentity = {
  kind: "story-practice-assessment";
  practice: StoryPracticeAssessmentKind;
  blockId: string;
  assessmentId: string;
  snapshotVersion: number;
  evaluatorVersion: string;
};

export type StoryPracticeContinuationDecision<TNext> =
  | { kind: "continue"; next: TNext }
  | { kind: "ready"; masteredKeys: string[]; summary: string }
  | { kind: "complete"; summary: string };

export function isStoryPracticeAssessmentIdentity(
  value: unknown
): value is StoryPracticeAssessmentIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<StoryPracticeAssessmentIdentity>;
  return (
    candidate.kind === "story-practice-assessment" &&
    STORY_PRACTICE_ASSESSMENT_KINDS.some((practice) => practice === candidate.practice) &&
    typeof candidate.blockId === "string" &&
    candidate.blockId.length > 0 &&
    typeof candidate.assessmentId === "string" &&
    candidate.assessmentId.length > 0 &&
    typeof candidate.snapshotVersion === "number" &&
    Number.isInteger(candidate.snapshotVersion) &&
    candidate.snapshotVersion > 0 &&
    typeof candidate.evaluatorVersion === "string" &&
    candidate.evaluatorVersion.length > 0
  );
}

type StoryPracticeAssessmentSetup = {
  storyPracticeAssessment?: unknown;
  coreTechnicalAssessment?: {
    kind?: unknown;
    blockId?: unknown;
    assessmentId?: unknown;
    snapshotVersion?: unknown;
    evaluatorVersion?: unknown;
  };
};

/** Resolves new neutral identities and legacy Core sessions through one compatibility boundary. */
export function storyPracticeAssessmentIdentityFromSetup(
  setup: StoryPracticeAssessmentSetup | null | undefined
): StoryPracticeAssessmentIdentity | null {
  if (isStoryPracticeAssessmentIdentity(setup?.storyPracticeAssessment)) {
    return setup.storyPracticeAssessment;
  }
  const legacy = setup?.coreTechnicalAssessment;
  return legacy?.kind === "core-technical-assessment" &&
    typeof legacy.blockId === "string" &&
    typeof legacy.assessmentId === "string"
    ? {
        kind: "story-practice-assessment",
        practice: "core-technical",
        blockId: legacy.blockId,
        assessmentId: legacy.assessmentId,
        snapshotVersion: typeof legacy.snapshotVersion === "number" ? legacy.snapshotVersion : 1,
        evaluatorVersion:
          typeof legacy.evaluatorVersion === "string"
            ? legacy.evaluatorVersion
            : "legacy-core-technical"
      }
    : null;
}

export type StoryPracticeOwnerContext<TApp, TProfile> = {
  ownerId: string;
  app: TApp;
  profile: TProfile;
};

export type StoryPracticeEligibility = {
  available: boolean;
  reason: string;
  message: string;
};

export interface StoryPracticePreparationPort<TConfirmation, TPrepareInput, TFocus, TBlock> {
  confirm(ownerId: string, input: TConfirmation): Promise<TFocus>;
  prepare(
    ownerId: string,
    input: TPrepareInput
  ): Promise<{ replayed: boolean; block: TBlock | null }>;
}

export interface StoryPracticeQuestionPort<
  TDraftInput,
  THintInput,
  TAttemptInput,
  TLearnInput,
  TQuestion,
  TAttemptResult
> {
  saveDraft(ownerId: string, input: TDraftInput): Promise<TQuestion>;
  revealHint(ownerId: string, input: THintInput): Promise<TQuestion>;
  submitAttempt(ownerId: string, input: TAttemptInput): Promise<TAttemptResult>;
  learn(ownerId: string, input: TLearnInput): Promise<TQuestion>;
}

export interface StoryPracticeExecutablePort<TRunInput, TRun> {
  runCode(ownerId: string, input: TRunInput): Promise<TRun>;
}

export interface StoryPracticeAssessmentPort<TStartInput, TFinalizeInput, TAssessment> {
  start(
    ownerId: string,
    input: TStartInput,
    options?: { allowLocked?: boolean }
  ): Promise<TAssessment>;
  finalize(ownerId: string, input: TFinalizeInput): Promise<TAssessment>;
}

export interface StoryPracticeContinuationPort<TContinueInput, TBlock, TNext = unknown> {
  continue(
    ownerId: string,
    input: TContinueInput
  ): Promise<{
    replayed: boolean;
    block: TBlock | null;
    continuation?: StoryPracticeContinuationDecision<TNext>;
  }>;
}

export interface StoryPracticeHistoryPort<TBlock, THistory> {
  current(ownerId: string): Promise<TBlock | null>;
  historyBlock(ownerId: string, blockId: string): Promise<TBlock>;
  list(ownerId: string): Promise<THistory>;
}

/** Domain-neutral durable boundary used by preparation orchestration. */
export interface StoryPracticeRepositoryPort<TFocus, TFocusRevision, TPrepareInput, TBlock> {
  saveConfirmedFocus(ownerId: string, focus: TFocus): Promise<TFocusRevision>;
  publishPreparedBlock(ownerId: string, input: TPrepareInput): Promise<TBlock>;
}
