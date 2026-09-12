import {
  ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
  ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION,
  architectureDesignAssessmentEvaluationSchema,
  architectureDesignAssessmentReportSchema,
  architectureDesignSafeTranscriptSchema,
  type ArchitectureDesignAssessmentReport,
  type ArchitectureDesignAssessmentSnapshot,
  type ArchitectureDesignSafeTranscript
} from "@/features/practice/architecture-design/domain/assessment-contracts";
import {
  architectureDesignAdaptiveEvidenceSchema,
  type ArchitectureDesignAdaptiveEvidence,
  type ArchitectureDesignConfirmedFocus
} from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignQuestionSchema } from "@/features/practice/architecture-design/domain/question-contracts";
import type { AiService } from "@/server/ai/ai.service";
import { storyPracticeFingerprint } from "@/features/practice/shared/server/practice-orchestrator";
import { terminalStoryPracticeContinuation } from "@/features/practice/shared/server/continuation-orchestrator";
import type { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

type EvidenceQuestion = {
  order: number;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  privateSnapshot: unknown;
  state: { revealedHintCount: number } | null;
  attempts: Array<{ score: number | null; verificationStatus: string }>;
};

type EvaluateInput = {
  assessmentId: string;
  blockId: string;
  scenarioKey: string;
  focus: ArchitectureDesignConfirmedFocus;
  snapshot: ArchitectureDesignAssessmentSnapshot;
  responses: NonNullable<ArchitectureDesignAssessmentSnapshot["submission"]>["responses"];
  questions: EvidenceQuestion[];
  priorScenarioKeys: string[];
  priorTopicKeys: string[];
  finalizedAt: Date;
};

export class ArchitectureDesignAssessmentEvaluator {
  constructor(
    private readonly ai: Pick<AiService, "generateStructured">,
    private readonly ranking: Pick<ArchitectureDesignScenarioRankingService, "findNextScenario">,
    private readonly model = { provider: "configured-ai", model: "reasoning" }
  ) {}

  async evaluate(input: EvaluateInput): Promise<{
    report: ArchitectureDesignAssessmentReport;
    transcript: ArchitectureDesignSafeTranscript;
    evidence: ArchitectureDesignAdaptiveEvidence;
  }> {
    const prompt = assessmentPrompt(input);
    const raw = architectureDesignAssessmentEvaluationSchema.parse(
      await this.ai.generateStructured({
        operation: "architecture-design.assessment.finalize",
        modelClass: "reasoning",
        temperature: 0.1,
        schema: architectureDesignAssessmentEvaluationSchema,
        systemInstruction:
          "You are a strict senior system-design interviewer. Use only the frozen scenario prompts, expected answers, rubrics, candidate responses, and supplied practice evidence. Do not invent requirements, traffic, dependencies, or production facts. Return exactly one mastery entry for every supplied Architecture dimension and JSON matching the schema.",
        prompt
      })
    );
    const evidence = adaptiveEvidence(input, raw.scores);
    const nextScenario = this.ranking.findNextScenario(input.focus, evidence);
    const continuation = nextScenario
      ? { kind: "continue" as const, next: nextScenario }
      : terminalStoryPracticeContinuation({
          masteredKeys: evidence.practice.strongDimensionKeys,
          assessmentScores: evidence.assessmentScores,
          learnedCount: evidence.practice.learnedCount,
          meanVerifiedScore: evidence.practice.meanVerifiedScore,
          weakKeys: evidence.practice.weakDimensionKeys,
          readySummary:
            "You have demonstrated the available Architecture & Design outcomes with verified practice and assessment evidence.",
          completeSummary:
            "You have completed every currently eligible Architecture & Design scenario. Review the remaining feedback before interview day."
        });
    const learnedQuestionOrders = input.questions
      .filter(({ status }) => status === "LEARNED")
      .map(({ order }) => order)
      .sort((left, right) => left - right);
    const promptFingerprint = storyPracticeFingerprint(prompt);
    const report = architectureDesignAssessmentReportSchema.parse({
      schemaVersion: 1,
      evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
      scoringVersion: ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION,
      model: this.model,
      promptFingerprint,
      evaluationFingerprint: storyPracticeFingerprint({
        evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
        promptFingerprint,
        evaluation: raw
      }),
      finalizedAt: input.finalizedAt.toISOString(),
      scores: raw.scores,
      overallScore: Math.round(average(Object.values(raw.scores))),
      teacherSummary: raw.teacherSummary,
      strengths: raw.strengths,
      improvementAreas: raw.improvementAreas,
      nextSteps: raw.nextSteps,
      dimensionMastery: raw.dimensionMastery,
      solvedVsLearned: {
        completedCount: input.questions.length - learnedQuestionOrders.length,
        learnedCount: learnedQuestionOrders.length,
        learnedQuestionOrders,
        masteryCreditNote:
          learnedQuestionOrders.length === 0
            ? "All four Practice questions were solved through attempts; no Learn action reduced Practice mastery credit."
            : `Questions ${learnedQuestionOrders.join(", ")} were learned rather than solved and contribute zero Practice mastery credit.`
      },
      ...(nextScenario ? { nextScenario } : {}),
      continuation
    });
    const responseById = new Map(input.responses.map((response) => [response.promptId, response]));
    const transcript = architectureDesignSafeTranscriptSchema.parse({
      schemaVersion: 1,
      assessmentId: input.assessmentId,
      blockId: input.blockId,
      entries: input.snapshot.prompts.map(({ id, order, kind, prompt: text }) => ({
        promptId: id,
        order,
        kind,
        prompt: text,
        answer: responseById.get(id)!.answer
      }))
    });
    return { report, transcript, evidence };
  }
}

function assessmentPrompt(input: EvaluateInput): string {
  const responseById = new Map(input.responses.map((response) => [response.promptId, response]));
  const practiceEvidence = input.questions.map((row) => {
    const question = architectureDesignQuestionSchema.parse(row.privateSnapshot);
    return {
      order: row.order,
      status: row.status,
      dimensionKeys: question.dimensionKeys,
      verifiedAttemptScores: row.attempts
        .filter(({ verificationStatus }) => verificationStatus === "VERIFIED")
        .map(({ score }) => score),
      hintsUsed: row.state?.revealedHintCount ?? 0
    };
  });
  return `Evaluate this frozen Architecture & Design assessment.

${input.snapshot.prompts
  .map(
    (prompt) => `Prompt ${prompt.order} (${prompt.kind}):
${prompt.prompt}
Context: ${prompt.context ?? "None"}
Expected answer: ${prompt.privateEvaluation.expectedAnswer}
Dimensions: ${prompt.privateEvaluation.dimensionKeys.join(", ")}
Rubric: ${prompt.privateEvaluation.rubric.map((item) => `${item.points}/10 ${item.criterion}`).join("; ")}
Candidate answer:
"""
${responseById.get(prompt.id)!.answer}
"""`
  )
  .join("\n\n")}

Authoritative Practice evidence (Learn is zero Practice mastery and unverified attempts are not demonstrated ability):
${JSON.stringify(practiceEvidence)}`;
}

function adaptiveEvidence(
  input: EvaluateInput,
  scores: ArchitectureDesignAssessmentReport["scores"]
): ArchitectureDesignAdaptiveEvidence {
  const verifiedScores: number[] = [];
  const weakDimensionKeys = new Set<
    ArchitectureDesignAdaptiveEvidence["practice"]["weakDimensionKeys"][number]
  >();
  const strongDimensionKeys = new Set<
    ArchitectureDesignAdaptiveEvidence["practice"]["strongDimensionKeys"][number]
  >();
  let completedCount = 0;
  let learnedCount = 0;
  let hintsUsed = 0;
  for (const row of input.questions) {
    const question = architectureDesignQuestionSchema.parse(row.privateSnapshot);
    const latestVerified = row.attempts.find(
      ({ verificationStatus }) => verificationStatus === "VERIFIED"
    );
    hintsUsed += row.state?.revealedHintCount ?? 0;
    if (row.status === "LEARNED") {
      learnedCount += 1;
      verifiedScores.push(0);
      question.dimensionKeys.forEach((key) => weakDimensionKeys.add(key));
      continue;
    }
    completedCount += 1;
    if (latestVerified?.score != null) verifiedScores.push(latestVerified.score);
    if ((latestVerified?.score ?? 0) >= 7 && (row.state?.revealedHintCount ?? 0) < 2) {
      question.dimensionKeys.forEach((key) => strongDimensionKeys.add(key));
    } else {
      question.dimensionKeys.forEach((key) => weakDimensionKeys.add(key));
    }
  }
  return architectureDesignAdaptiveEvidenceSchema.parse({
    schemaVersion: 1,
    assessmentScores: scores,
    practice: {
      completedCount,
      learnedCount,
      meanVerifiedScore: verifiedScores.length === 0 ? 0 : average(verifiedScores),
      hintsUsed,
      weakDimensionKeys: [...weakDimensionKeys].sort(),
      strongDimensionKeys: [...strongDimensionKeys]
        .filter((key) => !weakDimensionKeys.has(key))
        .sort()
    },
    priorScenarioKeys: [...new Set([...input.priorScenarioKeys, input.scenarioKey])],
    priorTopicKeys: [...new Set(input.priorTopicKeys)].sort()
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
