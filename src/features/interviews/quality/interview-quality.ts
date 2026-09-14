import type { InterviewDecider, InterviewDecisionResult } from "../server/decider";
import type { TechnicalAnswerEvaluator } from "../server/technical-answer-evaluator";
import type { QuestionEvaluation } from "../server/types";
import { evaluationProfileForSetup } from "../domain/evaluation-profile";
import {
  DECISION_GOLDEN_SCENARIOS,
  INTERVIEW_GOLD_SET_VERSION,
  SCORING_GOLDEN_SCENARIOS,
  type DecisionGoldenScenario,
  type ScoringGoldenScenario
} from "./golden-scenarios";

const BANNED_SPOKEN_PATTERN =
  /\b(?:great|excellent|impressive|good answer|as an ai|your score|the rubric|tell me more|can you elaborate)\b/i;

export interface GoldenCaseResult {
  id: string;
  kind: "decision" | "scoring";
  score: number;
  passed: boolean;
  violations: string[];
  actual: Record<string, unknown>;
}

export interface InterviewQualityReport {
  goldSetVersion: string;
  generatedAt: string;
  thresholds: { minimumCaseScore: number; minimumAverageScore: number };
  summary: {
    cases: number;
    passedCases: number;
    averageScore: number;
    passed: boolean;
  };
  results: GoldenCaseResult[];
}

export class InterviewQualityRunner {
  constructor(
    private readonly decider: InterviewDecider,
    private readonly evaluator: TechnicalAnswerEvaluator
  ) {}

  async run(options: { caseIds?: string[]; kind?: "decision" | "scoring" } = {}) {
    const selected = new Set(options.caseIds ?? []);
    const include = (id: string) => selected.size === 0 || selected.has(id);
    const results: GoldenCaseResult[] = [];

    if (!options.kind || options.kind === "decision") {
      for (const scenario of DECISION_GOLDEN_SCENARIOS.filter((item) => include(item.id))) {
        try {
          results.push(scoreDecisionScenario(scenario, await this.decider.decide(scenario.input)));
        } catch (error) {
          results.push(failedProviderCase(scenario.id, "decision", error));
        }
      }
    }
    if (!options.kind || options.kind === "scoring") {
      for (const scenario of SCORING_GOLDEN_SCENARIOS.filter((item) => include(item.id))) {
        try {
          results.push(
            scoreScoringScenario(scenario, await this.evaluator.evaluate(scenario.input))
          );
        } catch (error) {
          results.push(failedProviderCase(scenario.id, "scoring", error));
        }
      }
    }

    if (selected.size > 0 && results.length !== selected.size) {
      const found = new Set(results.map((result) => result.id));
      const unknown = [...selected].filter((id) => !found.has(id));
      throw new Error(`Unknown interview golden case: ${unknown.join(", ")}`);
    }
    return createQualityReport(results);
  }
}

export function scoreDecisionScenario(
  scenario: DecisionGoldenScenario,
  actual: InterviewDecisionResult
): GoldenCaseResult {
  const violations: string[] = [];
  let score = 100;
  const isMoveOn = actual.action === "move_on";

  if (!scenario.expected.actions.includes(actual.action)) {
    score -= 45;
    violations.push(`Expected ${scenario.expected.actions.join("/")}, received ${actual.action}.`);
  }
  if (isMoveOn && actual.line.trim()) {
    score -= 25;
    violations.push("move_on must return an empty line.");
  }
  const candidateResponse = actual.candidateResponse?.trim() ?? "";
  if (scenario.expected.candidateResponse === "required" && !candidateResponse) {
    score -= 35;
    violations.push("The candidate's closing question did not receive an answer.");
  }
  if (!scenario.input.acceptsCandidateQuestions && candidateResponse) {
    score -= 25;
    violations.push("candidateResponse was used outside the final candidate-question turn.");
  }
  if (!isMoveOn) {
    const questionMarks = (actual.line.match(/\?/g) ?? []).length;
    const words = actual.line.trim().split(/\s+/).filter(Boolean).length;
    const validQuestionShape =
      actual.action === "clarify"
        ? actual.line.trim().length > 0 && questionMarks <= 1
        : questionMarks === 1;
    if (!validQuestionShape) {
      score -= 25;
      violations.push("A follow-up must contain one clear conversational request.");
    }
    if (words > 22) {
      score -= 10;
      violations.push(`Follow-up has ${words} words; maximum is 22.`);
    }
    if (normalize(actual.line) === normalize(scenario.input.questionAsked)) {
      score -= 20;
      violations.push("Follow-up repeats the planned question.");
    }
    const terms = scenario.expected.groundingTerms ?? [];
    if (
      terms.length > 0 &&
      !terms.some((term) => normalize(actual.line).includes(normalize(term)))
    ) {
      score -= 15;
      violations.push("Follow-up is not grounded in the expected answer thread.");
    }
  }
  if (actual.action === "clarify" && actual.acknowledgement.trim()) {
    score -= 10;
    violations.push("clarify must not add a separate acknowledgement.");
  }
  const spoken = `${actual.acknowledgement} ${actual.line} ${candidateResponse}`;
  if (BANNED_SPOKEN_PATTERN.test(spoken)) {
    score -= 20;
    violations.push("Spoken response contains praise, internal language, or generic filler.");
  }

  return result(scenario.id, "decision", score, violations, {
    action: actual.action,
    missing: actual.missing,
    acknowledgement: actual.acknowledgement,
    line: actual.line,
    candidateResponse,
    runtime: actual.runtime
  });
}

