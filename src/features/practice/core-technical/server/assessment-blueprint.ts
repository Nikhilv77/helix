import {
  CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION,
  CORE_TECHNICAL_ASSESSMENT_SCHEMA_VERSION,
  coreTechnicalAssessmentSnapshotSchema,
  type CoreTechnicalAssessmentSnapshot
} from "@/features/practice/core-technical/domain/assessment-contracts";
import { generatedQuestionCandidateSchema } from "@/features/practice/core-technical/domain/question-contracts";
import { selectedStorySchema } from "@/features/practice/core-technical/domain/story-contracts";
import { coreTechnicalPracticePathPresentation } from "@/features/practice/core-technical/domain/practice-path-presentation";

type BlueprintQuestion = {
  id: string;
  order: number;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  contentFingerprint: string;
  privateSnapshot: unknown;
  attempts: Array<{ score: number | null; verificationStatus: string }>;
};

export function buildCoreTechnicalAssessmentSnapshot(input: {
  blockContentFingerprint: string;
  storySnapshot: unknown;
  questions: BlueprintQuestion[];
  preparedAt: Date;
}): CoreTechnicalAssessmentSnapshot {
  const story = coreTechnicalPracticePathPresentation(
    selectedStorySchema.parse(input.storySnapshot)
  );
  const questions = input.questions
    .map((row) => ({ row, question: generatedQuestionCandidateSchema.parse(row.privateSnapshot) }))
    .sort((left, right) => left.row.order - right.row.order);
  if (![6, 8].includes(questions.length) || questions.some(({ row }) => row.status === "ACTIVE")) {
    throw new Error(
      "A Core Technical assessment requires six new or eight legacy terminal frozen questions"
    );
  }
  const weakest = [...questions].sort(
    (left, right) => weakness(right.row) - weakness(left.row) || left.row.order - right.row.order
  )[0]!;
  const executable = questions.find(
    ({ question }) =>
      question.format === "debug-repair" || question.format === "micro-implementation"
  )!;
  const diagnosis =
    questions.find(({ question }) => question.format === "artifact-diagnosis") ?? questions[4]!;
  const repair =
    questions.find(({ question }) => question.format === "micro-implementation") ?? executable;
  const production = questions.at(-1)!;

  const prompts: CoreTechnicalAssessmentSnapshot["prompts"] = [
    assessmentPrompt(
      "revisit-weak-response",
      1,
      "weak-response-review",
      weakest.question.prompt ||
        `Review the core runtime mechanism from ${story.title}. Which statement correctly explains the underlying system behavior and its production impact?`,
      weakest,
      "practice-evidence",
      questions
    ),
    assessmentPrompt(
      "defend-code-evidence",
      2,
      "code-evidence-defence",
      executable.question.prompt ||
        `Defend the implementation decisions for ${executable.question.artifact.title || story.title}. Which invariant or boundary condition is most critical to ensure resilience?`,
      executable,
      "accepted-run-required",
      questions
    ),
    assessmentPrompt(
      "diagnose-unseen-transfer",
      3,
      "unseen-diagnosis-transfer",
      diagnosis.question.prompt ||
        `A downstream service experiences unexpected degradation under similar runtime conditions. How would you systematically diagnose the root cause and isolate the fault?`,
      diagnosis,
      "practice-evidence",
      questions
    ),
    assessmentPrompt(
      "repair-transfer-mechanism",
      4,
      "repair-implementation-transfer",
      repair.question.prompt ||
        `Implement a clean, non-blocking mechanism repair in the editor. Ensure edge cases and error boundaries are properly handled.`,
      repair,
      "accepted-run-required",
      questions
    ),
    assessmentPrompt(
      "prove-and-ship",
      5,
      "production-verification-defence",
      production.question.prompt ||
        `How would you verify and safely ship this repair to production? Consider testing strategy, observability signals, and rollback criteria.`,
      production,
      "practice-evidence",
      questions
    )
  ];

  return coreTechnicalAssessmentSnapshotSchema.parse({
    schemaVersion: CORE_TECHNICAL_ASSESSMENT_SCHEMA_VERSION,
    blueprintVersion: CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION,
    preparedAt: input.preparedAt.toISOString(),
    blockContentFingerprint: input.blockContentFingerprint,
    prompts
  });
}

function assessmentPrompt(
  id: string,
  order: number,
  kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"],
  prompt: string,
  source: {
    row: BlueprintQuestion;
    question: ReturnType<typeof generatedQuestionCandidateSchema.parse>;
  },
  deterministicEvidence: "accepted-run-required" | "practice-evidence" | "none",
  allQuestions: Array<{
    row: BlueprintQuestion;
    question: ReturnType<typeof generatedQuestionCandidateSchema.parse>;
  }>
): CoreTechnicalAssessmentSnapshot["prompts"][number] {
  const isCodeTransfer = kind === "repair-implementation-transfer";
  const { options, correctOption } = buildOptionsForPrompt(source, kind, allQuestions);

  const starterCode = isCodeTransfer
    ? source.question.starterCode?.trim() || defaultStarterCode(source.question)
    : undefined;
  const runnerContract = isCodeTransfer
    ? buildRunnerContract(source.question)
    : undefined;

  const codeSnippet = source.question.artifact.kind === "code"
    ? source.question.artifact.content.slice(0, 1_600)
    : source.question.starterCode
      ? source.question.starterCode.slice(0, 1_600)
      : undefined;

  return {
    id,
    order,
    kind,
    prompt,
    context: bounded(
      `${source.question.artifact.title}: ${source.question.artifact.content}`,
      4_000
    ),
    codeSnippet: codeSnippet ? bounded(codeSnippet, 1_600) : null,
    options: isCodeTransfer ? undefined : options,
    correctOption: isCodeTransfer ? undefined : correctOption,
    rationale: source.question.answer.explanation
      ? bounded(source.question.answer.explanation, 2_000)
      : undefined,
    codeTask: isCodeTransfer
      ? bounded(
          source.question.prompt +
            "\n\nImplement the repair cleanly. Handle error boundaries and adhere to non-blocking runtime behavior.",
          3_000
        )
      : undefined,
    starterCode,
    runnerContract,
    privateEvaluation: {
      sourceQuestionId: source.row.id,
      sourceQuestionFingerprint: source.row.contentFingerprint,
      expectedAnswer: bounded(
        `${source.question.answer.concise}\n${source.question.answer.explanation}`,
        4_000
      ),
      rubric: source.question.rubric,
      deterministicEvidence
    }
  };
}

