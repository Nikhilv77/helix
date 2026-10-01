import type { QuestionEvaluation } from "./types";
import {
  answerTexts,
  evaluationAnswerHash,
  InterviewEvaluationRecoveryService,
  type ClaimedEvaluationJob,
  type EvaluationRecoveryRepository
} from "./evaluation-recovery";
import type { TechnicalAnswerEvaluator } from "./technical-answer-evaluator";

const evaluation: QuestionEvaluation = {
  source: "semantic-evaluator",
  score: 78,
  verdict: "mostly-correct",
  confidence: 0.9,
  summary: "Recovered evaluation.",
  strengths: ["Clear ownership."],
  gaps: [],
  rubricScores: [],
  answerExcerpts: ["I owned the rollout."],
  execution: null,
  evaluatedAt: 2_000,
  runtime: {
    engineVersion: "test",
    promptVersion: "test",
    durationMs: 20,
    recovered: false,
    calls: []
  }
};

function job(attempts = 1, maxAttempts = 5): ClaimedEvaluationJob {
  const answers = ["I owned the rollout."];
  return {
    id: "11111111-1111-4111-8111-111111111111",
    attempts,
    maxAttempts,
    payload: {
      sessionId: "22222222-2222-4222-8222-222222222222",
      questionIndex: 0,
      answerHash: evaluationAnswerHash(answers),
      queuedAt: 1_000,
      setup: {
        role: "frontend",
        level: "3-5",
        roundType: "hiring-manager",
        intensity: "realistic",
        context: "Frontend role"
      },
      question: {
        text: "What did you own?",
        mustHit: ["ownership"],
        probeIfMissing: "What was yours?"
      },
      answers,
      rubric: [],
      execution: null,
      evaluatedAt: 1_000
    }
  };
}

describe("interview evaluation recovery", () => {
  it("keeps a declined turn out of the answer a queued grade was taken from", () => {
    const state = {
      turns: [
        {
          speaker: "user",
          text: "Kafka in front of the workers.",
          startMs: 0,
          endMs: 1,
          questionIndex: 1
        },
        { speaker: "agent", text: "Why Kafka?", startMs: 2, endMs: 3, questionIndex: 1 },
        {
          speaker: "user",
          text: "Can we skip this?",
          startMs: 4,
          endMs: 5,
          questionIndex: 1,
          skipped: true,
          assessmentExcluded: true
        }
      ]
    } as unknown as Parameters<typeof answerTexts>[0];

    expect(answerTexts(state, 1)).toEqual(["Kafka in front of the workers."]);
  });

  it("marks a recovered evaluation and applies it once", async () => {
    const repository = {
      claim: vi.fn().mockResolvedValue([job()]),
      apply: vi.fn().mockResolvedValue("applied"),
      fail: vi.fn()
    } satisfies EvaluationRecoveryRepository;
    const evaluator = { evaluate: vi.fn().mockResolvedValue(evaluation) };
    const service = new InterviewEvaluationRecoveryService(
      repository,
      evaluator as unknown as TechnicalAnswerEvaluator
    );

    await expect(service.runBatch(5, 1_000)).resolves.toEqual({
      claimed: 1,
      recovered: 1,
      superseded: 0,
      retried: 0,
      deadLettered: 0
    });
    expect(repository.apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runtime: expect.objectContaining({ recovered: true }) }),
      expect.any(Number)
    );
  });

  it("can grade only one interview's queued answers", async () => {
    const repository = {
      claim: vi.fn().mockResolvedValue([]),
      apply: vi.fn(),
      fail: vi.fn()
    } satisfies EvaluationRecoveryRepository;
    const service = new InterviewEvaluationRecoveryService(repository, {
      evaluate: vi.fn()
    } as unknown as TechnicalAnswerEvaluator);

    await service.runBatch(5, 1_000, { sessionId: "session-1" });

    expect(repository.claim).toHaveBeenCalledWith(5, 1_000, "session-1");
  });

  it("moves exhausted failures to the dead-letter path", async () => {
    const repository = {
      claim: vi.fn().mockResolvedValue([job(5, 5)]),
      apply: vi.fn(),
      fail: vi.fn().mockResolvedValue("dead-letter")
    } satisfies EvaluationRecoveryRepository;
    const evaluator = { evaluate: vi.fn().mockRejectedValue(new Error("still unavailable")) };
    const service = new InterviewEvaluationRecoveryService(
      repository,
      evaluator as unknown as TechnicalAnswerEvaluator
    );

    const result = await service.runBatch();

    expect(result.deadLettered).toBe(1);
    expect(result.retried).toBe(0);
  });

  it("uses a stable cumulative-answer fingerprint", () => {
    expect(evaluationAnswerHash(["  I owned   it. "])).toBe(evaluationAnswerHash(["I owned it."]));
    expect(evaluationAnswerHash(["I owned it."])).not.toBe(evaluationAnswerHash(["We owned it."]));
  });

  it("grades a finished round's answers together and applies them one at a time", async () => {
    const jobs = [job(), { ...job(), id: "33333333-3333-4333-8333-333333333333" }];
    let inFlight = 0;
    let peak = 0;
    const evaluator = {
      evaluate: vi.fn(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return evaluation;
      })
    };
    const applied: string[] = [];
    const repository = {
      claim: vi.fn().mockResolvedValue(jobs),
      apply: vi.fn(async (claimed: ClaimedEvaluationJob) => {
        applied.push(claimed.id);
        return "applied" as const;
      }),
      fail: vi.fn()
    } satisfies EvaluationRecoveryRepository;
    const service = new InterviewEvaluationRecoveryService(
      repository,
      evaluator as unknown as TechnicalAnswerEvaluator
    );

    const result = await service.runBatch(20, 1_000, { sessionId: jobs[0]!.payload.sessionId });

    expect(peak).toBe(2);
    expect(applied).toEqual(jobs.map((item) => item.id));
    expect(result).toMatchObject({ claimed: 2, recovered: 2 });
  });
});
