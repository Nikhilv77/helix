import type { InterviewState, PlannedQuestion } from "./types";

type DialogueState = Pick<InterviewState, "phase" | "plan" | "questionIndex" | "turns">;

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

/** Human-sounding handoffs between the coding tasks and candidate-led design acts. */
export function dsaDesignMoveOnUtterance(state: DialogueState, acknowledgement: string): string {
  const hasDsa = state.plan.some((question) => question.interviewSection === "dsa");
  const hasDesign = state.plan.some((question) => question.interviewSection === "design");
  if (state.phase === "done" || state.phase === "wrap") {
    return joinSpoken(
      acknowledgement,
      hasDsa && hasDesign
        ? "That completes the DSA and design round. Thanks for thinking through it with me—your report will be ready shortly."
        : hasDesign
          ? "That completes the System Design interview. Thanks for evolving the architecture with me—your report will be ready shortly."
          : "That completes the DSA interview. Thanks for working through both problems with me—your report will be ready shortly."
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
  } else if (previous?.stage === "design-frame" && next.stage === "design-canvas") {
    bridge = "Good. Let’s carry the requirements you established into the architecture.";
  } else if (previous?.stage === "design-canvas" && next.stage === "design-deep-dive") {
    bridge = `I want to go deeper on ${designComponentFromLatestAnswer(state)}.`;
  } else if (previous?.stage === "design-deep-dive" && next.stage === "design-pressure") {
    bridge = "Now I’m going to change the operating conditions and pressure-test your design.";
  } else if (previous?.stage === "design-pressure" && next.stage === "design-defend") {
    bridge = "Let’s close by making the trade-offs and remaining risks explicit.";
  }

  return joinSpoken(acknowledgement, bridge, candidateFacingQuestion(next));
}

function designComponentFromLatestAnswer(state: DialogueState): string {
  const answer = state.turns
    .filter((turn) => turn.speaker === "user" && turn.questionIndex === state.questionIndex - 1)
    .map((turn) => turn.text.toLowerCase())
    .join(" ");
  const candidates: Array<[RegExp, string]> = [
    [/\bobject storage\b|\bs3\b/, "the object-storage boundary"],
    [/\bqueue\b|\bstream\b|\bkafka\b/, "the queue and worker boundary"],
    [/\bcdn\b|\bcontent delivery network\b/, "the CDN and origin boundary"],
    [/\bdatabase\b|\bmetadata store\b|\bpostgres/, "the metadata store"],
    [/\bcache\b|\bredis\b/, "the caching layer"],
    [/\bworker\b|\bprocessor\b|\btranscod/, "the processing workers"],
    [/\bapi gateway\b|\bupload api\b|\bservice\b/, "the API boundary"]
  ];
  return candidates.find(([pattern]) => pattern.test(answer))?.[1] ?? "the most stateful boundary";
}
