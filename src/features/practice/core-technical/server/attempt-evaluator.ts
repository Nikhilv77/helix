import { evaluateWrittenPracticeAnswer } from "@/features/practice/shared/server/written-answer-evaluator";
import {
  coreTechnicalAttemptFeedbackSchema,
  type CoreTechnicalAttemptFeedback,
  type CoreTechnicalAttemptWork
} from "@/features/practice/core-technical/domain/practice-contracts";
import type { GeneratedQuestionCandidate } from "@/features/practice/core-technical/domain/question-contracts";
import type { AiService } from "@/server/ai/ai.service";
import type { CoreTechnicalRunResult } from "./runner-contracts";

type AttemptEvaluation = {
  feedback: CoreTechnicalAttemptFeedback;
  complete: boolean;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
};

/**
 * Evaluates one frozen question without changing lifecycle state. MCQ and code
 * evidence remain deterministic; the model is used only for bounded semantic
 * feedback on typed/spoken answers.
 */
export class CoreTechnicalAttemptEvaluator {
  constructor(private readonly ai: Pick<AiService, "generateStructured">) {}

  async evaluate(
    question: GeneratedQuestionCandidate,
    work: CoreTechnicalAttemptWork,
    run: CoreTechnicalRunResult | null
  ): Promise<AttemptEvaluation> {
    if (work.kind === "choice") return evaluateChoice(question, work.selectedChoiceIndex);
    if (work.kind === "code") return evaluateCode(question, run);

    const feedback = await evaluateWrittenPracticeAnswer(
      this.ai,
      question,
      work.text,
      "core-technical.practice.attempt"
    );
    return { feedback, complete: true, verificationStatus: "VERIFIED" };
  }
}

function evaluateChoice(
  question: GeneratedQuestionCandidate,
  selectedChoiceIndex: number
): AttemptEvaluation {
  const correct = selectedChoiceIndex === question.answer.correctChoiceIndex;
  const feedback = coreTechnicalAttemptFeedbackSchema.parse({
    schemaVersion: 1,
    score: correct ? 10 : 0,
    result: bounded(
      correct
        ? "That conclusion is correct."
        : `That choice is not correct. ${question.answer.concise}`,
      500
    ),
    mechanism: bounded(question.answer.explanation, 700),
    didWell: correct
      ? "You read the code correctly and chose the right result."
      : "You gave a clear answer, so it is easy to see where the reasoning went off track.",
    missingOrIncorrect: bounded(
      correct
        ? "Your reasoning is correct. Nothing needs to be fixed here."
        : (question.commonMistakes[0] ??
            "The selected choice does not follow from the runtime behavior."),
      700
    ),
    productionConsequence: consequence(question),
    transferExample: bounded(
      `For a similar question, use the same idea: ${question.answer.explanation}`,
      500
    ),
    interviewerFollowUp: bounded(question.interviewerFollowUps[0]!, 500),
    missedEdgeCases: []
  });
  return { feedback, complete: true, verificationStatus: "VERIFIED" };
}

function evaluateCode(
  question: GeneratedQuestionCandidate,
  run: CoreTechnicalRunResult | null
): AttemptEvaluation {
  if (!run) throw new Error("A frozen code run is required to evaluate executable work");
  const missed = run.publicTests
    .filter((test) => !test.passed)
    .map((test) => test.name)
    .slice(0, 5);
  const feedback = coreTechnicalAttemptFeedbackSchema.parse({
    schemaVersion: 1,
    score: run.accepted ? 10 : 0,
    result: run.accepted
      ? "The submitted code passed every public and hidden test."
      : run.status === "tests-failed"
        ? "The submitted code still fails deterministic tests."
        : `The submitted code did not complete successfully (${run.status}).`,
    mechanism: bounded(question.answer.explanation, 700),
    didWell: run.accepted
      ? "Your code handled all of the tested cases correctly."
      : "You ran the exact code you submitted, which gives us a clear failure to work from.",
    missingOrIncorrect: bounded(
      run.accepted
        ? "Your solution is correct for all of the tested cases."
        : (question.commonMistakes[0] ?? "The code does not yet produce the required result."),
      700
    ),
    productionConsequence: consequence(question),
    transferExample: bounded(
      `For a similar question, use the same idea: ${question.answer.explanation}`,
      500
    ),
    interviewerFollowUp: bounded(question.interviewerFollowUps[0]!, 500),
    missedEdgeCases: missed
  });
  return { feedback, complete: run.accepted, verificationStatus: "VERIFIED" };
}

function consequence(question: GeneratedQuestionCandidate): string {
  const mistake = question.commonMistakes[0];
  return bounded(
    mistake
      ? `In production, this misunderstanding can cause subtle bugs. ${mistake}`
      : `In production, this can make the code behave differently from what you expect.`,
    500
  );
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}
