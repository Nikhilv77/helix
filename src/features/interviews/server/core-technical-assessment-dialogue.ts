import { createHash } from "node:crypto";
import type { InterviewState, QuestionEvaluation } from "./types";

type DialogueState = Pick<InterviewState, "id" | "phase" | "plan" | "questionIndex"> & {
  questionEvaluations?: InterviewState["questionEvaluations"];
};

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

export function coreTechnicalAssessmentOpening(state: DialogueState): string {
  const first = state.plan[0];
  const greeting = stableChoice(state.id, "opening:greeting", [
    "Hi—good to see you.",
    "Hey, welcome in.",
    "Hi. Take a second to settle in."
  ]);
  const shape =
    "We’ll work through five focused prompts from the path you just practised: first your saved evidence, then diagnosis and repair, and finally a production decision.";
  const expectation = stableChoice(state.id, "opening:expectation", [
    "Think out loud. I’ll ask one useful follow-up when a mechanism or piece of evidence needs sharpening, and I’ll leave you with the point to carry forward.",
    "Explain the mechanism as if this were a real technical interview. I may pressure-test one detail, then I’ll teach back the key point before we move on.",
    "Use the evidence on screen and be explicit about cause and effect. I’ll help tighten the reasoning as we go."
  ]);
  return joinSpoken(greeting, shape, expectation, first?.text);
}

export function coreTechnicalAssessmentMoveOnUtterance(
  state: DialogueState,
  acknowledgement: string
): string {
  const completedIndex = state.questionIndex - 1;
  const evaluation = state.questionEvaluations?.[String(completedIndex)];
  const teaching = teachingFeedback(evaluation);

  if (state.phase === "done" || state.phase === "wrap") {
    return joinSpoken(
      acknowledgement,
      teaching,
      stableChoice(state.id, "closing", [
        "That completes the assessment. Thanks for reasoning it through with me—your block feedback will be ready shortly.",
        "That’s the full round. Thanks for making the evidence explicit; your scores and next focus will be ready shortly.",
        "We’ve covered everything I wanted to test. Your block report will be ready shortly."
      ])
    );
  }

  const next = state.plan[state.questionIndex];
  if (!next) return joinSpoken(acknowledgement, teaching, "That completes the assessment.");

  const bridge = stableChoice(state.id, `transition:${state.questionIndex}`, [
    "Let’s take that into the next prompt.",
    "Now let’s test the same depth from another angle.",
    "All right, here’s the next part."
  ]);
  return joinSpoken(acknowledgement, teaching, bridge, next.text);
}

function teachingFeedback(evaluation: QuestionEvaluation | undefined): string | null {
  if (!evaluation || evaluation.source === "evaluation-unavailable") return null;
  const summary = sentence(evaluation.summary);
  const gap = evaluation.gaps.find((item) => item.trim().length > 0);
  if (gap)
    return `The point to carry forward is this: ${summary} Strengthen this next time: ${sentence(gap)}`;
  const strength = evaluation.strengths.find((item) => item.trim().length > 0);
  return strength
    ? `The point to carry forward is this: ${summary} ${sentence(strength)}`
    : `The point to carry forward is this: ${summary}`;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
