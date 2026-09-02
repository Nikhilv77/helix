import type { AiService } from "../ai/ai.service";
import {
  buildTechnicalEvaluationPrompt,
  normalizeTechnicalEvaluation,
  shouldEvaluateTechnicalAnswer,
  TechnicalAnswerEvaluator,
  type TechnicalAnswerEvaluationInput
} from "./technical-answer-evaluator";
import type { CodeExecutionEvidence, InterviewSetup, PlannedQuestion } from "./types";

const setup: InterviewSetup = {
  role: "frontend",
  level: "3-5",
  roundType: "technical",
  intensity: "realistic",
  context: "Frontend interview"
};

const question: PlannedQuestion = {
  text: "Implement a bounded retry queue.",
  kind: "code",
  language: "JavaScript",
  codeTask: "Implement a bounded retry queue.",
  competency: "Implementation correctness",
  intent: "Verify retry bounds and backoff behavior.",
  mustHit: ["bounded attempts", "backoff", "terminal failure"],
  probeIfMissing: "How does retrying stop?"
};

const rawEvaluation = {
  score: 94,
  verdict: "correct" as const,
  confidence: 0.9,
  summary: "The implementation handles the required behavior.",
  strengths: ["Bounds retry attempts."],
  gaps: [],
  rubricScores: [
    { rubricKey: "technical-correctness", score: 94, rationale: "Correct behavior." }
  ]
};

function execution(overrides: Partial<CodeExecutionEvidence> = {}): CodeExecutionEvidence {
  return {
    language: "JavaScript",
    status: "Accepted",
    accepted: true,
    testsPassed: 3,
    testCount: 3,
    compileOutput: "",
    stderr: "",
    time: "0.01",
    memory: 1_024,
    recordedAt: 2_000,
    ...overrides
  };
}

function input(codeExecution: CodeExecutionEvidence | null): TechnicalAnswerEvaluationInput {
  return {
    setup,
    question,
    answers: ["function retry() { return true; }"],
    rubric: [],
    execution: codeExecution,
    evaluatedAt: 3_000
  };
}

describe("technical answer evaluator", () => {
  it("caps a fluent high-scoring answer when supplied tests fail", () => {
    const result = normalizeTechnicalEvaluation(
      rawEvaluation,
      input(execution({ accepted: false, testsPassed: 1, testCount: 3, status: "1/3 tests passed" }))
    );

    expect(result.score).toBe(43);
    expect(result.verdict).toBe("incorrect");
    expect(result.execution?.testsPassed).toBe(1);
  });

  it("does not let an internally incorrect verdict keep a high score", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, score: 92, verdict: "incorrect" },
      input(null)
    );

    expect(result.score).toBe(44);
    expect(result.verdict).toBe("incorrect");
  });

  it("does not treat successful execution without tests as proof of correctness", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, score: 42, verdict: "incorrect" },
      input(execution({ testCount: 0, testsPassed: 0 }))
    );

    expect(result.score).toBe(42);
    expect(result.verdict).toBe("incorrect");
  });

  it("requires the model to prioritize factual correctness over fluent delivery", async () => {
    const generateStructured = vi.fn().mockResolvedValue(rawEvaluation);
    const evaluator = new TechnicalAnswerEvaluator({ generateStructured } as unknown as AiService);

    await evaluator.evaluate(input(null));

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "interview.answer.evaluate",
        temperature: 0.1,
        prompt: expect.stringContaining("false central mechanism belongs below 45")
      })
    );
    expect(buildTechnicalEvaluationPrompt(input(null))).toContain(
      "Compilation or execution without tests is not proof of correctness"
    );
  });

  it("evaluates technical rounds while leaving behavioral experience answers alone", () => {
    expect(shouldEvaluateTechnicalAnswer(setup, question)).toBe(true);
    expect(
      shouldEvaluateTechnicalAnswer(
        { ...setup, resumeRound: true, roundType: "behavioral" },
        { ...question, kind: "conversation", stage: "experience" }
      )
    ).toBe(false);
  });
});
