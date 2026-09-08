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

export interface StoryPracticeContinuationPort<TContinueInput, TBlock> {
  continue(
    ownerId: string,
    input: TContinueInput
  ): Promise<{ replayed: boolean; block: TBlock | null }>;
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
