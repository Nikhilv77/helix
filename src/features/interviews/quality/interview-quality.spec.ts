import type { InterviewDecisionResult } from "../server/decider";
import type { QuestionEvaluation } from "../server/types";
import { DECISION_GOLDEN_SCENARIOS, SCORING_GOLDEN_SCENARIOS } from "./golden-scenarios";
import {
  createQualityReport,
  InterviewQualityRunner,
  scoreDecisionScenario,
  scoreScoringScenario
} from "./interview-quality";

const runtime = {
  engineVersion: "test",
  promptVersion: "test",
  durationMs: 10,
  usedFallback: false,
  calls: []
};

function decision(overrides: Partial<InterviewDecisionResult> = {}): InterviewDecisionResult {
  return {
    action: "probe",
    missing: "specificity",
    reason: "Needs one concrete detail.",
    acknowledgement: "That gives me a thread",
    line: "Which career move shaped what you want now?",
    runtime,
    ...overrides
  };
}

function evaluation(overrides: Partial<QuestionEvaluation> = {}): QuestionEvaluation {
  return {
    source: "semantic-evaluator",
    score: 82,
    verdict: "mostly-correct",
    confidence: 0.9,
    summary: "The candidate gave grounded evidence.",
    strengths: ["Clear ownership."],
    gaps: [],
    rubricScores: [
      "motivation-fit",
      "judgement",
      "collaboration",
      "accountability",
      "self-awareness",
      "communication"
    ].map((rubricKey) => ({ rubricKey, score: 82, rationale: "Supported by the answer." })),
    evidenceQuotes: ["I owned checkout retry safety"],
    answerExcerpts: [],
    execution: null,
    evaluatedAt: 1_000,
    ...overrides
  };
}

describe("interview golden set", () => {
  it("has unique stable IDs and covers every Hiring Manager decision section", () => {
    const all = [...DECISION_GOLDEN_SCENARIOS, ...SCORING_GOLDEN_SCENARIOS];
    expect(new Set(all.map((scenario) => scenario.id)).size).toBe(all.length);
    expect(
      new Set(DECISION_GOLDEN_SCENARIOS.map((scenario) => scenario.input.interviewStage))
    ).toEqual(new Set(["career", "current-role", "project", "behavioral"]));
    expect(DECISION_GOLDEN_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    expect(SCORING_GOLDEN_SCENARIOS.length).toBeGreaterThanOrEqual(4);
  });

  it("accepts a concise, grounded follow-up", () => {
    const scenario = DECISION_GOLDEN_SCENARIOS[0]!;
    const scored = scoreDecisionScenario(scenario, decision());

    expect(scored.score).toBe(100);
    expect(scored.violations).toEqual([]);
  });

  it("requires an answer for the final candidate-question scenario", () => {
    const scenario = DECISION_GOLDEN_SCENARIOS.find(
      (candidate) => candidate.id === "candidate-question-gets-simulated-answer"
    )!;
    const missing = scoreDecisionScenario(
      scenario,
      decision({ action: "move_on", acknowledgement: "", line: "" })
    );
    const answered = scoreDecisionScenario(
      scenario,
      decision({
        action: "move_on",
        acknowledgement: "That’s a useful question",
        line: "",
        candidateResponse:
          "I can’t represent a specific employer, but strong ownership and collaboration are good signals."
      })
    );

    expect(missing.violations).toContain(
      "The candidate's closing question did not receive an answer."
    );
    expect(answered.violations).toEqual([]);
  });

  it("rejects action drift, generic filler, repetition, and multiple questions", () => {
    const scenario = DECISION_GOLDEN_SCENARIOS.find(
      (candidate) => candidate.id === "work-vague-team-ownership"
    )!;
    const scored = scoreDecisionScenario(
      scenario,
      decision({
        action: "move_on",
        acknowledgement: "Great answer",
        line: "What piece of work are you most proud of, and what was your personal contribution to it?"
      })
    );

    expect(scored.score).toBeLessThan(85);
    expect(scored.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Expected"),
        expect.stringContaining("empty line"),
        expect.stringContaining("generic filler")
      ])
    );
  });

  it("checks calibrated score bands, session dimensions, and quote grounding", () => {
    const scenario = SCORING_GOLDEN_SCENARIOS[0]!;
    const accepted = scoreScoringScenario(scenario, evaluation());
    const rejected = scoreScoringScenario(
      scenario,
      evaluation({
        score: 30,
        verdict: "incorrect",
        rubricScores: [],
        evidenceQuotes: ["This phrase was never said"]
      })
    );

    expect(accepted.violations).toEqual([]);
    expect(rejected.score).toBe(0);
    expect(rejected.violations).toHaveLength(4);
  });

  it("fails the release gate when even one case has a violation", () => {
    const clean = scoreDecisionScenario(DECISION_GOLDEN_SCENARIOS[0]!, decision());
    const drifted = { ...clean, id: "drifted", score: 84, violations: ["drift"] };

    const report = createQualityReport([clean, drifted]);

    expect(report.summary).toMatchObject({ cases: 2, passedCases: 1, passed: false });
  });

  it("captures provider failures per case instead of hiding or aborting the run", async () => {
    const runner = new InterviewQualityRunner(
      { decide: vi.fn().mockRejectedValue(new Error("decider unavailable")) } as never,
      { evaluate: vi.fn() } as never
    );

    const report = await runner.run({
      kind: "decision",
      caseIds: [DECISION_GOLDEN_SCENARIOS[0]!.id]
    });

    expect(report.summary.passed).toBe(false);
    expect(report.results[0]).toMatchObject({
      score: 0,
      violations: ["decider unavailable"]
    });
  });
});
