import {
  appliedEngineeringAttemptFeedbackSchema,
  type AppliedEngineeringAttemptWork
} from "@/lib/practice/applied-engineering/practice-contracts";
import type { AppliedEngineeringQuestion } from "@/lib/practice/applied-engineering/question-contracts";
import type { AiService } from "@/server/ai/ai.service";
import type { AppliedEngineeringRunResult } from "./runner.service";

export type AppliedEngineeringAttemptEvaluation = {
  feedback: ReturnType<typeof appliedEngineeringAttemptFeedbackSchema.parse>;
  complete: boolean;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
};

export class AppliedEngineeringAttemptEvaluator {
  constructor(private readonly ai?: Pick<AiService, "generateStructured">) {}

  async evaluate(
    question: AppliedEngineeringQuestion,
    work: AppliedEngineeringAttemptWork,
    run: AppliedEngineeringRunResult | null
  ): Promise<AppliedEngineeringAttemptEvaluation> {
    if (work.kind === "choice") return choiceEvaluation(question, work.selectedChoiceIndex);
    if (work.kind === "code") return codeEvaluation(question, run);
    if (!this.ai) return writtenFallback(question, work.text);

    const feedback = appliedEngineeringAttemptFeedbackSchema.parse(
      await this.ai.generateStructured({
        operation: "applied-engineering.practice.attempt",
        modelClass: "fast",
        temperature: 0.1,
        schema: appliedEngineeringAttemptFeedbackSchema,
        systemInstruction: "You are a strict production engineering evaluator. Judge correctness before fluency, use only the frozen prompt and answer, and return concise JSON matching the schema. Never reveal private rubrics or answer keys.",
        prompt: `Evaluate this Applied Engineering response.\n\nIncident question (${question.format}):\n${question.prompt}\n\nEvidence:\n${question.artifact.content}\n\nCandidate response:\n${work.text}\n\nFrozen answer:\n${question.answer.concise}\n${question.answer.explanation}\n\nRubric:\n${question.rubric.map((item) => `- ${item.points}: ${item.criterion}`).join("\n")}`
      })
    );
    return { feedback, complete: true, verificationStatus: "VERIFIED" };
  }
}

function choiceEvaluation(question: AppliedEngineeringQuestion, selected: number): AppliedEngineeringAttemptEvaluation {
  const correct = selected === question.answer.correctChoiceIndex;
  return {
    complete: true,
    verificationStatus: "VERIFIED",
    feedback: appliedEngineeringAttemptFeedbackSchema.parse({
      schemaVersion: 1,
      score: correct ? 10 : 0,
      result: correct ? "That is the safest conclusion from the incident evidence." : `That choice misses the primary failure mode. ${question.answer.concise}`,
      evidenceUse: question.artifact.caption ?? "You connected the answer to the supplied production evidence.",
      rootCauseReasoning: question.answer.explanation,
      repairQuality: correct ? "The proposed direction preserves the required production boundary." : question.commonMistakes[0]!,
      verificationQuality: "Explain how a deterministic test would distinguish this path from the distraction.",
      productionConsequence: question.answer.concise,
      saferDelivery: question.interviewerFollowUps[0]!,
      interviewerFollowUp: question.interviewerFollowUps[0]!,
      missedEdgeCases: correct ? [] : [question.commonMistakes[0]!]
    })
  };
}

function codeEvaluation(question: AppliedEngineeringQuestion, run: AppliedEngineeringRunResult | null): AppliedEngineeringAttemptEvaluation {
  if (!run) throw new Error("A frozen code run is required to evaluate executable work");
  const accepted = run.accepted;
  return {
    complete: accepted,
    verificationStatus: "VERIFIED",
    feedback: appliedEngineeringAttemptFeedbackSchema.parse({
      schemaVersion: 1,
      score: accepted ? 10 : 0,
      result: accepted ? "The repair passed every deterministic test." : `The repair is not complete (${run.status}).`,
      evidenceUse: "The executable runner result is authoritative for this repair.",
      rootCauseReasoning: question.answer.explanation,
      repairQuality: accepted ? "The implementation satisfies the frozen repair contract." : question.commonMistakes[0]!,
      verificationQuality: accepted ? "Public and hidden tests passed." : "Use the failing test output to close the remaining correctness gap.",
      productionConsequence: question.answer.concise,
      saferDelivery: question.interviewerFollowUps[0]!,
      interviewerFollowUp: question.interviewerFollowUps[0]!,
      missedEdgeCases: run.publicTests.filter((test) => !test.passed).map((test) => test.name).slice(0, 5)
    })
  };
}

function writtenFallback(question: AppliedEngineeringQuestion, text: string): AppliedEngineeringAttemptEvaluation {
  const tokens = new Set(text.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
  const signalHits = question.productionSignalKeys.filter((signal) => tokens.has(signal) || tokens.has(signal.replaceAll("-", " "))).length;
  const score = Math.min(10, Math.max(1, 4 + signalHits));
  return {
    complete: true,
    verificationStatus: "UNVERIFIED",
    feedback: appliedEngineeringAttemptFeedbackSchema.parse({
      schemaVersion: 1,
      score,
      result: "Your written response was recorded for bounded review.",
      evidenceUse: "The response was saved against the frozen incident evidence.",
      rootCauseReasoning: question.answer.explanation,
      repairQuality: "Review the smallest durable repair implied by the incident.",
      verificationQuality: "Name a deterministic test for the failure mode.",
      productionConsequence: question.answer.concise,
      saferDelivery: question.interviewerFollowUps[0]!,
      interviewerFollowUp: question.interviewerFollowUps[0]!,
      missedEdgeCases: []
    })
  };
}
