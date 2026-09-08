import { createHash } from "node:crypto";

export type StoryPracticeWork =
  | { kind: "choice"; selectedChoiceIndex: number }
  | { kind: "text"; text: string }
  | { kind: "code"; code: string; runId?: string };

type QuestionContract = {
  format: string;
  choices?: readonly string[];
};

type WorkContractErrors = {
  format(): Error;
  choice(): Error;
};

export function assertStoryPracticeWorkMatchesQuestion(
  question: QuestionContract,
  work: StoryPracticeWork | null,
  errors: WorkContractErrors,
  executableFormats: ReadonlySet<string> = new Set(["debug-repair", "micro-implementation"])
): void {
  if (work === null) return;
  const executable = executableFormats.has(question.format);
  if (question.format === "mcq" && work.kind !== "choice") throw errors.format();
  if (executable && work.kind !== "code") throw errors.format();
  if (question.format !== "mcq" && !executable && work.kind !== "text") {
    throw errors.format();
  }
  if (
    work.kind === "choice" &&
    question.choices &&
    work.selectedChoiceIndex >= question.choices.length
  ) {
    throw errors.choice();
  }
}

export function assertStoryPracticeHintOrder(
  currentHintCount: number,
  requestedHintNumber: number,
  outOfOrder: () => Error
): void {
  if (requestedHintNumber > currentHintCount + 1) throw outOfOrder();
}

export function assertStoryPracticeAttemptReplay(
  attempt: { blockQuestionId: string; workFingerprint: string },
  expected: { questionId: string; workFingerprint: string },
  conflict: () => Error
): void {
  if (
    attempt.blockQuestionId !== expected.questionId ||
    attempt.workFingerprint !== expected.workFingerprint
  ) {
    throw conflict();
  }
}

export function assertStoryPracticeRunReplay(
  run: { blockQuestionId: string; codeFingerprint: string },
  expected: { questionId: string; codeFingerprint: string },
  conflict: () => Error
): void {
  if (
    run.blockQuestionId !== expected.questionId ||
    run.codeFingerprint !== expected.codeFingerprint
  ) {
    throw conflict();
  }
}

export function assertStoryPracticeRunBinding(
  run: { contentFingerprint: string; codeFingerprint: string } | null,
  expected: { contentFingerprint: string; codeFingerprint: string },
  conflict: () => Error
): asserts run is { contentFingerprint: string; codeFingerprint: string } {
  if (
    !run ||
    run.contentFingerprint !== expected.contentFingerprint ||
    run.codeFingerprint !== expected.codeFingerprint
  ) {
    throw conflict();
  }
}

export function storyPracticeFingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableStoryPracticeStringify(value)).digest("hex")}`;
}

export function stableStoryPracticeStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStoryPracticeStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStoryPracticeStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const STORY_PRACTICE_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 120_000
} as const;
