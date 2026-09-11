import type { InterviewState } from "./types";
import {
  storyPracticeAssessmentDialogue,
  storyPracticeAssessmentMoveOnUtterance,
  storyPracticeAssessmentOpening
} from "./story-practice-assessment-dialogue";

type DialogueState = Pick<InterviewState, "id" | "phase" | "plan" | "questionIndex"> & {
  questionEvaluations?: InterviewState["questionEvaluations"];
};

const dialogue = storyPracticeAssessmentDialogue("core-technical");

/** Compatibility export for tests and saved Core integrations. */
export function coreTechnicalAssessmentOpening(state: DialogueState): string {
  return storyPracticeAssessmentOpening(state, dialogue);
}

/** Compatibility export for tests and saved Core integrations. */
export function coreTechnicalAssessmentMoveOnUtterance(
  state: DialogueState,
  acknowledgement: string
): string {
  return storyPracticeAssessmentMoveOnUtterance(state, acknowledgement, dialogue);
}
