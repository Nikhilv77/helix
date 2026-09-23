import {
  scoreInteractiveResponse,
  type InteractionCriterion,
  type InteractiveResponse
} from "../domain/interactive-response";
import { storyPracticeAttemptFeedbackSchema } from "../domain/story-practice-contracts";

/** Frozen, deterministic partial credit. No model call and no client-supplied scoring rules. */
export function evaluateInteractiveResponse(
  response: InteractiveResponse,
  criteria: readonly InteractionCriterion[],
  context: { explanation: string; consequence: string; followUp: string }
) {
  if (
    !criteria.length ||
    Math.abs(criteria.reduce((sum, item) => sum + item.points, 0) - 10) > 1e-7
  ) {
    throw new Error("Interactive practice criteria must total ten points");
  }
  const { score, checks } = scoreInteractiveResponse(response, criteria);
  const passed = checks.filter((check) => check.passed);
  const missed = checks.filter((check) => !check.passed);
  return storyPracticeAttemptFeedbackSchema.parse({
    schemaVersion: 1,
    score,
    result: `${passed.length} of ${checks.length} checks met · ${score}/10.`,
    didWell: passed.length
      ? passed
          .map((check) => check.label)
          .join("; ")
          .slice(0, 500)
      : "You committed a decision that can now be checked against the evidence.",
    mechanism: context.explanation.slice(0, 700),
    missingOrIncorrect: missed.length
      ? missed
          .map((check) => check.explanation)
          .join(" ")
          .slice(0, 700)
      : "Your decisions meet every constraint in this case.",
    productionConsequence: context.consequence.slice(0, 500),
    transferExample:
      "Repeat the decision with a changed constraint. Identify which part of your answer must change and which still holds.",
    interviewerFollowUp: context.followUp.slice(0, 500),
    missedEdgeCases: missed.slice(0, 5).map((check) => check.explanation.slice(0, 300))
  });
}
