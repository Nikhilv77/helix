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
      stagedPrompt("weak-response-review", story.title, weakest.question.prompt),
      weakest,
      "practice-evidence",
      questions
    ),
    assessmentPrompt(
      "defend-code-evidence",
      2,
      "code-evidence-defence",
      stagedPrompt("code-evidence-defence", story.title, executable.question.prompt),
      executable,
      "accepted-run-required",
      questions
    ),
    assessmentPrompt(
      "diagnose-unseen-transfer",
      3,
      "unseen-diagnosis-transfer",
      stagedPrompt("unseen-diagnosis-transfer", story.title, diagnosis.question.prompt),
      diagnosis,
      "practice-evidence",
      questions
    ),
    assessmentPrompt(
      "repair-transfer-mechanism",
      4,
      "repair-implementation-transfer",
      stagedPrompt("repair-implementation-transfer", story.title, repair.question.prompt),
      repair,
      "accepted-run-required",
      questions
    ),
    assessmentPrompt(
      "prove-and-ship",
      5,
      "production-verification-defence",
      stagedPrompt("production-verification-defence", story.title, production.question.prompt),
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
  const { options, correctOption } = buildOptionsForPrompt(source, allQuestions);

  const starterCode = isCodeTransfer ? requiredStarterCode(source.question) : undefined;
  const runnerContract = isCodeTransfer ? buildRunnerContract(source.question) : undefined;

  const codeSnippet =
    source.question.artifact.kind === "code"
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
      deterministicEvidence,
      ...(isCodeTransfer ? { executableQuestion: source.question } : {})
    }
  };
}

function buildOptionsForPrompt(
  source: {
    row: BlueprintQuestion;
    question: ReturnType<typeof generatedQuestionCandidateSchema.parse>;
  },
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

  // Keep distractors mechanism-local. Unrelated generic architecture statements
  // make the correct answer visually obvious and do not test this scenario.
  const mistakes = (source.question.commonMistakes ?? []).map((m) => bounded(m, 380));
  const relatedQuestions = allQuestions.filter(
    ({ row, question }) =>
      row.id !== source.row.id &&
      (question.topicKeys.some((key) => source.question.topicKeys.includes(key)) ||
        question.mechanismKeys.some((key) => source.question.mechanismKeys.includes(key)))
  );
  const otherMistakes = relatedQuestions
    .flatMap((q) => q.question.commonMistakes ?? [])
    .map((m) => bounded(m, 380));
  const otherConciseAnswers = relatedQuestions.map((q) => bounded(q.question.answer.concise, 380));

  const candidatePool = [...mistakes, ...otherMistakes, ...otherConciseAnswers].filter(
    (item): item is string => Boolean(item) && item !== correct
  );

  const rawDistractors: string[] = [];
  for (const candidate of candidatePool) {
    if (!rawDistractors.includes(candidate)) {
      rawDistractors.push(candidate);
      if (rawDistractors.length === 3) break;
    }
  }
  if (rawDistractors.length === 0) {
    throw new Error("Assessment MCQ requires at least one authored mechanism-local distractor");
  }

  // Stable for a frozen snapshot, but not learnable from question order.
  const optionCount = Math.min(4, rawDistractors.length + 1);
  const targetPos = stableOptionPosition(source.row.contentFingerprint, optionCount);
  const options = [...rawDistractors.slice(0, 3)];
  options.splice(targetPos, 0, correct);

  return { options: options.slice(0, 4), correctOption: targetPos };
}

function stableOptionPosition(fingerprint: string, optionCount: number): number {
  return Number.parseInt(fingerprint.slice(-2), 16) % optionCount;
}

function stagedPrompt(
  kind: CoreTechnicalAssessmentSnapshot["prompts"][number]["kind"],
  storyTitle: string,
  sourcePrompt: string
): string {
  const source = bounded(sourcePrompt, 2_600);
  switch (kind) {
    case "weak-response-review":
      return `Re-evaluate this ${storyTitle} scenario and choose the explanation that correctly connects the governing Node.js mechanism to its production consequence.\n\n${source}`;
    case "code-evidence-defence":
      return `An interviewer challenges the evidence behind this implementation. Choose the statement that most accurately identifies the critical invariant and what the saved tests actually prove.\n\n${source}`;
    case "unseen-diagnosis-transfer":
      return `The same underlying mechanism now appears behind a different service boundary. Choose the diagnostic conclusion best supported by the runtime evidence, including how it rules out a plausible alternative.\n\n${source}`;
    case "repair-implementation-transfer":
      return `Implement the following mechanism repair as an unseen transfer task. Preserve the runtime contract, handle cleanup and failure paths, and make the authored public and hidden tests pass.\n\n${source}`;
    case "production-verification-defence":
      return `Assume the repair is ready for release. Choose the production plan with the strongest verification signal, rollback trigger, and failure containment.\n\n${source}`;
  }
}

function requiredStarterCode(
  question: ReturnType<typeof generatedQuestionCandidateSchema.parse>
): string {
  const starterCode = question.starterCode?.trim();
  if (!starterCode) throw new Error("Assessment transfer requires frozen authored starter code");
  return starterCode;
}

function buildRunnerContract(question: ReturnType<typeof generatedQuestionCandidateSchema.parse>): {
  version: 1;
  functionName: string;
  testCases: unknown[];
} {
  const functionName = exportedFunctionName(question.starterCode) || "solution";
  const publicTests = question.publicTests ?? [];
  const hiddenTests = question.hiddenTests ?? [];
  const allTests = publicTests.concat(hiddenTests);
  if (!question.runnerContract || publicTests.length === 0 || hiddenTests.length === 0) {
    throw new Error("Assessment transfer requires an authored runner and public/hidden tests");
  }
  return {
    version: 1,
    functionName,
    testCases: allTests.map((test, index) => {
      let parsedInput: unknown = test.input;
      try {
        parsedInput = JSON.parse(test.input);
      } catch {
        parsedInput = test.input;
      }
      let parsedExpected: unknown = test.expected;
      try {
        parsedExpected = JSON.parse(test.expected);
      } catch {
        parsedExpected = test.expected;
      }
      return {
        input: test.input,
        expectedOutput: test.expected,
        visible: index < publicTests.length,
        // Display compatibility only. Core execution uses executableQuestion.testCode.
        arguments: [parsedInput],
        expectedValue: parsedExpected
      };
    })
  };
}

function exportedFunctionName(source: string | undefined): string | null {
  if (!source) return null;
  return (
    source.match(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)?.[1] ??
    source.match(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)?.[1] ??
    null
  );
}

function weakness(question: BlueprintQuestion): number {
  if (question.status === "LEARNED") return 100;
  const verified = question.attempts.find((attempt) => attempt.verificationStatus === "VERIFIED");
  return verified?.score === null || verified?.score === undefined ? 50 : 100 - verified.score * 10;
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}
