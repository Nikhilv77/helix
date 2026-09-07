import {
  coreTechnicalAttemptFeedbackSchema,
  type CoreTechnicalAttemptFeedback,
  type CoreTechnicalAttemptWork
} from "@/lib/practice/core-technical/practice-contracts";
import type { GeneratedQuestionCandidate } from "@/lib/practice/core-technical/question-contracts";
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

    const feedback = coreTechnicalAttemptFeedbackSchema.parse(
      await this.ai.generateStructured({
        operation: "core-technical.practice.attempt",
        modelClass: "fast",
        temperature: 0.1,
        schema: coreTechnicalAttemptFeedbackSchema,
        systemInstruction: `You are a strict Node.js interview evaluator. Return only JSON matching the schema. Judge correctness before fluency. Use the frozen answer and rubric, never invent evidence, and keep every field concise. The candidate will be shown this response after submitting, so do not mention hidden rubrics or private source material. Score from 0 to 10. schemaVersion must be 1.`,
        prompt: `Evaluate this genuine Core Technical practice attempt.

Format: ${question.format}
Prompt: ${question.prompt}
Artifact (${question.artifact.kind}):
${question.artifact.content}

Candidate response:
"""
${work.text}
"""

Frozen complete answer:
${question.answer.concise}
${question.answer.explanation}

Rubric (10 points total):
${question.rubric.map((item) => `- ${item.points}: ${item.criterion}`).join("\n")}

Common mistakes:
${question.commonMistakes.map((item) => `- ${item}`).join("\n")}

Interview connection: ${question.interviewConnection}
Likely follow-ups:
${question.interviewerFollowUps.map((item) => `- ${item}`).join("\n")}`
      })
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
    result: bounded(correct ? "That conclusion is correct." : `That choice is not correct. ${question.answer.concise}`, 500),
    mechanism: bounded(question.answer.explanation, 700),
    didWell: correct
      ? "You identified the governing behavior from the evidence."
      : "You committed to a concrete prediction, which makes the misconception diagnosable.",
    missingOrIncorrect: bounded(correct
      ? "No material correction is needed."
      : question.commonMistakes[0] ?? "The selected choice does not follow from the runtime behavior.", 700),
    productionConsequence: consequence(question),
    transferExample: `Apply the same mechanism when reviewing a similar ${question.artifact.kind} in another service.`,
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
  const missed = run.publicTests.filter((test) => !test.passed).map((test) => test.name).slice(0, 5);
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
      ? "Your implementation satisfied the frozen executable contract."
      : "You produced runnable evidence against the exact submitted code.",
    missingOrIncorrect: bounded(run.accepted
      ? "No tested correctness gap remains."
      : question.commonMistakes[0] ?? "The implementation does not yet meet the frozen contract.", 700),
    productionConsequence: consequence(question),
    transferExample: `Use the same repair and verification boundary on a comparable ${question.artifact.kind} path.`,
    interviewerFollowUp: bounded(question.interviewerFollowUps[0]!, 500),
    missedEdgeCases: missed
  });
  return { feedback, complete: run.accepted, verificationStatus: "VERIFIED" };
}

function consequence(question: GeneratedQuestionCandidate): string {
  return bounded(question.answer.concise, 500);
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}
