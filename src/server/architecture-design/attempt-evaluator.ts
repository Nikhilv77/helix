import {
  architectureDesignAttemptFeedbackSchema,
  type ArchitectureDesignAttemptWork
} from "@/lib/practice/architecture-design/practice-contracts";
import type { ArchitectureDesignQuestion } from "@/lib/practice/architecture-design/question-contracts";
import type { AiService } from "@/server/ai/ai.service";
import { storyPracticeFingerprint } from "@/server/story-practice/practice-orchestrator";

export const ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION =
  "architecture-design-attempt-evaluator-v1" as const;
export const ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT = storyPracticeFingerprint({
  version: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
  feedbackSchemaVersion: 1,
  policy: "frozen-question-rubric-bounded-evidence"
});

export type ArchitectureDesignAttemptEvaluation = Readonly<{
  feedback: ReturnType<typeof architectureDesignAttemptFeedbackSchema.parse>;
  complete: boolean;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  evaluatorVersion: typeof ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION;
  evaluatorFingerprint: string;
}>;

/** Evaluates only the frozen scenario question; it never invents requirements or scale facts. */
export class ArchitectureDesignAttemptEvaluator {
  constructor(private readonly ai?: Pick<AiService, "generateStructured">) {}

  async evaluate(
    question: ArchitectureDesignQuestion,
    work: ArchitectureDesignAttemptWork
  ): Promise<ArchitectureDesignAttemptEvaluation> {
    if (work.kind === "choice") return choiceEvaluation(question, work.selectedChoiceIndex);
    if (!this.ai) return writtenFallback(question, work.text);

    const feedback = architectureDesignAttemptFeedbackSchema.parse(
      await this.ai.generateStructured({
        operation: "architecture-design.practice.attempt",
        modelClass: "fast",
        temperature: 0.1,
        schema: architectureDesignAttemptFeedbackSchema,
        systemInstruction:
          "You are a strict system-design interviewer. Judge the answer only against the frozen scenario, artifact, and rubric. Do not invent requirements, traffic, dependencies, or production facts. Return concise JSON matching the schema, score from 0 to 10, and do not mention hidden rubrics or private source material.",
        prompt: `Evaluate this Architecture & Design response.

Stage: ${question.stageKey}
Prompt: ${question.prompt}
Artifact (${question.artifact.kind}):
${question.artifact.content}

Candidate response:
"""
${work.text}
"""

Frozen reference answer:
${question.referenceAnswer.summary}
${question.referenceAnswer.explanation}

Rubric (10 points total):
${question.rubric.map((item) => `- ${item.points}: ${item.criterion}`).join("\n")}

Common mistakes:
${question.commonMistakes.map((item) => `- ${item}`).join("\n")}`
      })
    );
    return identity(feedback, "VERIFIED");
  }
}

function choiceEvaluation(
  question: ArchitectureDesignQuestion,
  selectedChoiceIndex: number
): ArchitectureDesignAttemptEvaluation {
  const correct = selectedChoiceIndex === question.correctChoiceIndex;
  return identity(
    architectureDesignAttemptFeedbackSchema.parse({
      schemaVersion: 1,
      score: correct ? 10 : 0,
      result: correct
        ? "That choice follows from the frozen scenario constraints."
        : `That choice does not satisfy the governing constraint. ${question.referenceAnswer.summary}`,
      constraintUse:
        question.artifact.caption ?? "Tie the decision to the supplied scenario evidence.",
      designReasoning: question.referenceAnswer.explanation,
      tradeoffQuality: correct
        ? "The selected boundary preserves the intended trade-off."
        : question.commonMistakes[0]!,
      operationalSafety: question.referenceAnswer.summary,
      communicationQuality: correct
        ? "The decision is explicit and defensible."
        : "Name the rejected alternative and its measurable consequence.",
      interviewerFollowUp: question.interviewerFollowUps[0]!,
      missedConsiderations: correct ? [] : [question.commonMistakes[0]!]
    }),
    "VERIFIED"
  );
}

function writtenFallback(
  question: ArchitectureDesignQuestion,
  text: string
): ArchitectureDesignAttemptEvaluation {
  const normalized = text.toLowerCase();
  const hits = question.dimensionKeys.filter((key) =>
    key.split("-").some((token) => token.length > 4 && normalized.includes(token))
  ).length;
  const score = Math.min(10, Math.max(1, 4 + hits));
  return identity(
    architectureDesignAttemptFeedbackSchema.parse({
      schemaVersion: 1,
      score,
      result: "Your written design response was recorded for bounded review.",
      constraintUse: "Review where each proposed component connects to a frozen requirement.",
      designReasoning: question.referenceAnswer.summary,
      tradeoffQuality:
        "State one rejected alternative and the condition that would change the choice.",
      operationalSafety: "Trace overload and dependency failure through the proposed boundaries.",
      communicationQuality: "Lead with assumptions, then quantify the decision and consequence.",
      interviewerFollowUp: question.interviewerFollowUps[0]!,
      missedConsiderations: []
    }),
    "UNVERIFIED"
  );
}

function identity(
  feedback: ReturnType<typeof architectureDesignAttemptFeedbackSchema.parse>,
  verificationStatus: "VERIFIED" | "UNVERIFIED"
): ArchitectureDesignAttemptEvaluation {
  return {
    feedback,
    complete: true,
    verificationStatus,
    evaluatorVersion: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
    evaluatorFingerprint: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT
  };
}
