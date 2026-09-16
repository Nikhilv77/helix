import type { InterviewState, PlannedQuestion } from "./types";

type DialogueState = Pick<InterviewState, "phase" | "plan" | "questionIndex">;

function joinSpoken(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function candidateFacingQuestion(question: PlannedQuestion): string {
  if (question.kind !== "code") return question.text;
  return `${question.text} Use the editor to write your solution. Think out loud while you work, then run or submit it when you're ready for review.`;
}

/** Human-sounding handoffs between the two coding tasks and three design acts. */
export function dsaDesignMoveOnUtterance(state: DialogueState, acknowledgement: string): string {
  if (state.phase === "done" || state.phase === "wrap") {
    return joinSpoken(
      acknowledgement,
      "That completes the DSA and design round. Thanks for thinking through it with me—your report will be ready shortly."
    );
  }

  const next = state.plan[state.questionIndex];
  if (!next) {
    return joinSpoken(
      acknowledgement,
      "That completes the round. Your report will be ready shortly."
    );
  }

  const previous = state.plan[state.questionIndex - 1];
  let bridge = "";
  if (previous?.interviewSection === "dsa" && next.interviewSection === "dsa") {
    bridge = "Good. Let’s switch to a second coding problem and test a different angle.";
  } else if (previous?.interviewSection === "dsa" && next.interviewSection === "design") {
    bridge =
      "That closes the coding portion. Now let’s move into system design: start by framing the problem before choosing components.";
  } else if (previous?.stage === "rapid" && next.stage === "explain") {
    bridge = "Let’s carry those constraints into the architecture.";
  } else if (previous?.stage === "explain" && next.stage === "scenario") {
    bridge = "Now let’s pressure-test that architecture.";
  }

  return joinSpoken(acknowledgement, bridge, candidateFacingQuestion(next));
}
