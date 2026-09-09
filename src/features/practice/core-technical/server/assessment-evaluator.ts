import {
  CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
  CORE_TECHNICAL_ASSESSMENT_SCORING_VERSION,
  coreTechnicalAssessmentEvaluationSchema,
  coreTechnicalAssessmentReportSchema,
  coreTechnicalSafeTranscriptSchema,
  type CoreTechnicalAssessmentReport,
  type CoreTechnicalAssessmentSnapshot,
  type CoreTechnicalSafeTranscript
} from "@/features/practice/core-technical/domain/assessment-contracts";
import {
  coreTechnicalAdaptiveEvidenceSchema,
  type CoreTechnicalAdaptiveEvidence,
  type CoreTechnicalConfirmedFocus
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { generatedQuestionCandidateSchema } from "@/features/practice/core-technical/domain/question-contracts";
import type { AiService } from "@/server/ai/ai.service";
import type { z } from "zod";
import type { CoreTechnicalStoryRankingService } from "./story-ranking.service";

type EvidenceQuestion = {
  order: number;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  privateSnapshot: unknown;
  state: { revealedHintCount: number } | null;
  attempts: Array<{ score: number | null; verificationStatus: string }>;
  codeRuns: Array<{ passed: boolean }>;
};

type EvaluateInput = {
  assessmentId: string;
  blockId: string;
  storyKey: string;
  focus: CoreTechnicalConfirmedFocus;
  snapshot: CoreTechnicalAssessmentSnapshot;
  responses: NonNullable<CoreTechnicalAssessmentSnapshot["submission"]>["responses"];
  questions: EvidenceQuestion[];
  priorStoryKeys: string[];
  priorTopicKeys: string[];
  finalizedAt: Date;
};

export class CoreTechnicalAssessmentEvaluator {
  constructor(
    private readonly ai: Pick<AiService, "generateStructured">,
    private readonly ranking: Pick<CoreTechnicalStoryRankingService, "rankNextStory">
  ) {}

  async evaluate(input: EvaluateInput): Promise<{
    report: CoreTechnicalAssessmentReport;
    transcript: CoreTechnicalSafeTranscript;
    evidence: CoreTechnicalAdaptiveEvidence;
  }> {
    const raw = coreTechnicalAssessmentEvaluationSchema.parse(
      await this.ai.generateStructured({
        operation: "core-technical.assessment.finalize",
        modelClass: "reasoning",
        temperature: 0.1,
        schema: coreTechnicalAssessmentEvaluationSchema,
        systemInstruction: `You are a strict senior Node.js interviewer. Return only JSON matching the schema. Score factual and implementation correctness before fluency. Use each frozen expected answer and rubric. Never claim deterministic code evidence passed when the supplied evidence says it did not. Produce exactly one promptFeedback item for each prompt ID.`,
        prompt: assessmentPrompt(input)
      })
    );
    assertFeedbackIdentity(input.snapshot, raw.promptFeedback);
    const totalCodeQuestionCount = input.questions.filter(({ privateSnapshot }) => {
      const question = generatedQuestionCandidateSchema.parse(privateSnapshot);
      return question.format === "debug-repair" || question.format === "micro-implementation";
    }).length;
    const acceptedCodeQuestionCount = input.questions.filter((question) =>
      question.codeRuns.some((run) => run.passed)
    ).length;
    const implementationCap = acceptedCodeQuestionCount === 0
      ? 35
      : acceptedCodeQuestionCount < totalCodeQuestionCount
        ? 70
        : 100;
    const scores = {
      ...raw.scores,
      debuggingImplementation: Math.min(raw.scores.debuggingImplementation, implementationCap)
    };
    const evidence = adaptiveEvidence(input, scores);
    const nextStory = this.ranking.rankNextStory(input.focus, evidence);
    const learnedQuestionOrders = input.questions
      .filter((question) => question.status === "LEARNED")
      .map((question) => question.order)
      .sort((left, right) => left - right);
    const report = coreTechnicalAssessmentReportSchema.parse({
      schemaVersion: 1,
      evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
      scoringVersion: CORE_TECHNICAL_ASSESSMENT_SCORING_VERSION,
      finalizedAt: input.finalizedAt.toISOString(),
      scores,
      overallScore: Math.round(average(Object.values(scores))),
      teacherSummary: raw.teacherSummary,
      strengths: raw.strengths,
      improvementAreas: raw.improvementAreas,
      promptFeedback: raw.promptFeedback,
      solvedVsLearned: {
        completedCount: input.questions.length - learnedQuestionOrders.length,
        learnedCount: learnedQuestionOrders.length,
        learnedQuestionOrders,
        masteryCreditNote: learnedQuestionOrders.length === 0
          ? "All eight Practice questions were solved through attempts; no Learn action reduced Practice mastery credit."
          : `Questions ${learnedQuestionOrders.join(", ")} were learned rather than solved and contribute zero Practice mastery credit.`
      },
      deterministicEvidence: {
        acceptedCodeQuestionCount,
        totalCodeQuestionCount,
        implementationScoreCapped: scores.debuggingImplementation !== raw.scores.debuggingImplementation
      },
      nextStory
    });
    const responseById = new Map(input.responses.map((response) => [response.promptId, response]));
    const transcript = coreTechnicalSafeTranscriptSchema.parse({
      schemaVersion: 1,
      assessmentId: input.assessmentId,
      blockId: input.blockId,
      entries: input.snapshot.prompts.map(({ id, order, kind, prompt }) => ({
        promptId: id,
        order,
        kind,
        prompt,
        answer: responseById.get(id)!.answer
      }))
    });
    return { report, transcript, evidence };
  }
}

function assessmentPrompt(input: EvaluateInput): string {
  const responseById = new Map(input.responses.map((response) => [response.promptId, response]));
  const practiceEvidence = input.questions.map((row) => {
    const question = generatedQuestionCandidateSchema.parse(row.privateSnapshot);
    return {
      order: row.order,
      status: row.status,
      format: question.format,
      verifiedAttemptScores: row.attempts
        .filter((attempt) => attempt.verificationStatus === "VERIFIED")
        .map((attempt) => attempt.score),
      acceptedCodeRun: row.codeRuns.some((run) => run.passed),
      revealedHints: row.state?.revealedHintCount ?? 0
    };
  });
  return `Evaluate this five-prompt story assessment.

Frozen prompts, private evaluation contracts, and candidate answers:
${input.snapshot.prompts.map((prompt) => `Prompt ${prompt.order} (${prompt.id}): ${prompt.prompt}
Context: ${prompt.context ?? "none"}
Expected answer: ${prompt.privateEvaluation.expectedAnswer}
Rubric: ${prompt.privateEvaluation.rubric.map((item) => `${item.points}/10 ${item.criterion}`).join("; ")}
Deterministic evidence rule: ${prompt.privateEvaluation.deterministicEvidence}
Candidate answer:
"""
${responseById.get(prompt.id)!.answer}
"""`).join("\n\n")}

Authoritative Practice evidence (model scores may not override this):
${JSON.stringify(practiceEvidence)}`;
}

function adaptiveEvidence(
  input: EvaluateInput,
  scores: z.infer<typeof coreTechnicalAssessmentEvaluationSchema>["scores"]
): CoreTechnicalAdaptiveEvidence {
  const weakTopicKeys = new Set<string>();
  const weakMechanismKeys = new Set<string>();
  const verifiedScores: number[] = [];
  let hintsUsed = 0;
  let completedCount = 0;
  let learnedCount = 0;
  let acceptedCodeQuestionCount = 0;
  let totalCodeQuestionCount = 0;
  for (const row of input.questions) {
    const question = generatedQuestionCandidateSchema.parse(row.privateSnapshot);
    const executable = question.format === "debug-repair" || question.format === "micro-implementation";
    if (executable) totalCodeQuestionCount += 1;
    if (row.codeRuns.some((run) => run.passed)) acceptedCodeQuestionCount += 1;
    if (row.status === "LEARNED") {
      learnedCount += 1;
      verifiedScores.push(0);
    } else completedCount += 1;
    hintsUsed += row.state?.revealedHintCount ?? 0;
    const latestVerified = row.attempts.find((attempt) => attempt.verificationStatus === "VERIFIED");
    if (
      row.status !== "LEARNED" &&
      latestVerified?.score !== null &&
      latestVerified?.score !== undefined
    ) {
      verifiedScores.push(latestVerified.score);
    }
    if (row.status === "LEARNED" || (latestVerified?.score ?? 10) < 7 || (row.state?.revealedHintCount ?? 0) >= 2) {
      question.topicKeys.forEach((key) => weakTopicKeys.add(key));
      question.mechanismKeys.forEach((key) => weakMechanismKeys.add(key));
    }
  }
  return coreTechnicalAdaptiveEvidenceSchema.parse({
    schemaVersion: 1,
    assessmentScores: scores,
    practice: {
      completedCount,
      learnedCount,
      meanVerifiedScore: verifiedScores.length === 0 ? 0 : average(verifiedScores),
      hintsUsed,
      acceptedCodeQuestionCount,
      totalCodeQuestionCount,
      weakTopicKeys: [...weakTopicKeys].sort(),
      weakMechanismKeys: [...weakMechanismKeys].sort()
    },
    priorStoryKeys: [...new Set([...input.priorStoryKeys, input.storyKey])],
    priorTopicKeys: [...new Set(input.priorTopicKeys)].sort()
  });
}

function assertFeedbackIdentity(
  snapshot: CoreTechnicalAssessmentSnapshot,
  feedback: Array<{ promptId: string }>
) {
  const expected = snapshot.prompts.map((prompt) => prompt.id).sort();
  const actual = feedback.map((item) => item.promptId).sort();
  if (expected.some((id, index) => id !== actual[index])) {
    throw new Error("Assessment feedback does not match the frozen prompt identities");
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
