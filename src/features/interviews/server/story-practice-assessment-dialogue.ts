import { createHash } from "node:crypto";
import type { StoryPracticeAssessmentKind } from "@/features/practice/shared/server/contracts";
import type { InterviewState, QuestionEvaluation } from "./types";

type DialogueState = Pick<InterviewState, "id" | "phase" | "plan" | "questionIndex"> & {
  questionEvaluations?: InterviewState["questionEvaluations"];
};

export type StoryPracticeAssessmentDialogue = {
  openingShape: string;
  expectations: readonly string[];
  transitions: readonly string[];
  closingLines: readonly string[];
  teachingPrefix: string;
};

const CORE_TECHNICAL_DIALOGUE: StoryPracticeAssessmentDialogue = {
  openingShape:
    "We’ll work through five focused prompts from the path you just practised: first your saved evidence, then diagnosis and repair, and finally a production decision.",
  expectations: [
    "Think out loud. I’ll ask one useful follow-up when a mechanism or piece of evidence needs sharpening, and I’ll leave you with the point to carry forward.",
    "Explain the mechanism as if this were a real technical interview. I may pressure-test one detail, then I’ll teach back the key point before we move on.",
    "Use the evidence on screen and be explicit about cause and effect. I’ll help tighten the reasoning as we go."
  ],
  transitions: [
    "Let’s take that into the next prompt.",
    "Now let’s test the same depth from another angle.",
    "All right, here’s the next part."
  ],
  closingLines: [
    "That completes the assessment. Thanks for reasoning it through with me—your block feedback will be ready shortly.",
    "That’s the full round. Thanks for making the evidence explicit; your scores and next focus will be ready shortly.",
    "We’ve covered everything I wanted to test. Your block report will be ready shortly."
  ],
  teachingPrefix: "The point to carry forward is this:"
};

const APPLIED_ENGINEERING_DIALOGUE: StoryPracticeAssessmentDialogue = {
  openingShape:
    "We’ll work through five focused prompts from the incident you just practised: establish the production signal, defend the repair and verification, then finish with a safe rollout decision.",
  expectations: [
    "Think like the engineer on call. Start with observable evidence, state the blast radius, and separate the likely cause from plausible alternatives.",
    "Defend the smallest safe repair and the deterministic evidence that proves it. I may pressure-test one boundary before we move on.",
    "Be explicit about failure boundaries, rollout signals, and rollback thresholds. I’ll help tighten the production reasoning as we go."
  ],
  transitions: [
    "Let’s carry that evidence into the next production decision.",
    "Now let’s pressure-test the repair from another boundary.",
    "All right, here’s the next part of the incident."
  ],
  closingLines: [
    "That completes the assessment. Thanks for making the production evidence explicit—your incident feedback will be ready shortly.",
    "That’s the full round. Your diagnosis, delivery scores, and next focus will be ready shortly.",
    "We’ve covered the incident from signal through rollout. Your report will be ready shortly."
  ],
  teachingPrefix: "The production point to carry forward is this:"
};

const ARCHITECTURE_DESIGN_DIALOGUE: StoryPracticeAssessmentDialogue = {
  openingShape:
    "We’ll work through five focused prompts from the design scenario you just practised: frame the requirements and scale, define the contracts and data, defend the architecture and failure strategy, then finish with operability and evolution.",
  expectations: [
    "Think out loud. State your assumptions, quantify the important constraint, and make the trade-off explicit. I may pressure-test one boundary before we move on.",
    "Treat this like a real system-design interview. Trace the request and data flow, identify the failure boundary, and defend why the design fits the stated scale.",
    "Use the scenario evidence on screen. Be precise about consistency, reliability, security, and operational consequences; I’ll help sharpen one missing detail when useful."
  ],
  transitions: [
    "Let’s carry those constraints into the next design decision.",
    "Now let’s pressure-test the system at the next boundary.",
    "All right, here’s the next part of the design."
  ],
  closingLines: [
    "That completes the assessment. Thanks for making the architecture trade-offs explicit—your design feedback will be ready shortly.",
    "That’s the full round. Your system-design scores and next focus will be ready shortly.",
    "We’ve covered the design from requirements through evolution. Your report will be ready shortly."
  ],
  teachingPrefix: "The design point to carry forward is this:"
};

export function storyPracticeAssessmentDialogue(
  practice: StoryPracticeAssessmentKind
): StoryPracticeAssessmentDialogue {
  if (practice === "applied-engineering") return APPLIED_ENGINEERING_DIALOGUE;
  if (practice === "architecture-design") return ARCHITECTURE_DESIGN_DIALOGUE;
  return CORE_TECHNICAL_DIALOGUE;
}

export function storyPracticeAssessmentOpening(
  state: DialogueState,
  dialogue: StoryPracticeAssessmentDialogue
): string {
  const first = state.plan[0];
  const greeting = stableChoice(state.id, "opening:greeting", [
    "Hi—good to see you.",
    "Hey, welcome in.",
    "Hi. Take a second to settle in."
  ]);
  const expectation = stableChoice(state.id, "opening:expectation", dialogue.expectations);
  return joinSpoken(greeting, dialogue.openingShape, expectation, first?.text);
}

export function storyPracticeAssessmentMoveOnUtterance(
  state: DialogueState,
  acknowledgement: string,
  dialogue: StoryPracticeAssessmentDialogue
): string {
  const completedIndex = state.questionIndex - 1;
  const evaluation = state.questionEvaluations?.[String(completedIndex)];
  const teaching = teachingFeedback(evaluation, dialogue.teachingPrefix);

  if (state.phase === "done" || state.phase === "wrap") {
    return joinSpoken(
      acknowledgement,
      teaching,
      stableChoice(state.id, "closing", dialogue.closingLines)
    );
  }

  const next = state.plan[state.questionIndex];
  if (!next) return joinSpoken(acknowledgement, teaching, "That completes the assessment.");
  return joinSpoken(
    acknowledgement,
    teaching,
    stableChoice(state.id, `transition:${state.questionIndex}`, dialogue.transitions),
    next.text
  );
}

function teachingFeedback(
  evaluation: QuestionEvaluation | undefined,
  teachingPrefix: string
): string | null {
  if (!evaluation || evaluation.source === "evaluation-unavailable") return null;
  const summary = sentence(evaluation.summary);
  const gap = evaluation.gaps.find((item) => item.trim().length > 0);
  if (gap) return `${teachingPrefix} ${summary} Strengthen this next time: ${sentence(gap)}`;
  const strength = evaluation.strengths.find((item) => item.trim().length > 0);
  return strength
    ? `${teachingPrefix} ${summary} ${sentence(strength)}`
    : `${teachingPrefix} ${summary}`;
}

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

function sentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
