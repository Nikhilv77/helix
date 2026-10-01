import type { AiService } from "@/server/ai/ai.service";
import {
  buildResumeCodeEvaluationPrompt,
  buildTechnicalEvaluationPrompt,
  buildResumeAnswerEvaluationPrompt,
  normalizeTechnicalEvaluation,
  shouldEvaluateTechnicalAnswer,
  TechnicalAnswerEvaluator,
  type TechnicalAnswerEvaluationInput
} from "./technical-answer-evaluator";
import type { CodeExecutionEvidence, InterviewSetup, PlannedQuestion } from "./types";
import { evaluationProfileForSetup } from "@/features/interviews/domain/evaluation-profile";

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

const parameterKeys = evaluationProfileForSetup(setup).parameters.map((parameter) => parameter.key);

/** Every round parameter rated at the same level. */
function rated(level: number) {
  return parameterKeys.map((rubricKey) => ({ rubricKey, level, rationale: "Rated." }));
}

const rawEvaluation = {
  verdict: "correct" as const,
  confidence: 0.9,
  summary: "The implementation handles the required behavior.",
  strengths: ["Bounds retry attempts."],
  gaps: [],
  rubricScores: rated(5)
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
  it("treats an approved design reference as a rubric rather than the only architecture", () => {
    const prompt = buildTechnicalEvaluationPrompt({
      setup: {
        ...setup,
        templateId: "dsa",
        templateTitle: "DSA & Design interview"
      },
      question: {
        ...question,
        kind: "conversation",
        interviewSection: "design",
        topicKey: "architecture-design",
        storyPracticeInterviewerGuide: {
          practice: "architecture-design",
          label: "Architecture & Design",
          expectedAnswer: "Use a partitioned event stream.",
          rubric: [{ criterion: "Defends consistency boundaries", points: 10 }]
        }
      },
      answers: ["I would use a transactional outbox and explain its consistency boundary."],
      rubric: [],
      execution: null,
      evaluatedAt: 3_000
    });

    expect(prompt).toContain("not the only acceptable architecture");
    expect(prompt).toContain("Accept a different coherent design");
  });

  it("turns anchored levels into scores in code", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, verdict: "mostly-correct", rubricScores: rated(4) },
      input(null)
    );

    expect(result.score).toBe(78);
    expect(result.rubricScores.every((item) => item.score === 78)).toBe(true);
    expect(result.verdict).toBe("mostly-correct");
  });

  it("gives the same score for the same ratings every time", () => {
    const ratings = { ...rawEvaluation, rubricScores: rated(3) };
    const first = normalizeTechnicalEvaluation(ratings, input(null));
    const second = normalizeTechnicalEvaluation(ratings, input(null));

    expect(first.score).toBe(second.score);
    expect(first.rubricScores).toEqual(second.rubricScores);
  });

  it("caps a fluent answer and each parameter when supplied tests fail", () => {
    const result = normalizeTechnicalEvaluation(
      rawEvaluation,
      input(
        execution({ accepted: false, testsPassed: 1, testCount: 3, status: "1/3 tests passed" })
      )
    );

    expect(result.score).toBe(43);
    expect(result.verdict).toBe("incorrect");
    expect(result.rubricScores.every((item) => item.score <= 43)).toBe(true);
    expect(result.execution?.testsPassed).toBe(1);
  });

  it("does not let a clear but incorrect answer score well", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, verdict: "incorrect" },
      input(null)
    );

    expect(result.score).toBe(44);
    expect(result.verdict).toBe("incorrect");
    expect(result.rubricScores.every((item) => item.score <= 44)).toBe(true);
  });

  it("keeps genuinely weak answers low", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, verdict: "incorrect", rubricScores: rated(1) },
      input(null)
    );

    expect(result.score).toBe(10);
    expect(result.rubricScores.map((item) => item.score)).toEqual(parameterKeys.map(() => 10));
  });

  it("judges a parameter the model skipped from the ones it rated", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        verdict: "mostly-correct",
        rubricScores: [
          { rubricKey: parameterKeys[0]!, level: 4, rationale: "Strong." },
          { rubricKey: parameterKeys[1]!, level: 2, rationale: "Weak." }
        ]
      },
      input(null)
    );

    expect(result.rubricScores.map((item) => item.score)).toEqual([
      78,
      30,
      ...parameterKeys.slice(2).map(() => 55)
    ]);
  });

  it("leaves out a parameter the question never asked about", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        verdict: "mostly-correct",
        rubricScores: parameterKeys.map((rubricKey, index) => ({
          rubricKey,
          level: index === 0 ? 0 : 4,
          rationale: index === 0 ? "Not asked." : "Strong."
        }))
      },
      input(null)
    );

    expect(result.rubricScores.map((item) => item.rubricKey)).toEqual(parameterKeys.slice(1));
    expect(result.score).toBe(78);
  });

  it("does not let a targeted question skip a parameter it asked for", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        verdict: "partially-correct",
        rubricScores: [
          { rubricKey: parameterKeys[0]!, level: 0, rationale: "Skipped." },
          { rubricKey: parameterKeys[1]!, level: 4, rationale: "Strong." }
        ]
      },
      {
        ...input(null),
        question: { ...question, evaluationParameterKeys: parameterKeys.slice(0, 2) }
      }
    );

    expect(result.rubricScores.map((item) => item.rubricKey)).toEqual(parameterKeys.slice(0, 2));
  });

  it("does not treat successful execution without tests as proof of correctness", () => {
    const result = normalizeTechnicalEvaluation(
      { ...rawEvaluation, verdict: "incorrect", rubricScores: rated(2) },
      input(execution({ testCount: 0, testsPassed: 0 }))
    );

    expect(result.score).toBe(30);
    expect(result.verdict).toBe("incorrect");
  });

  it("normalizes harmless provider shape drift and drops ungrounded quotes", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        strengths: ["A".repeat(200), "Second", "Third", "Fourth"],
        gaps: ["One", "Two", "Three", "Four"],
        rubricScores: Array.from({ length: 8 }, (_, index) => ({
          rubricKey: index === 0 ? "concept-depth" : `rubric-${index}`,
          level: 4.4,
          rationale: "R".repeat(220)
        })),
        evidenceQuotes: ["not present in the answer"]
      },
      input(null)
    );

    expect(result.strengths).toHaveLength(3);
    expect(result.strengths[0]).toHaveLength(140);
    expect(result.gaps).toHaveLength(3);
    expect(result.rubricScores).toHaveLength(6);
    expect(result.rubricScores[0]).toMatchObject({ rubricKey: "concept-depth", score: 84 });
    expect(result.rubricScores[0]?.rationale).toHaveLength(180);
    expect(result.evidenceQuotes).toEqual([]);
  });

  it("keeps only answer-grounded evidence for each rated parameter", () => {
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        verdict: "partially-correct",
        rubricScores: [
          {
            rubricKey: "concept-depth",
            level: 2,
            rationale: "The answer did not explain the mechanism.",
            evidenceQuotes: ["return true", "this was never said"]
          }
        ]
      },
      input(null)
    );

    expect(result.rubricScores[0]).toMatchObject({
      rubricKey: "concept-depth",
      score: 30,
      evidenceQuotes: ["return true"]
    });
  });

  it("persists only the report parameters intentionally assessed by a resume question", () => {
    const resumeInput: TechnicalAnswerEvaluationInput = {
      ...input(null),
      setup: {
        ...setup,
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      },
      question: {
        ...question,
        kind: "conversation",
        stage: "career",
        evaluationParameterKeys: ["claim-credibility", "communication"]
      }
    };
    const result = normalizeTechnicalEvaluation(
      {
        ...rawEvaluation,
        rubricScores: [
          { rubricKey: "claim-credibility", level: 4, rationale: "Grounded claim." },
          { rubricKey: "communication", level: 3, rationale: "Mostly direct." },
          { rubricKey: "impact-learning", level: 1, rationale: "Not targeted." }
        ]
      },
      resumeInput
    );

    expect(result.rubricScores.map((item) => item.rubricKey)).toEqual([
      "claim-credibility",
      "communication"
    ]);
    expect(buildResumeAnswerEvaluationPrompt(resumeInput)).toContain(
      "exactly these keys and no others: claim-credibility, communication"
    );
  });

  it("requires the model to prioritize factual correctness over fluent delivery", async () => {
    const generateStructured = vi.fn().mockResolvedValue(rawEvaluation);
    const evaluator = new TechnicalAnswerEvaluator({ generateStructured } as unknown as AiService);

    const result = await evaluator.evaluate(input(null));

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "interview.answer.evaluate",
        temperature: 0,
        seed: expect.any(Number),
        modelClass: "fast",
        maxAttempts: 1,
        prompt: expect.stringContaining(
          "A clear answer with a false central mechanism is incorrect"
        )
      })
    );
    expect(buildTechnicalEvaluationPrompt(input(null))).toContain(
      "Compilation or execution without tests is not proof of correctness"
    );
    expect(buildTechnicalEvaluationPrompt(input(null))).not.toContain("architecture canvas");
    expect(
      buildTechnicalEvaluationPrompt({ ...input(null), designCanvas: "Components:\n- Queue (queue)" })
    ).toContain("Candidate's architecture canvas (drawn by the candidate");
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
    expect(prompt).toContain("personal-ownership: Makes personal responsibility");
    expect(prompt).toContain(
      "exactly these keys and no others: claim-credibility, personal-ownership, decision-making"
    );
    expect(prompt).toContain(resumeInput.answers[0]);
    expect(prompt).toContain("evidenceQuotes");
  });

  it("reviews resume code with the task and runner evidence, excluding spoken filler", async () => {
    const resumeCodeInput: TechnicalAnswerEvaluationInput = {
      ...input(execution({ testCount: 0, testsPassed: 0 })),
      setup: {
        ...setup,
        resumeRound: true,
        roundType: "behavioral",
        templateId: "resume-behavioral-defense"
      },
      question: {
        ...question,
        language: "TypeScript",
        codeSnippet: "function retry() { throw new Error('Not implemented'); }",
        evaluationParameterKeys: ["claim-credibility", "specificity", "communication"]
      },
      answers: [
        "Give me a minute.",
        "```typescript\nfunction retry() { return true; }\n```\n\nReasoning: bounded by the caller."
      ]
    };
    const prompt = buildResumeCodeEvaluationPrompt(resumeCodeInput);

    expect(prompt).toContain("Candidate's submitted code and explanation");
    expect(prompt).toContain("Tests: none supplied");
    expect(prompt).toContain(
      "exactly these keys and no others: claim-credibility, specificity, communication"
    );
    expect(prompt).not.toContain("Give me a minute.");

    const generateStructured = vi.fn().mockResolvedValue(rawEvaluation);
    const evaluator = new TechnicalAnswerEvaluator({ generateStructured } as unknown as AiService);
    await evaluator.evaluate(resumeCodeInput);

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "interview.resume-answer.evaluate",
        systemInstruction: expect.stringContaining("resume-based coding exercise"),
        prompt: expect.stringContaining("Successful execution with zero tests")
      })
    );
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
