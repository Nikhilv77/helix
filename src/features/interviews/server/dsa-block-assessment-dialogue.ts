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
  const usesSavedCode = state.plan.some(
    (question) => question.stage === "rapid" && Boolean(question.codeSnippet)
  );
  const greeting = stableChoice(state.id, "opening:greeting", [
    "Hi, and congratulations on completing this practice block.",
    "Nice work completing this question set.",
    "You’ve finished the block. Let’s check how well the ideas have settled in.",
    "Great work getting through the block. This checkpoint will measure what transferred."
  ]);
  const shape = stableChoice(
    state.id,
    "opening:shape",
    usesSavedCode
      ? [
          `You’ll start with ${reviewCount} quick checks grounded in code you already submitted, then solve ${transferCount === 1 ? "one fresh problem" : `${transferCount} fresh problems`}.`,
          `First are ${reviewCount} short questions about your saved solutions. After that comes ${transferCount === 1 ? "one unseen coding problem" : `${transferCount} unseen coding problems`}.`,
          `This uses your own code for a ${reviewCount}-question review, then tests transfer with ${transferCount === 1 ? "one new problem" : `${transferCount} new problems`}.`
        ]
      : [
          `You’ll start with ${reviewCount} focused checks from this block, then solve ${transferCount === 1 ? "one fresh problem" : `${transferCount} fresh problems`}.`,
          `First are ${reviewCount} short questions on the patterns, complexity, and edge cases you practised. After that comes ${transferCount === 1 ? "one unseen coding problem" : `${transferCount} unseen coding problems`}.`,
          `We’ll review the key decisions from this block in ${reviewCount} quick questions, then test transfer with ${transferCount === 1 ? "one new problem" : `${transferCount} new problems`}.`
        ]
  );
  const expectation = stableChoice(state.id, "opening:expectation", [
    "When you reach the editor, run your code and add a short explanation of the approach and complexity.",
    "For the coding part, the implementation, test evidence, and your written reasoning all count.",
    "You do not need to speak. I’ll guide you, and you can answer everything on screen."
  ]);
  const handoff = stableChoice(
    state.id,
    "opening:first-question",
    usesSavedCode
      ? [
          "Let’s begin with something from your own code.",
          "We’ll start with a saved submission.",
          "All right, first let’s look at your code."
        ]
      : [
          "Let’s begin with a pattern decision.",
          "We’ll start with one of the problems from this block.",
          "All right, here’s the first check."
        ]
  );

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
        "Yes, that matches the intended reasoning."
      ])
    : stableChoice(input.sessionId, moment, [
        input.correctAnswer ? `The stronger answer here is ${input.correctAnswer}.` : "Not quite.",
        input.correctAnswer
          ? `Here, the answer is ${input.correctAnswer}.`
          : "That one doesn’t hold here.",
        input.correctAnswer
          ? `The grounded answer here is ${input.correctAnswer}.`
          : "The evidence points another way."
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
      "That’s the full checkpoint. You completed the block review and the transfer problem. I’m preparing your results now, including what went well, what to revisit, and what to practise next.",
      "You’ve completed the checkpoint—nice work. Your results page will break down the review questions, the coding problem, and the most useful next step.",
      "That completes the assessment. Take a breath while I prepare your results. You’ll be able to review your strengths, the concepts that need another pass, and your recommended next problem."
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
      "All right, the quick checks are done. Let’s switch to a fresh problem.",
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
    return stableChoice(
      sessionId,
      `transition:${nextIndex}:review`,
      next.codeSnippet
        ? [
            "Let’s stay with your code for another one.",
            "Here’s another detail from a saved solution.",
            "Let’s check one more decision in the code.",
            "Now look at this next excerpt."
          ]
        : [
            "Let’s test another decision from the block.",
            "Good. Here’s the next reasoning check.",
            "Now let’s shift to another problem you practised.",
            "Let’s keep going with the next concept."
          ]
    );
  }

  return "";
}