function buildOptionsForPrompt(
  source: {
    row: BlueprintQuestion;
    question: ReturnType<typeof generatedQuestionCandidateSchema.parse>;
  },
  kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"],
  allQuestions: Array<{
    row: BlueprintQuestion;
    question: ReturnType<typeof generatedQuestionCandidateSchema.parse>;
  }>
): { options: string[]; correctOption: number } {
  const correct = bounded(source.question.answer.concise, 380);

  // If question already has authored choices, use them directly
  if (source.question.choices && source.question.choices.length >= 2) {
    const rawOptions = source.question.choices.slice(0, 4).map((c) => bounded(c, 380));
    const correctOption = Math.min(
      source.question.answer.correctChoiceIndex ?? 0,
      rawOptions.length - 1
    );
    return { options: rawOptions, correctOption };
  }

  // Harvest distractors dynamically from this question and other questions in the story block
  const mistakes = (source.question.commonMistakes ?? []).map((m) => bounded(m, 380));
  const otherMistakes = allQuestions
    .filter((q) => q.row.id !== source.row.id)
    .flatMap((q) => q.question.commonMistakes ?? [])
    .map((m) => bounded(m, 380));
  const otherConciseAnswers = allQuestions
    .filter((q) => q.row.id !== source.row.id)
    .map((q) => bounded(q.question.answer.concise, 380));
  const universalFallbacks = universalArchitecturalDistractors();

  const candidatePool = [
    ...mistakes,
    ...otherMistakes,
    ...otherConciseAnswers,
    ...universalFallbacks
  ].filter((item): item is string => Boolean(item) && item !== correct);

  const rawDistractors: string[] = [];
  for (const candidate of candidatePool) {
    if (!rawDistractors.includes(candidate)) {
      rawDistractors.push(candidate);
      if (rawDistractors.length === 3) break;
    }
  }

  // Place correct option deterministically between 0 and 3 based on row order
  const targetPos = (source.row.order + 1) % 4;
  const options = [...rawDistractors.slice(0, 3)];
  options.splice(targetPos, 0, correct);

  return { options: options.slice(0, 4), correctOption: targetPos };
}

function universalArchitecturalDistractors(): string[] {
  return [
    "The execution path silently swallows rejected operations without recording telemetry or alerting callers.",
    "Synchronous processing of unbounded payloads causes thread starvation under concurrent workload spikes.",
    "State mutations bypass transactional isolation boundaries, risking cross-request data corruption.",
    "Resource disposal and connection teardown are bypassed on abnormal termination pathways."
  ];
}

function defaultStarterCode(question: ReturnType<typeof generatedQuestionCandidateSchema.parse>): string {
  const functionName = question.runnerContract?.entrypoint || "solution";
  return `/**
 * Core Technical Mechanism Repair
 * Implement a clean, non-blocking repair satisfying the boundary constraints.
 */
function ${functionName}(input) {
  // Your implementation here
  return input;
}

module.exports = { ${functionName} };
`;
}

function buildRunnerContract(
  question: ReturnType<typeof generatedQuestionCandidateSchema.parse>
): { version: 1; functionName: string; testCases: unknown[] } {
  const functionName = question.runnerContract?.entrypoint || "solution";
  const allTests = (question.publicTests ?? []).concat(question.hiddenTests ?? []);
  if (allTests.length > 0) {
    return {
      version: 1,
      functionName,
      testCases: allTests.map((test) => {
        let parsedInput: unknown = test.input;
        try {
          parsedInput = JSON.parse(test.input);
        } catch {
          parsedInput = test.input || {};
        }
        let parsedExpected: unknown = test.expected;
        try {
          parsedExpected = JSON.parse(test.expected);
        } catch {
          parsedExpected = test.expected || true;
        }
        return {
          input: test.input || "{}",
          expectedOutput: test.expected || "true",
          visible: true,
          arguments: [parsedInput],
          expectedValue: parsedExpected
        };
      })
    };
  }

  return {
    version: 1,
    functionName,
    testCases: [
      {
        input: "{ valid: true }",
        expectedOutput: "true",
        visible: true,
        arguments: [{ valid: true }],
        expectedValue: true
      },
      {
        input: "{ valid: false }",
        expectedOutput: "false",
        visible: false,
        arguments: [{ valid: false }],
        expectedValue: false
      }
    ]
  };
}

function weakness(question: BlueprintQuestion): number {
  if (question.status === "LEARNED") return 100;
  const verified = question.attempts.find((attempt) => attempt.verificationStatus === "VERIFIED");
  return verified?.score === null || verified?.score === undefined ? 50 : 100 - verified.score * 10;
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}

