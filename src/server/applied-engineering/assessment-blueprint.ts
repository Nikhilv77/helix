import {
  APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
  APPLIED_ENGINEERING_ASSESSMENT_SCHEMA_VERSION,
  appliedEngineeringAssessmentSnapshotSchema,
  type AppliedEngineeringAssessmentSnapshot
} from "@/lib/practice/applied-engineering/assessment-contracts";
import { appliedEngineeringIncidentSelectionSchema } from "@/lib/practice/applied-engineering/focus-ranking-contracts";
import { appliedEngineeringQuestionSchema } from "@/lib/practice/applied-engineering/question-contracts";

type BlueprintQuestion = {
  id: string;
  order: number;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  contentFingerprint: string;
  privateSnapshot: unknown;
  attempts: Array<{ score: number | null; verificationStatus: string }>;
};

export function buildAppliedEngineeringAssessmentSnapshot(input: {
  blockContentFingerprint: string;
  selectionSnapshot: unknown;
  questions: BlueprintQuestion[];
  preparedAt: Date;
}): AppliedEngineeringAssessmentSnapshot {
  const selection = appliedEngineeringIncidentSelectionSchema.parse(input.selectionSnapshot);
  const questions = input.questions
    .map((row) => ({ row, question: appliedEngineeringQuestionSchema.parse(row.privateSnapshot) }))
    .sort((left, right) => left.row.order - right.row.order);
  if (questions.length !== 8 || questions.some(({ row }) => row.status === "ACTIVE")) {
    throw new Error("An Applied Engineering assessment requires eight terminal questions");
  }
  const weakest = [...questions].sort((left, right) => weakness(right.row) - weakness(left.row) || left.row.order - right.row.order)[0]!;
  const executable = questions.find(({ question }) => question.format === "debug-repair" || question.format === "micro-implementation")!;
  const diagnosis = questions.find(({ question }) => question.format === "artifact-diagnosis") ?? questions[1]!;
  const production = questions[7]!;
  const prompts: AppliedEngineeringAssessmentSnapshot["prompts"] = [
    prompt("review-weak-response", 1, "evidence-defence", `Revisit incident question ${weakest.row.order}. Correct the answer, cite the strongest evidence, and state the customer or reliability consequence.`, weakest, "practice-evidence"),
    prompt("defend-repair", 2, "repair-defence", `Defend the repair from question ${executable.row.order}. Explain the invariant it restores, the dangerous edge case, and what the executable tests prove.`, executable, "accepted-run-required"),
    prompt("unseen-diagnosis", 3, "unseen-diagnosis-transfer", `A related production symptom appears in another service. Describe the first evidence to inspect, the likely failure path, and one plausible alternative.`, diagnosis, "practice-evidence"),
    prompt("verification-transfer", 4, "verification-transfer", `Write precise pseudocode or a test plan that proves the ${selection.selectedIncident.title} repair under a race, retry, or load edge case.`, executable, "accepted-run-required"),
    prompt("rollout-defence", 5, "rollout-defence", `Explain how you would safely ship the ${selection.selectedIncident.title} fix: success signals, rollback trigger, and bounded overload behavior.`, production, "practice-evidence")
  ];
  return appliedEngineeringAssessmentSnapshotSchema.parse({
    schemaVersion: APPLIED_ENGINEERING_ASSESSMENT_SCHEMA_VERSION,
    blueprintVersion: APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION,
    preparedAt: input.preparedAt.toISOString(),
    blockContentFingerprint: input.blockContentFingerprint,
    sourceSelection: selection,
    prompts
  });
}

function prompt(
  id: string,
  order: number,
  kind: AppliedEngineeringAssessmentSnapshot["prompts"][number]["kind"],
  text: string,
  source: { row: BlueprintQuestion; question: ReturnType<typeof appliedEngineeringQuestionSchema.parse> },
  deterministicEvidence: "accepted-run-required" | "practice-evidence" | "none"
) {
  return {
    id,
    order,
    kind,
    prompt: text,
    context: `${source.question.artifact.title}: ${source.question.artifact.content}`.slice(0, 4_000),
    privateEvaluation: {
      sourceQuestionId: source.row.id,
      sourceQuestionFingerprint: source.row.contentFingerprint,
      expectedAnswer: `${source.question.answer.concise}\n${source.question.answer.explanation}`.slice(0, 4_000),
      rubric: source.question.rubric,
      deterministicEvidence
    }
  };
}

function weakness(question: BlueprintQuestion): number {
  if (question.status === "LEARNED") return 100;
  const verified = question.attempts.find((attempt) => attempt.verificationStatus === "VERIFIED");
  return verified?.score == null ? 50 : 100 - verified.score * 10;
}
