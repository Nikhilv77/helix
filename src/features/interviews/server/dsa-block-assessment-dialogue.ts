import { createHash } from "node:crypto";
import type { InterviewState, PlannedQuestion } from "./types";

type AssessmentDialogueState = Pick<InterviewState, "id" | "phase" | "plan" | "questionIndex">;

/**
 * Natural variation for a durable interview must survive retries and resumes.
 * A session-scoped hash gives each assessment its own voice without making an
 * idempotent answer return different words on replay.
 */
function stableChoice<T>(sessionId: string, moment: string, choices: readonly T[]): T {
  const digest = createHash("sha256").update(`${sessionId}:${moment}`).digest();
  return choices[digest.readUInt32BE(0) % choices.length]!;
}

function joinSpoken(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function dsaBlockAssessmentOpening(state: AssessmentDialogueState): string {
  const first = state.plan[0];
  const reviewCount = state.plan.filter((question) => question.stage === "rapid").length;
  const transferCount = state.plan.filter((question) => question.stage === "code").length;
  const greeting = stableChoice(state.id, "opening:greeting", [
    "Hi—good to meet you.",
    "Hey, welcome in.",
    "Hi. Take a second to settle in.",
    "Hey. We can keep this conversational."
  ]);
  const shape = stableChoice(state.id, "opening:shape", [
    `We’ll start with ${reviewCount} quick reads of code you’ve already submitted, then work through ${transferCount} fresh problems.`,
    `First I’ll ask ${reviewCount} short questions about your saved solutions. After that, we’ll solve ${transferCount} new problems together.`,
    `We’ll use your own code for a ${reviewCount}-question review, then switch to ${transferCount} unseen coding problems.`
  ]);
  const expectation = stableChoice(state.id, "opening:expectation", [
    "Talk through your reasoning when we reach the editor; I may ask about a trade-off or edge case.",
    "Once we start coding, think out loud so I can follow the decisions you’re making.",
    "For the coding part, I care about the reasoning as much as the final implementation."
  ]);
  const handoff = stableChoice(state.id, "opening:first-question", [
    "Let’s begin with something from your own code.",
    "We’ll start with a saved submission.",
    "All right, first let’s look at your code."
  ]);

  return joinSpoken(greeting, shape, expectation, first ? handoff : null, first?.text);
}

export function dsaBlockAssessmentReviewFeedback(input: {
  sessionId: string;
  questionIndex: number;
  correct: boolean;
  explanation?: string;
  correctAnswer?: string;
}): string {
  const moment = `review-feedback:${input.questionIndex}:${input.correct ? "correct" : "incorrect"}`;
  const lead = input.correct
    ? stableChoice(input.sessionId, moment, [
        "Yes—that’s the right read.",
        "Exactly.",
        "That’s the right conclusion.",
        "Yes, that’s what the code shows."
      ])
    : stableChoice(input.sessionId, moment, [
        input.correctAnswer ? `The stronger answer here is ${input.correctAnswer}.` : "Not quite.",
        input.correctAnswer
          ? `Here, the answer is ${input.correctAnswer}.`
          : "That one doesn’t hold here.",
        input.correctAnswer
          ? `For this submission, ${input.correctAnswer} is the grounded answer.`
          : "The saved evidence points another way."
      ]);

  return joinSpoken(lead, input.explanation);
}

/** Adds the small handoffs a human interviewer naturally makes between tasks. */
export function dsaBlockAssessmentMoveOnUtterance(
  state: AssessmentDialogueState,
  acknowledgement: string
): string {
  if (state.phase === "done" || state.phase === "wrap") {
    const closing = stableChoice(state.id, "closing", [
      "That’s the full assessment. Thanks for walking me through your decisions—your feedback will be ready shortly.",
      "We’ve covered everything I wanted to see. Thanks for thinking out loud with me; your feedback will be ready shortly.",
      "That completes the round. Thanks for the conversation—your feedback will be ready shortly."
    ]);
    return joinSpoken(acknowledgement, closing);
  }

  const next = state.plan[state.questionIndex];
  if (!next) {
    return joinSpoken(acknowledgement, "That completes the assessment. Thanks for your time.");
  }

  const previous = state.plan[state.questionIndex - 1];
  const bridge = transitionBridge(state.id, state.questionIndex, previous, next);
  return joinSpoken(acknowledgement, bridge, next.text);
}

function transitionBridge(
  sessionId: string,
  nextIndex: number,
  previous: PlannedQuestion | undefined,
  next: PlannedQuestion
): string {
  if (previous?.stage === "rapid" && next.stage === "code") {
    return stableChoice(sessionId, `transition:${nextIndex}:transfer`, [
      "That closes the review portion. Let’s move into live problem solving.",
      "All right, we’re done reviewing the saved code. Let’s switch to a fresh problem.",
      "That’s the quick review finished. Now I want to see how you approach something new."
    ]);
  }

  if (previous?.stage === "code" && next.stage === "code") {
    return stableChoice(sessionId, `transition:${nextIndex}:second-transfer`, [
      "Okay. Let’s change context once more.",
      "That gives me what I need there. We have one more problem.",
      "All right. Let’s use the last problem to test a different angle."
    ]);
  }

  if (previous?.stage === "rapid" && next.stage === "rapid") {
    return stableChoice(sessionId, `transition:${nextIndex}:review`, [
      "Let’s stay with your code for another one.",
      "Here’s another detail from a saved solution.",
      "Let’s check one more decision in the code.",
      "Now look at this next excerpt."
    ]);
  }

  return "";
}
