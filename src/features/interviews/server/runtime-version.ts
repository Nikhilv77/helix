export const INTERVIEW_ENGINE_VERSION = "2026-09-15.7";
export const INTERVIEW_PLANNER_PROMPT_VERSION = "planner-v3";
export const INTERVIEW_DECIDER_PROMPT_VERSION = "decider-v10-candidate-dialogue";
export const INTERVIEW_EVALUATOR_PROMPT_VERSION = "evaluator-v7-targeted-hundred-point-scale";

export interface InterviewRuntimeVersion {
  engine: string;
  plannerPrompt: string;
  deciderPrompt: string;
  evaluatorPrompt: string;
}

export const CURRENT_INTERVIEW_RUNTIME: InterviewRuntimeVersion = Object.freeze({
  engine: INTERVIEW_ENGINE_VERSION,
  plannerPrompt: INTERVIEW_PLANNER_PROMPT_VERSION,
  deciderPrompt: INTERVIEW_DECIDER_PROMPT_VERSION,
  evaluatorPrompt: INTERVIEW_EVALUATOR_PROMPT_VERSION
});