export function scoreScoringScenario(
  scenario: ScoringGoldenScenario,
  actual: QuestionEvaluation
): GoldenCaseResult {
  const violations: string[] = [];
  let score = 100;
  const expected = scenario.expected;

  if (actual.score < expected.score.min || actual.score > expected.score.max) {
    score -= 50;
    violations.push(
      `Score ${actual.score} is outside ${expected.score.min}-${expected.score.max}.`
    );
  }
  if (!expected.verdicts.includes(actual.verdict)) {
    score -= 20;
    violations.push(`Verdict ${actual.verdict} is outside the accepted calibration band.`);
  }
  const rubricKeys = new Set(actual.rubricScores.map((item) => item.rubricKey));
  const expectedRubricKeys = evaluationProfileForSetup(scenario.input.setup).parameters.map(
    (parameter) => parameter.key
  );
  const missingRubricKeys = expectedRubricKeys.filter((key) => !rubricKeys.has(key));
  if (missingRubricKeys.length) {
    score -= 15;
    violations.push(`Missing session rubric scores: ${missingRubricKeys.join(", ")}.`);
  }
  const answerText = scenario.input.answers.join(" ").toLowerCase();
  const ungroundedQuotes = (actual.evidenceQuotes ?? []).filter(
    (quote) => !answerText.includes(quote.trim().toLowerCase())
  );
  if (ungroundedQuotes.length) {
    score -= 15;
    violations.push("Evaluator returned an evidence quote not found in the candidate answer.");
  }

  return result(scenario.id, "scoring", score, violations, {
    score: actual.score,
    verdict: actual.verdict,
    confidence: actual.confidence,
    summary: actual.summary,
    rubricScores: actual.rubricScores,
    evidenceQuotes: actual.evidenceQuotes ?? [],
    runtime: actual.runtime
  });
}

export function createQualityReport(results: GoldenCaseResult[]): InterviewQualityReport {
  const minimumCaseScore = 85;
  const minimumAverageScore = 90;
  const normalized = results.map((item) => ({
    ...item,
    score: Math.max(0, Math.min(100, Math.round(item.score))),
    passed: item.score >= minimumCaseScore && item.violations.length === 0
  }));
  const averageScore = normalized.length
    ? Math.round(normalized.reduce((sum, item) => sum + item.score, 0) / normalized.length)
    : 0;
  return {
    goldSetVersion: INTERVIEW_GOLD_SET_VERSION,
    generatedAt: new Date().toISOString(),
    thresholds: { minimumCaseScore, minimumAverageScore },
    summary: {
      cases: normalized.length,
      passedCases: normalized.filter((item) => item.passed).length,
      averageScore,
      passed:
        normalized.length > 0 &&
        averageScore >= minimumAverageScore &&
        normalized.every((item) => item.passed)
    },
    results: normalized
  };
}

function result(
  id: string,
  kind: GoldenCaseResult["kind"],
  score: number,
  violations: string[],
  actual: Record<string, unknown>
): GoldenCaseResult {
  return { id, kind, score, passed: score >= 85 && violations.length === 0, violations, actual };
}

function failedProviderCase(
  id: string,
  kind: GoldenCaseResult["kind"],
  error: unknown
): GoldenCaseResult {
  return result(
    id,
    kind,
    0,
    [error instanceof Error ? error.message : "Provider call failed."],
    {}
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
