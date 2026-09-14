import type { AiService } from "@/server/ai/ai.service";
import {
  buildTechnicalEvaluationPrompt,
  buildResumeAnswerEvaluationPrompt,
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
  rubricScores: [{ rubricKey: "technical-correctness", score: 94, rationale: "Correct behavior." }]
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
      input(
        execution({ accepted: false, testsPassed: 1, testCount: 3, status: "1/3 tests passed" })
      )
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

  it("normalizes harmless provider shape drift and drops ungrounded quotes", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        score: 93.6,
        strengths: ["A".repeat(200), "Second", "Third", "Fourth"],
        gaps: ["One", "Two", "Three", "Four"],
        rubricScores: Array.from({ length: 8 }, (_, index) => ({
          rubricKey: index === 0 ? "concept-depth" : `rubric-${index}`,
          score: 80.4,
          rationale: "R".repeat(220)
        })),
        evidenceQuotes: ["not present in the answer"]
      },
      input(null)
    );

    expect(result.score).toBe(94);
    expect(result.strengths).toHaveLength(3);
    expect(result.strengths[0]).toHaveLength(140);
    expect(result.gaps).toHaveLength(3);
    expect(result.rubricScores).toHaveLength(6);
    expect(result.rubricScores[0]).toMatchObject({ rubricKey: "concept-depth", score: 80 });
    expect(result.rubricScores[0]?.rationale).toHaveLength(180);
    expect(result.evidenceQuotes).toEqual([]);
  });

  it("requires the model to prioritize factual correctness over fluent delivery", async () => {
    const generateStructured = vi.fn().mockResolvedValue(rawEvaluation);
    const evaluator = new TechnicalAnswerEvaluator({ generateStructured } as unknown as AiService);

    const result = await evaluator.evaluate(input(null));

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "interview.answer.evaluate",
        temperature: 0.1,
        maxAttempts: 1,
        prompt: expect.stringContaining("false central mechanism belongs below 45")
      })
    );
    expect(buildTechnicalEvaluationPrompt(input(null))).toContain(
      "Compilation or execution without tests is not proof of correctness"
    );
    expect(result.runtime).toMatchObject({
      engineVersion: expect.any(String),
      promptVersion: expect.any(String),
      recovered: false,
      calls: []
    });
  });

  it("evaluates every resume answer from an evidence rubric", () => {
    expect(shouldEvaluateTechnicalAnswer(setup, question)).toBe(true);
    expect(
      shouldEvaluateTechnicalAnswer(
        { ...setup, resumeRound: true, roundType: "behavioral" },
        { ...question, kind: "conversation", stage: "experience" }
      )
    ).toBe(true);
  });

  it("grounds resume feedback in saved answers and a human evidence rubric", () => {
    const resumeInput: TechnicalAnswerEvaluationInput = {
      ...input(null),
      setup: { ...setup, resumeRound: true, roundType: "behavioral" },
      question: {
        ...question,
        kind: "conversation",
        stage: "project",
        evidenceAnchor: "Redis caching project",
        mustHit: ["personal ownership", "trade-off", "measured result"]
      },
      answers: ["I added cache invalidation and database reads dropped by 40 percent."]
    };

    const prompt = buildResumeAnswerEvaluationPrompt(resumeInput);

    expect(prompt).toContain("Redis caching project");
    expect(prompt).toContain("personal-ownership: Makes the candidate's own responsibility");
    expect(prompt).toContain(
      "exactly these keys: claim-credibility, personal-ownership, decision-making"
    );
    expect(prompt).toContain(resumeInput.answers[0]);
    expect(prompt).toContain("evidenceQuotes");
  });

  it("uses DSA and HR judgement parameters instead of a universal rubric", () => {
    const dsaPrompt = buildTechnicalEvaluationPrompt({
      ...input(null),
      setup: { ...setup, templateId: "dsa" }
    });
    const hrPrompt = buildResumeAnswerEvaluationPrompt({
      ...input(null),
      setup: { ...setup, roundType: "hiring-manager", resumeRound: true }
    });

    expect(dsaPrompt).toContain("problem-understanding");
    expect(dsaPrompt).toContain("complexity-scalability");
    expect(hrPrompt).toContain("motivation-fit");
    expect(hrPrompt).toContain("accountability");
    expect(hrPrompt).not.toContain("claim-credibility");
  });
});
