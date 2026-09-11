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
      `Revisit question ${weakest.row.order} from ${story.title}. Give a corrected direct answer, explain the governing Node.js mechanism, and state the production consequence.`,
      weakest,
      "practice-evidence"
    ),
    assessmentPrompt(
      "defend-code-evidence",
      2,
      "code-evidence-defence",
      `Defend the implementation decision from question ${executable.row.order}. Explain why the repair works, which edge case is most dangerous, and what the saved test evidence does and does not prove.`,
      executable,
      "accepted-run-required"
    ),
    assessmentPrompt(
      "diagnose-unseen-transfer",
      3,
      "unseen-diagnosis-transfer",
      `A different Node.js service now shows a related symptom after the same mechanism is placed behind a new request boundary. Describe the first evidence you would inspect, diagnose the likely failure, and distinguish it from one plausible alternative.`,
      diagnosis,
      "practice-evidence"
    ),
    assessmentPrompt(
      "repair-transfer-mechanism",
      4,
      "repair-implementation-transfer",
      `Write the essential JavaScript or precise pseudocode for a small transfer of the mechanism from question ${repair.row.order}. Include cleanup/error handling and name the deterministic test that should fail before the repair and pass afterward.`,
      repair,
      "accepted-run-required"
    ),
    assessmentPrompt(
      "prove-and-ship",
      5,
      "production-verification-defence",
      `Explain how you would prove and safely ship the ${story.title} fix. Cover tests, one production signal, one rollback trigger, and how you would answer a skeptical interviewer follow-up.`,
      production,
      "practice-evidence"
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
  deterministicEvidence: "accepted-run-required" | "practice-evidence" | "none"
): CoreTechnicalAssessmentSnapshot["prompts"][number] {
  return {
    id,
    order,
    kind,
    prompt,
    context: bounded(
      `${source.question.artifact.title}: ${source.question.artifact.content}`,
      4_000
    ),
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

function weakness(question: BlueprintQuestion): number {
  if (question.status === "LEARNED") return 100;
  const verified = question.attempts.find((attempt) => attempt.verificationStatus === "VERIFIED");
  return verified?.score === null || verified?.score === undefined ? 50 : 100 - verified.score * 10;
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}
