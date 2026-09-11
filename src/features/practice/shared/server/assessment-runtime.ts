import type { InterviewService } from "@/features/interviews/server/interview.service";
import type { InterviewSetup, PlannedQuestion } from "@/features/interviews/server/types";
import {
  storyPracticeAssessmentIdentityFromSetup,
  type StoryPracticeAssessmentIdentity
} from "./contracts";

type RuntimeInput = { assessmentId: string };
type RuntimeRecord = { id: string; blockId: string };
type SavedSession = { ownerId: string; state: unknown };

export type StoryPracticeAssessmentRuntimeConfig<
  TInput extends RuntimeInput,
  TAssessment,
  TSnapshot,
  TRecord extends RuntimeRecord
> = {
  practice: StoryPracticeAssessmentIdentity["practice"];
  parseInput(rawInput: unknown): TInput;
  startAssessment(
    ownerId: string,
    input: TInput,
    options: { allowLocked?: boolean }
  ): Promise<TAssessment>;
  loadRecord(ownerId: string, assessmentId: string): Promise<TRecord | null>;
  parseSnapshot(record: TRecord): TSnapshot;
  findSession(sessionId: string): Promise<SavedSession | null>;
  buildSetup(record: TRecord, snapshot: TSnapshot): InterviewSetup;
  buildPlan(snapshot: TSnapshot): PlannedQuestion[];
  notFound(): Error;
  sessionConflict(): Error;
};

/** Shared replay-safe coordinator for every five-prompt story-practice voice room. */
export class StoryPracticeAssessmentRuntimeCoordinator<
  TInput extends RuntimeInput,
  TAssessment,
  TSnapshot,
  TRecord extends RuntimeRecord
> {
  constructor(
    private readonly interviews: Pick<InterviewService, "start">,
    private readonly config: StoryPracticeAssessmentRuntimeConfig<
      TInput,
      TAssessment,
      TSnapshot,
      TRecord
    >
  ) {}

  async startOrResume(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    const input = this.config.parseInput(rawInput);
    const assessment = await this.config.startAssessment(ownerId, input, options);
    const record = await this.config.loadRecord(ownerId, input.assessmentId);
    if (!record) throw this.config.notFound();
    const snapshot = this.config.parseSnapshot(record);
    const existing = await this.config.findSession(record.id);
    const identity = storyPracticeAssessmentIdentityFromSetup(readSetup(existing?.state));
    if (
      existing &&
      (existing.ownerId !== ownerId ||
        identity?.practice !== this.config.practice ||
        identity.assessmentId !== record.id ||
        identity.blockId !== record.blockId)
    ) {
      throw this.config.sessionConflict();
    }

    const started = await this.interviews.start(
      this.config.buildSetup(record, snapshot),
      ownerId,
      Date.now(),
      this.config.buildPlan(snapshot),
      record.id
    );
    return { assessment, sessionId: started.state.id, created: started.created };
  }
}

function readSetup(state: unknown): StoryPracticeAssessmentSetup | null {
  if (!state || typeof state !== "object" || Array.isArray(state) || !("setup" in state))
    return null;
  const setup = state.setup;
  return setup && typeof setup === "object" && !Array.isArray(setup)
    ? (setup as StoryPracticeAssessmentSetup)
    : null;
}

type StoryPracticeAssessmentSetup = Parameters<typeof storyPracticeAssessmentIdentityFromSetup>[0];
