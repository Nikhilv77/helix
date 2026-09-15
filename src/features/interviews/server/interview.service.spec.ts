import { InterviewDecider } from "./decider";
import { buildFundamentalsPlan } from "./fundamentals-round";
import { InterviewPlanner } from "./planner";
import {
  candidateDeclinesQuestion,
  candidateNeedsInterviewBreak,
  candidateRequestsInterviewEnd,
  executionForEvaluation,
  InterviewService,
  qualityCheckedFollowUp,
  rubricFor
} from "./interview.service";
import { codeFingerprint } from "./code-fingerprint";
import { MemorySessionStore, SESSION_TTL_MS } from "./session-store";
import type { TechnicalAnswerEvaluator } from "./technical-answer-evaluator";
import type { InterviewSetup, PlannedQuestion, QuestionEvaluation } from "./types";
import {
  LIVE_DECISION_DEADLINE_MS,
  LIVE_EVALUATION_DEADLINE_MS
} from "../domain/voice-turn-timing";

const setup: InterviewSetup = {
  role: "frontend",
  level: "3-5",
  roundType: "technical",
  intensity: "realistic",
  context: "Built a collaborative editor and owned its offline synchronization."
};

const questions: PlannedQuestion[] = [
  {
    text: "What part of the editor did you personally own?",
    competency: "Ownership",
    intent: "Separate personal contribution from the wider team's work.",
    mustHit: ["personal scope", "specific implementation"],
    probeIfMissing: "Which implementation decision was yours alone?"
  },
  {
    text: "Which synchronization trade-off had the largest user impact?",
    competency: "Technical judgement",
    intent: "Understand how the candidate balanced consistency and usability.",
    mustHit: ["trade-off", "user impact"],
    probeIfMissing: "What did users lose because of that choice?"
  }
];

function harness(plan = questions, evaluation?: QuestionEvaluation) {
  const planQuestions = vi.fn().mockResolvedValue(plan);
  const planner = { plan: planQuestions } as unknown as InterviewPlanner;
  const decide = vi.fn();
  const decider = { decide } as unknown as InterviewDecider;
  const evaluate = vi.fn().mockResolvedValue(evaluation);
  const evaluator = evaluation ? ({ evaluate } as unknown as TechnicalAnswerEvaluator) : undefined;
  const store = new MemorySessionStore();
  const service = new InterviewService(planner, decider, store, 10, evaluator);

  return { service, store, decide, evaluate, planQuestions };
}

const mcqQuestion: PlannedQuestion = {
  text: "Which hook keeps a value stable between renders without causing one?",
  evidenceAnchor: "React",
  kind: "mcq",
  stage: "skills",
  skill: "React",
  options: ["useState", "useRef", "useMemo"],
  answerIndex: 1,
  explanation: "useRef survives renders without triggering one.",
  answerFormat: "mcq",
  competency: "Technical depth",
  intent: "Check the candidate knows what useRef is for.",
  mustHit: ["names useRef"],
  probeIfMissing: "Which of those does not re-render?"
};

describe("InterviewService resume round", () => {
  it("recognizes clear question refusals without swallowing substantive negative answers", () => {
    expect(candidateDeclinesQuestion("No.")).toBe(true);
    expect(candidateDeclinesQuestion("Pass, thanks.")).toBe(true);
    expect(candidateDeclinesQuestion("I don't know.")).toBe(true);
    expect(candidateDeclinesQuestion("I'm not comfortable sharing this.")).toBe(true);
    expect(candidateDeclinesQuestion("I will not tell you.")).toBe(true);
    expect(candidateDeclinesQuestion("I want answer. I will not tell you.")).toBe(true);
    expect(candidateDeclinesQuestion("No, I don't want to answer this.")).toBe(true);
    expect(candidateDeclinesQuestion("Well, I'd rather not discuss that.")).toBe(true);
    expect(candidateDeclinesQuestion("No idea.")).toBe(true);
    expect(candidateDeclinesQuestion("I have no idea.")).toBe(true);
    expect(candidateDeclinesQuestion("I have absolutely no clue about that.")).toBe(true);
    expect(candidateDeclinesQuestion("Nothing comes to mind.")).toBe(true);
    expect(candidateDeclinesQuestion("I can't recall right now.")).toBe(true);

    expect(candidateDeclinesQuestion("No, I did not add an index; I ran ANALYZE first.")).toBe(
      false
    );
    expect(candidateDeclinesQuestion("I'm not sure, but I would inspect the query plan.")).toBe(
      false
    );
  });

  it("recognizes explicit candidate withdrawal without confusing weak answers for an exit", () => {
    expect(candidateRequestsInterviewEnd("Can we end here?")).toBe(true);
    expect(candidateRequestsInterviewEnd("Let's stop here.")).toBe(true);
    expect(candidateRequestsInterviewEnd("I don't want to continue anymore.")).toBe(true);
    expect(candidateRequestsInterviewEnd("James, please end it now.")).toBe(true);
    expect(candidateRequestsInterviewEnd("I want to leave this interview.")).toBe(true);
    expect(candidateRequestsInterviewEnd("Stop now.")).toBe(true);

    expect(candidateRequestsInterviewEnd("I just want to sleep.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I'm too tired to continue.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I don't want to explain anymore.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I'm not really sure.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I don't know.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I want to stop duplicate requests.")).toBe(false);
    expect(candidateRequestsInterviewEnd("I was tired, but I completed the migration.")).toBe(
      false
    );
    expect(candidateRequestsInterviewEnd("I couldn't explain the cache invalidation.")).toBe(false);
  });

  it("recognizes fatigue as a request for support rather than an explicit exit", () => {
    expect(candidateNeedsInterviewBreak("I just want to sleep.")).toBe(true);
    expect(candidateNeedsInterviewBreak("I'm too tired to continue.")).toBe(true);
    expect(candidateNeedsInterviewBreak("I just wanna sleep.")).toBe(true);
    expect(candidateNeedsInterviewBreak("I need some sleep.")).toBe(true);
    expect(candidateNeedsInterviewBreak("I don't want to explain anymore.")).toBe(true);

    expect(candidateNeedsInterviewBreak("Can we end here?")).toBe(false);
    expect(candidateNeedsInterviewBreak("I was tired, but I completed the migration.")).toBe(false);
  });

  it("offers a break without ending or assessing the interview when the candidate is tired", async () => {
    const { service, decide, evaluate } = harness([questions[0]!]);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [questions[0]!]
    );

    const result = await service.answer(
      started.state.id,
      { text: "I just want to sleep.", startMs: 500, endMs: 1_000 },
      2_000
    );
    const report = await service.report("user-1", started.state.id, 3_000);

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.phase).toBe("questioning");
    expect(result.response.phase).toBe("questioning");
    expect(result.decision.utterance).toBe(
      "It sounds like you need some rest. Take a short break if you need one. If you want to stop now, say “end the interview”; otherwise, we can continue when you're ready."
    );
    const supportRequest = result.state.turns.find((turn) => turn.assessmentExcluded);
    expect(supportRequest).toMatchObject({
      speaker: "user",
      text: "I just want to sleep.",
      assessmentExcluded: true
    });
    expect(supportRequest).not.toHaveProperty("questionIndex");
    expect(report.answerCount).toBe(0);
    expect(report.questionsCovered).toBe(0);
    expect(report.competencies[0]?.answered).toBe(false);
  });

  it("acknowledges a refusal, skips the question, and excludes it from scoring", async () => {
    const { service, decide, evaluate } = harness(questions);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      questions
    );

    const result = await service.answer(
      started.state.id,
      { text: "I have no idea.", startMs: 500, endMs: 1_000 },
      2_000
    );
    const report = await service.report("user-1", started.state.id, 3_000);

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.phase).toBe("questioning");
    expect(result.state.questionIndex).toBe(1);
    expect(result.decision.utterance).toBe(
      `Understood — we'll skip that one. ${questions[1]!.text}`
    );
    expect(result.state.turns.find((turn) => turn.text === "I have no idea.")).toMatchObject({
      speaker: "user",
      questionIndex: 0,
      skipped: true,
      assessmentExcluded: true
    });
    expect(report.answerCount).toBe(0);
    expect(report.questionsCovered).toBe(0);
    expect(report.competencies[0]?.answered).toBe(false);
  });

  it("uses Gemini's semantic intent for refusals that are not fixed phrases", async () => {
    const { service, decide, evaluate } = harness(questions);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      questions
    );
    const candidateWords = "I'd prefer to keep that part of my background private, if that's okay.";

    expect(candidateDeclinesQuestion(candidateWords)).toBe(false);
    const result = await service.answer(
      started.state.id,
      { text: candidateWords, startMs: 500, endMs: 1_000 },
      2_000,
      undefined,
      {
        action: "move_on",
        missing: "none",
        candidateIntent: "decline",
        acknowledgement: "",
        line: "",
        reason: "The candidate declined the current question."
      }
    );

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.questionIndex).toBe(1);
    expect(result.decision.utterance).toBe(
      `Understood — we'll skip that one. ${questions[1]!.text}`
    );
  });

  it("ends respectfully after three consecutive question refusals", async () => {
    const plan = [
      ...questions,
      { ...questions[0]!, text: "What did you learn from that decision?" },
      { ...questions[1]!, text: "What would you do differently now?" }
    ];
    const { service, decide, evaluate } = harness(plan);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      plan
    );

    await service.answer(started.state.id, { text: "No.", startMs: 500, endMs: 1_000 }, 2_000);
    await service.answer(
      started.state.id,
      { text: "I prefer not to answer.", startMs: 1_500, endMs: 2_000 },
      3_000
    );
    const result = await service.answer(
      started.state.id,
      { text: "I will not tell you.", startMs: 2_500, endMs: 3_000 },
      4_000
    );

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.phase).toBe("done");
    expect(result.decision.utterance).toBe(
      "Understood. Since you'd prefer not to answer these questions, I'll end the interview here. Thank you for your time."
    );
    expect(result.decision.utterance).not.toContain(plan[3]!.text);
  });

  it("still ends immediately after an unambiguous stop command", async () => {
    const { service, decide, evaluate } = harness([questions[0]!]);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [questions[0]!]
    );

    const result = await service.answer(
      started.state.id,
      { text: "End the interview.", startMs: 500, endMs: 1_000 },
      2_000
    );

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.phase).toBe("done");
    expect(result.decision.utterance).toBe(
      "Of course, we'll end the interview here. I'll save what we covered, and your feedback will be ready shortly."
    );
  });

  it("answers a candidate clarification and keeps the pending question active", async () => {
    const evaluation: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 70,
      verdict: "mostly-correct",
      confidence: 0.8,
      summary: "Placeholder that must not be used for a conversational turn.",
      strengths: [],
      gaps: [],
      rubricScores: [],
      answerExcerpts: [],
      execution: null,
      evaluatedAt: 2_000
    };
    const careerQuestion = {
      ...questions[0]!,
      text: "Which role or transition was most meaningful to you?",
      stage: "career" as const,
      maxFollowUps: 3
    };
    const { service, decide, evaluate } = harness([careerQuestion], evaluation);
    decide.mockResolvedValue({
      action: "respond",
      missing: "none",
      reason: "candidate asked what role means",
      acknowledgement: "",
      candidateResponse:
        "By role, I mean a job or position you held and the responsibilities you had.",
      line: "Which job or career change mattered most to you?"
    });
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [careerQuestion]
    );

    const result = await service.answer(
      started.state.id,
      { text: "What do you mean by role?", startMs: 500, endMs: 1_000 },
      2_000
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({ candidateTurnMode: "conversation" })
    );
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.decision.action).toBe("respond");
    expect(result.decision.utterance).toBe(
      "By role, I mean a job or position you held and the responsibilities you had. Which job or career change mattered most to you?"
    );
    expect(result.state.questionIndex).toBe(0);
    expect(result.state.followUpCount).toBe(0);
    expect(result.state.evidence).toEqual({});
  });

  it("falls back locally for candidate small talk instead of asking an interview probe", async () => {
    const { service, decide } = harness([questions[0]!]);
    decide.mockRejectedValue(new Error("provider unavailable"));
    const started = await service.start(setup, "user-1", 1_000, [questions[0]!]);

    const result = await service.answer(
      started.state.id,
      { text: "How are you doing today?", startMs: 500, endMs: 1_000 },
      2_000
    );

    expect(result.decision.action).toBe("respond");
    expect(result.decision.utterance).toBe(
      "I'm doing well, thanks for asking. What part of the editor did you personally own?"
    );
    expect(result.state.questionIndex).toBe(0);
    expect(result.state.followUpCount).toBe(0);
  });

  it("replaces generic or repeated follow-ups with the authored grounded probe", () => {
    const turns = [
      {
        speaker: "agent" as const,
        text: "What did you personally own?",
        startMs: 0,
        endMs: 0
      }
    ];

    expect(
      qualityCheckedFollowUp(
        "Can you elaborate?",
        "What did you personally own?",
        turns,
        "Which implementation decision was yours alone?"
      )
    ).toBe("Which implementation decision was yours alone?");
    expect(
      qualityCheckedFollowUp(
        "What did you personally own?",
        "What did you personally own?",
        turns,
        "Which implementation decision was yours alone?"
      )
    ).toBe("Which implementation decision was yours alone?");
  });

  it("freezes runtime versions on new sessions and decision turns", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answered",
      acknowledgement: "That helps",
      line: ""
    });

    const started = await service.start(setup, "user-1", 1_000);
    const answered = await service.answer(
      started.state.id,
      { text: "I owned the sync layer and its rollout.", startMs: 0, endMs: 900 },
      2_000
    );

    expect(started.state.runtimeVersion).toMatchObject({
      engine: expect.any(String),
      deciderPrompt: expect.any(String),
      evaluatorPrompt: expect.any(String)
    });
    expect(answered.state.turns.at(-1)?.runtime).toMatchObject({
      engineVersion: expect.any(String),
      promptVersion: expect.any(String),
      durationMs: expect.any(Number)
    });
  });

  it("queues a failed semantic evaluation without counting it as a score", async () => {
    const placeholder: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 70,
      verdict: "mostly-correct",
      confidence: 0.8,
      summary: "Placeholder",
      strengths: [],
      gaps: [],
      rubricScores: [],
      answerExcerpts: [],
      execution: null,
      evaluatedAt: 2_000
    };
    const { service, store, decide, evaluate } = harness([questions[0]!], placeholder);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answered",
      acknowledgement: "",
      line: ""
    });
    evaluate.mockRejectedValue(new Error("provider unavailable"));
    const started = await service.start(setup, "user-1", 1_000, [questions[0]!]);

    const answered = await service.answer(
      started.state.id,
      { text: "I owned the conflict resolver.", startMs: 0, endMs: 900 },
      2_000,
      "99999999-9999-4999-8999-999999999999"
    );

    expect(answered.state.questionEvaluations?.["0"]?.source).toBe("evaluation-unavailable");
    expect(store.evaluationRecoveryCount()).toBe(1);
  });

  it("uses the frozen five-metric rubric and excludes stale block execution from evaluation", () => {
    const blockSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 2,
        rubricVersion: 1
      }
    };
    const question = {
      ...questions[0]!,
      rubricKeys: [
        "pattern-recognition",
        "correctness-edge-cases",
        "efficiency",
        "code-quality",
        "communication"
      ]
    };
    expect(rubricFor(blockSetup, question)?.map((item) => [item.key, item.weightPercent])).toEqual([
      ["pattern-recognition", 20],
      ["correctness-edge-cases", 30],
      ["efficiency", 20],
      ["code-quality", 15],
      ["communication", 15]
    ]);
    const code = "function solve() {}";
    const state = {
      setup: blockSetup,
      codeExecutions: { "0": { codeHash: codeFingerprint(code) } }
    } as unknown as import("./types").InterviewState;
    expect(executionForEvaluation(state, 0, [`\`\`\`javascript\n${code}\n\`\`\``])).not.toBeNull();
    expect(
      executionForEvaluation(state, 0, ["```javascript\nfunction changed() {}\n```"])
    ).toBeNull();
  });

  it("reuses a reserved session ID without creating a second interview", async () => {
    const { service, store } = harness();
    const reserved = "11111111-1111-4111-8111-111111111111";
    const first = await service.start(setup, "user-1", 1_000, questions, reserved);
    const resumed = await service.start(setup, "user-1", 2_000, questions, reserved);

    expect(first.created).toBe(true);
    expect(resumed.created).toBe(false);
    expect(resumed.state.id).toBe(reserved);
    expect(await store.countStartedSince("user-1", 0)).toBe(1);
  });

  it("reactivates an incomplete DSA block assessment after the ordinary room TTL", async () => {
    const now = Date.parse("2026-09-07T19:19:21Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { service, store } = harness();
    const reserved = "77777777-7777-4777-8777-777777777777";
    const assessmentSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 1,
        rubricVersion: 1
      }
    };
    const started = await service.start(assessmentSetup, "user-1", now, questions, reserved);

    vi.mocked(Date.now).mockReturnValue(now + SESSION_TTL_MS + 1);
    await expect(store.getActiveOwned(reserved, "user-1")).resolves.toBeNull();
    await expect(service.getOwnedActive("user-1", reserved)).resolves.toMatchObject({
      id: started.state.id,
      setup: { dsaBlockAssessment: { kind: "dsa-block-assessment" } },
      phase: "questioning"
    });
    await expect(store.getActiveOwned(reserved, "user-1")).resolves.toMatchObject({ id: reserved });

    vi.restoreAllMocks();
  });

  it("does not revive an expired ordinary interview", async () => {
    const now = Date.parse("2026-09-07T19:19:21Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { service } = harness();
    const started = await service.start(setup, "user-1", now, questions);

    vi.mocked(Date.now).mockReturnValue(now + SESSION_TTL_MS + 1);
    await expect(service.getOwnedActive("user-1", started.state.id)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    });

    vi.restoreAllMocks();
  });

  it("keeps an incomplete block assessment resumable instead of submitting it", async () => {
    const { service, store } = harness();
    const assessmentSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 1,
        rubricVersion: 1
      }
    };
    const started = await service.start(assessmentSetup, "user-1", 1_000, questions);

    await expect(service.endOwned("user-1", started.state.id)).rejects.toMatchObject({
      code: "ASSESSMENT_INCOMPLETE"
    });
    expect((await store.get(started.state.id))?.phase).not.toBe("done");
  });

  it("records an idempotent zero for a skipped transfer problem and advances", async () => {
    const { service, store, decide } = harness();
    const assessmentSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 1,
        rubricVersion: 1
      }
    };
    const codeQuestion: PlannedQuestion = {
      ...questions[0]!,
      kind: "code",
      rubricKeys: [
        "pattern-recognition",
        "correctness-edge-cases",
        "efficiency",
        "code-quality",
        "communication"
      ]
    };
    const started = await service.start(assessmentSetup, "user-1", 1_000, [
      codeQuestion,
      codeQuestion
    ]);
    const turnId = "33333333-3333-4333-8333-333333333333";

    const first = await service.skipBlockAssessmentCodeOwned(
      "user-1",
      started.state.id,
      { startMs: 100, endMs: 200 },
      1_200,
      turnId
    );
    const replay = await service.skipBlockAssessmentCodeOwned(
      "user-1",
      started.state.id,
      { startMs: 100, endMs: 200 },
      1_300,
      turnId
    );

    expect(first.state.questionIndex).toBe(1);
    expect(replay.state.questionIndex).toBe(1);
    expect(replay.state.turns.filter((turn) => turn.skipped)).toHaveLength(1);
    expect(replay.state.questionEvaluations?.["0"]?.rubricScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rubricKey: "correctness-edge-cases", score: 0 })
      ])
    );
    expect(decide).not.toHaveBeenCalled();
    expect((await store.get(started.state.id))?.phase).toBe("questioning");
  });

  it("grades a frozen block-review MCQ through the server-side resolver, not a plan answer index", async () => {
    const { service, decide } = harness();
    service.setBlockAssessmentMcqGrader({
      gradeReviewAnswer: vi.fn().mockResolvedValue({
        correct: true,
        explanation: "The persisted execution evidence supports this option."
      })
    });
    const assessmentSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 1,
        rubricVersion: 1
      }
    };
    const started = await service.start(assessmentSetup, "user-1", 1_000, [
      {
        ...mcqQuestion,
        dsaAssessmentReviewItemId: "review-1",
        // A deliberately incorrect local key proves only the trusted resolver
        // is used for a frozen assessment.
        answerIndex: 0,
        explanation: undefined
      }
    ]);

    const result = await service.answerOwned(
      "user-1",
      started.state.id,
      { text: "useRef", startMs: 100, endMs: 200 },
      1_200
    );
    expect(result.state.turns.at(-1)).toMatchObject({ correct: true });
    expect(result.response.utterance).toContain("persisted execution evidence");
    expect(decide).not.toHaveBeenCalled();
  });

  it("uses human assessment dialogue and the trusted answer between review questions", async () => {
    const { service, decide } = harness();
    service.setBlockAssessmentMcqGrader({
      gradeReviewAnswer: vi.fn().mockResolvedValue({
        correct: false,
        explanation: "The saved loop visits each element once.",
        correctAnswer: "O(n)"
      })
    });
    const assessmentSetup: InterviewSetup = {
      ...setup,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 2,
        rubricVersion: 1
      }
    };
    const reviewQuestion: PlannedQuestion = {
      ...mcqQuestion,
      stage: "rapid",
      dsaAssessmentReviewItemId: "review-1",
      answerIndex: undefined,
      explanation: undefined
    };
    const nextQuestion = { ...reviewQuestion, text: "Which edge case breaks this loop?" };
    const started = await service.start(
      assessmentSetup,
      "user-1",
      1_000,
      [reviewQuestion, nextQuestion],
      "11111111-1111-4111-8111-111111111111"
    );

    expect(started.utterance).toContain(reviewQuestion.text);
    expect(started.utterance).not.toContain("I'm James");

    const result = await service.answerOwned(
      "user-1",
      started.state.id,
      { text: "O(n²)", startMs: 100, endMs: 200 },
      1_200
    );

    expect(decide).not.toHaveBeenCalled();
    expect(result.decision.utterance).toContain("O(n)");
    expect(result.decision.utterance).toContain("saved loop visits each element once");
    expect(result.decision.utterance).toContain(nextQuestion.text);
  });

  it("does not expose a live session to a different owner", async () => {
    const { service } = harness();
    const started = await service.start(setup, "user-1", 1_000);

    await expect(service.getOwnedActive("user-2", started.state.id)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    });
    await expect(service.endOwned("user-2", started.state.id)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    });
  });

  it("starts from a prebuilt plan without asking the planner for one", async () => {
    const { service, planQuestions } = harness();
    const result = await service.start({ ...setup, resumeRound: true }, "user-1", 1_000, [
      mcqQuestion,
      questions[0]!
    ]);

    expect(planQuestions).not.toHaveBeenCalled();
    expect(result.state.plan).toHaveLength(2);
    expect(result.state.plan[0]?.kind).toBe("mcq");
  });

  it("grades a multiple choice answer without calling the decider", async () => {
    const { service, decide } = harness();
    const started = await service.start({ ...setup, resumeRound: true }, "user-1", 1_000, [
      mcqQuestion,
      questions[0]!
    ]);

    const { state, decision } = await service.answer(
      started.state.id,
      { text: "useRef", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(decide).not.toHaveBeenCalled();
    expect(decision.action).toBe("move_on");
    expect(decision.utterance).toContain("That's right");
    // James moves straight into the next question, as he does after any move_on.
    expect(decision.utterance).toContain(questions[0]!.text);
    expect(state.questionIndex).toBe(1);
    expect(state.questionEvaluations?.["0"]).toMatchObject({
      source: "local-mcq",
      score: 100,
      verdict: "correct"
    });
  });

  it("names the right option after a wrong answer, still without a model call", async () => {
    const { service, decide } = harness();
    const started = await service.start({ ...setup, resumeRound: true }, "user-1", 1_000, [
      mcqQuestion,
      questions[0]!
    ]);

    const { state, decision } = await service.answer(
      started.state.id,
      { text: "useMemo", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(decide).not.toHaveBeenCalled();
    expect(decision.utterance).toContain("useRef");
    const reply = state.turns.at(-1);
    expect(reply).toMatchObject({ speaker: "agent", correct: false, gradedQuestionIndex: 0 });
  });

  it("sends a written skills answer through the decider as usual", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answered",
      acknowledgement: "",
      line: ""
    });
    const started = await service.start({ ...setup, resumeRound: true }, "user-1", 1_000, [
      questions[0]!,
      questions[1]!
    ]);

    await service.answer(
      started.state.id,
      { text: "I owned the sync layer end to end.", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("re-scores the complete answer together with its saved follow-up", async () => {
    const evaluation: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 72,
      verdict: "mostly-correct",
      confidence: 0.9,
      summary: "The follow-up supplied the missing outcome.",
      strengths: ["Explains personal ownership."],
      gaps: [],
      rubricScores: [],
      answerExcerpts: [],
      execution: null,
      evaluatedAt: 3_000
    };
    const followUpQuestion = { ...questions[0]!, maxFollowUps: 1 };
    const { service, decide, evaluate } = harness([followUpQuestion], evaluation);
    decide
      .mockResolvedValueOnce({
        action: "probe",
        missing: "outcome",
        reason: "the result is missing",
        acknowledgement: "",
        line: "What changed after you shipped it?"
      })
      .mockResolvedValueOnce({
        action: "move_on",
        missing: "none",
        reason: "the result is now clear",
        acknowledgement: "That helps",
        line: ""
      });
    const started = await service.start(
      { ...setup, resumeRound: true, roundType: "hiring-manager" },
      "user-1",
      1_000,
      [followUpQuestion]
    );

    await service.answer(
      started.state.id,
      { text: "I owned the retry flow.", startMs: 0, endMs: 1_000 },
      2_000
    );
    await service.answer(
      started.state.id,
      { text: "It reduced failed checkouts by 18 percent.", startMs: 1_500, endMs: 2_500 },
      3_000
    );

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        answers: ["I owned the retry flow.", "It reduced failed checkouts by 18 percent."]
      })
    );
  });

  it("speaks a server-approved answer to the candidate's final HR question before closing", async () => {
    const closingQuestion = {
      ...questions[0]!,
      text: "What matters to you in a manager, and what would you like to ask me?",
      stage: "behavioral" as const,
      maxFollowUps: 0,
      acceptsCandidateQuestions: true
    };
    const { service, decide } = harness([closingQuestion]);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "candidate asked a closing question",
      acknowledgement: "That’s a useful question",
      line: "",
      candidateResponse:
        "Success means taking clear ownership while working constructively with the team."
    });
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [closingQuestion]
    );

    const result = await service.answer(
      started.state.id,
      {
        text: "I value direct feedback. What does success look like in this role?",
        startMs: 500,
        endMs: 2_000
      },
      3_000
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({ acceptsCandidateQuestions: true })
    );
    expect(result.decision.utterance).toContain("Success means taking clear ownership");
    expect(result.decision.utterance).toContain("Speaking generally for this simulation");
    expect(result.decision.utterance).toContain("Thanks for the conversation");
    expect(result.state.phase).toBe("done");
  });
});

describe("InterviewService answer idempotency", () => {
  const answer = {
    text: "I owned the conflict resolver and reduced merge failures by 30 percent.",
    startMs: 500,
    endMs: 4_000
  };
  const decision = {
    action: "move_on" as const,
    missing: "none" as const,
    reason: "answer complete",
    acknowledgement: "That is clear",
    line: ""
  };

  it("replays a completed response when the same turn is retried", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue(decision);
    const started = await service.start(setup, "user-1", 1_000);
    const turnId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const first = await service.answer(started.state.id, answer, 6_000, turnId);
    const retry = await service.answer(started.state.id, answer, 7_000, turnId);

    expect(retry.response).toEqual(first.response);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(retry.state.turns.filter((turn) => turn.speaker === "user")).toHaveLength(1);
  });

  it("coalesces simultaneous duplicates behind one decision", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue(decision);
    const started = await service.start(setup, "user-1", 1_000);
    const turnId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const [first, duplicate] = await Promise.all([
      service.answer(started.state.id, answer, 6_000, turnId),
      service.answer(started.state.id, answer, 6_000, turnId)
    ]);

    expect(duplicate.response).toEqual(first.response);
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("rejects reusing a turn ID for a different answer", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue(decision);
    const started = await service.start(setup, "user-1", 1_000);
    const turnId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    await service.answer(started.state.id, answer, 6_000, turnId);
    await expect(
      service.answer(
        started.state.id,
        { ...answer, text: "A different payload using the old identity." },
        7_000,
        turnId
      )
    ).rejects.toMatchObject({ code: "TURN_ID_REUSED" });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("rejects one of two different turns racing on the same version", async () => {
    const { service, decide } = harness();
    let releaseDecision!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseDecision = resolve;
    });
    decide.mockImplementation(async () => {
      await gate;
      return decision;
    });
    const started = await service.start(setup, "user-1", 1_000);
    const first = service.answer(
      started.state.id,
      answer,
      6_000,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    );
    const second = service.answer(
      started.state.id,
      { ...answer, text: `${answer.text} Second callback.` },
      6_000,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    );

    while (decide.mock.calls.length < 2) await Promise.resolve();
    releaseDecision();
    const results = await Promise.allSettled([first, second]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({ code: "SESSION_VERSION_CONFLICT" });
    const finalState = await service.get(started.state.id);
    expect(finalState.turns.filter((turn) => turn.speaker === "user")).toHaveLength(1);
  });
});

describe("InterviewService fundamentals round", () => {
  it("starts from the bank without calling the planner or the decider", async () => {
    const { service, decide, planQuestions } = harness();
    const plan = buildFundamentalsPlan("3-5", { shuffle: (items) => items });

    const started = await service.start(
      { ...setup, fundamentalsRound: true, roundType: "technical" },
      "user-1",
      1_000,
      plan
    );
    const first = started.state.plan[0]!;

    const { decision } = await service.answer(
      started.state.id,
      { text: first.options![first.answerIndex!]!, startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(planQuestions).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(decision.utterance).toContain("That's right");
  });

  it("sends a spoken fundamentals answer to the decider", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answered",
      acknowledgement: "",
      line: ""
    });
    const plan = buildFundamentalsPlan("3-5", { shuffle: (items) => items });
    // The explain stage begins once the rapid questions are behind us.
    const spoken = plan.filter((question) => question.stage === "explain");

    const started = await service.start(
      { ...setup, fundamentalsRound: true, roundType: "technical" },
      "user-1",
      1_000,
      spoken
    );
    await service.answer(
      started.state.id,
      { text: "Because the response is stale and needs revalidating.", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(decide).toHaveBeenCalledTimes(1);
  });
});

describe("InterviewService personalized blueprint evidence", () => {
  it("passes trusted constraints to the decider and persists attributable answer evidence", async () => {
    const { service, decide } = harness();
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answered",
      acknowledgement: "",
      line: ""
    });
    const personalizedSetup: InterviewSetup = {
      ...setup,
      personalizedPlanId: "plan-1",
      personalizedBlueprint: {
        id: "blueprint-1",
        kind: "core-technical",
        order: 2,
        title: "React Deep Dive",
        subtitle: "Mechanisms and trade-offs",
        durationMinutes: 35,
        difficulty: "intermediate",
        rationale: "React is central to the target role.",
        topics: [
          {
            key: "react",
            label: "React",
            targetPercent: 100,
            skillKeys: ["react", "typescript"],
            objectives: ["Explain state and rendering trade-offs"]
          }
        ],
        structure: [
          {
            kind: "core",
            questionCount: 1,
            formats: ["spoken"],
            purpose: "Probe mechanisms."
          }
        ],
        followUpPolicy: {
          maxPerQuestion: 3,
          probeWeakClaims: true,
          increaseDifficultyAfterStrongAnswer: true,
          stayWithinBlueprintTopics: true
        },
        rubric: [
          {
            key: "depth",
            label: "Technical depth",
            weightPercent: 100,
            strongSignals: ["Explains rendering behavior"],
            weakSignals: ["Only names hooks"]
          }
        ]
      }
    };
    const personalizedQuestion: PlannedQuestion = {
      ...questions[0]!,
      blueprintStage: "core",
      blueprintDifficulty: "intermediate",
      blueprintFormat: "spoken",
      topicKey: "react",
      skillKeys: ["react", "typescript"],
      rubricKeys: ["depth"],
      maxFollowUps: 3
    };
    const started = await service.start(personalizedSetup, "user-personalized", 1_000, [
      personalizedQuestion
    ]);

    const { state } = await service.answer(
      started.state.id,
      {
        text: "I chose local state because it reduced rerenders for our 2,000 users.",
        startMs: 0,
        endMs: 1_000
      },
      2_000
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        maxFollowUps: 3,
        topicLabel: "React",
        blueprintDifficulty: "intermediate",
        rubric: [expect.objectContaining({ key: "depth" })]
      })
    );
    expect(state.evidence?.["0"]?.blueprint).toEqual({
      planId: "plan-1",
      blueprintId: "blueprint-1",
      stage: "core",
      topicKey: "react",
      skillKeys: ["react", "typescript"],
      rubricKeys: ["depth"],
      answerExcerpts: ["I chose local state because it reduced rerenders for our 2,000 users."]
    });
  });

  it("persists a dedicated technical verdict instead of inferring correctness from fluency", async () => {
    const evaluation: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 24,
      verdict: "incorrect",
      confidence: 0.94,
      summary: "The answer reverses React's state update behavior.",
      strengths: ["Names the relevant API."],
      gaps: ["The central rendering mechanism is technically incorrect."],
      rubricScores: [
        { rubricKey: "technical-correctness", score: 24, rationale: "Central claim is false." }
      ],
      answerExcerpts: ["A very clear but incorrect answer."],
      execution: null,
      evaluatedAt: 2_000
    };
    const { service, decide, evaluate } = harness([questions[0]!], evaluation);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "clear response",
      acknowledgement: "",
      line: ""
    });
    const started = await service.start(setup, "user-technical", 1_000, [questions[0]!]);

    const result = await service.answer(
      started.state.id,
      { text: "A very clear but incorrect answer.", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(result.state.questionEvaluations?.["0"]).toEqual(evaluation);
  });

  it("attaches authored test results to the correctness evaluation", async () => {
    const codeQuestion: PlannedQuestion = {
      ...questions[0]!,
      kind: "code",
      language: "JavaScript",
      codeTask: "Implement retry()."
    };
    const execution = {
      language: "JavaScript",
      status: "1/3 tests passed",
      accepted: false,
      testsPassed: 1,
      testCount: 3,
      compileOutput: "",
      stderr: "",
      time: "0.01",
      memory: 512,
      recordedAt: 1_500
    };
    const evaluation: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 35,
      verdict: "incorrect",
      confidence: 0.98,
      summary: "The implementation fails two authored tests.",
      strengths: [],
      gaps: ["Retry bounds are incorrect."],
      rubricScores: [],
      answerExcerpts: ["function retry() {}"],
      execution,
      evaluatedAt: 2_000
    };
    const { service, decide, evaluate } = harness([codeQuestion], evaluation);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "submitted",
      acknowledgement: "",
      line: ""
    });
    const started = await service.start(setup, "user-code", 1_000, [codeQuestion]);
    await service.recordCodeExecution("user-code", started.state.id, 0, execution);

    await service.answer(
      started.state.id,
      { text: "function retry() {}", startMs: 0, endMs: 1_000 },
      2_000
    );

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ execution }));
  });
});

describe("InterviewService conversation", () => {
  it("falls back inside the conversational deadline when the decider stalls", async () => {
    vi.useFakeTimers();
    try {
      const { service, decide } = harness();
      decide.mockImplementation(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          })
      );
      const started = await service.start(setup, "user-latency", 1_000);
      const pending = service.answer(
        started.state.id,
        {
          text: "I chose React because I wanted to build interactive products.",
          startMs: 0,
          endMs: 1_000
        },
        2_000
      );

      await vi.advanceTimersByTimeAsync(LIVE_DECISION_DEADLINE_MS);
      const result = await pending;

      expect(result.decision.utterance).toContain("Which implementation decision was yours alone?");
      expect(result.decision.utterance).toContain(".");
    } finally {
      vi.useRealTimers();
    }
  });

  it("queues slow evaluation without extending the decision deadline", async () => {
    vi.useFakeTimers();
    try {
      const seedEvaluation: QuestionEvaluation = {
        source: "semantic-evaluator",
        score: 70,
        verdict: "mostly-correct",
        confidence: 0.8,
        summary: "Evidence supplied.",
        strengths: [],
        gaps: [],
        rubricScores: [],
        answerExcerpts: [],
        execution: null,
        evaluatedAt: 2_000
      };
      const { service, decide, evaluate } = harness([questions[0]!], seedEvaluation);
      decide.mockResolvedValue({
        action: "move_on",
        missing: "none",
        reason: "answered",
        acknowledgement: "React was the entry point",
        line: ""
      });
      evaluate.mockImplementation(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          })
      );
      const started = await service.start(setup, "user-evaluation-latency", 1_000, [questions[0]!]);
      const pending = service.answer(
        started.state.id,
        { text: "I owned the sync layer.", startMs: 0, endMs: 1_000 },
        2_000
      );

      await vi.advanceTimersByTimeAsync(LIVE_EVALUATION_DEADLINE_MS);
      const result = await pending;

      expect(result.state.questionEvaluations?.["0"]?.source).toBe("evaluation-unavailable");
      expect(result.decision.utterance).toContain("React was the entry point");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens as a calm, named interviewer", async () => {
    const { service } = harness();
    const result = await service.start(setup, "user-1", 1_000);

    expect(result.utterance).toContain("I'm James, your Trailgrad interviewer");
    expect(result.utterance).toContain(questions[0]?.text);
    expect(result.utterance).toContain("pause to think");
  });

  it("opens resume rounds as a conversation rather than a scripted interview", async () => {
    const { service } = harness();
    const result = await service.start(
      {
        ...setup,
        roundType: "behavioral",
        templateId: "resume-behavioral-defense",
        templateTitle: "Resume and Behavioral Defense"
      },
      "user-1",
      1_000
    );

    expect(result.utterance).toContain("relaxed conversation about the work on your resume");
    expect(result.utterance).not.toContain("Ready? Let's begin.");
  });

  it("opens DSA rounds with a dedicated James introduction", async () => {
    const { service } = harness([questions[0]!, questions[1]!, questions[0]!]);
    const result = await service.start(
      {
        ...setup,
        templateTitle: "DSA practice interview",
        questionCount: 3,
        agenda: ["Explain the approach", "Discuss complexity"]
      },
      "user-1",
      1_000
    );

    expect(result.state.plan).toHaveLength(3);
    expect(result.utterance).toContain("Welcome to your DSA interview");
    expect(result.utterance).toContain(questions[0]?.text);
  });

  it("passes prior conversation and question intent into follow-up decisions", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "enough ownership evidence",
      acknowledgement: "That gives me the context",
      line: ""
    });

    const result = await service.answer(
      started.state.id,
      {
        text: "I owned the conflict resolver and shipped the retry queue.",
        startMs: 500,
        endMs: 4_000
      },
      6_000
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        competency: "Ownership",
        intent: questions[0]?.intent,
        conversationHistory: expect.arrayContaining([expect.objectContaining({ speaker: "agent" })])
      })
    );
    expect(result.decision.utterance).toContain("That gives me the context");
    expect(result.decision.utterance).toContain(questions[1]?.text);
  });

  it("closes immediately and naturally after the final answer", async () => {
    const { service, decide } = harness([questions[0]!]);
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "question answered",
      acknowledgement: "Understood",
      line: ""
    });

    const result = await service.answer(
      started.state.id,
      {
        text: "I owned the resolver and measured a 30 percent drop in conflicts.",
        startMs: 500,
        endMs: 4_000
      },
      6_000
    );

    expect(result.state.phase).toBe("done");
    expect(result.decision.utterance).toContain("Thanks for the conversation");
    expect(result.decision.utterance).not.toContain("What would you like to ask me");
  });

  it("replaces repetitive acknowledgements with varied human bridges", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answer is complete",
      acknowledgement: "Got it, that makes sense",
      line: ""
    });

    const first = await service.answer(
      started.state.id,
      { text: "I owned the editor sync layer.", startMs: 500, endMs: 2_000 },
      3_000
    );
    const second = await service.answer(
      first.state.id,
      {
        text: "I chose the conflict strategy and measured fewer merge errors.",
        startMs: 3_500,
        endMs: 5_000
      },
      6_000
    );

    expect(first.decision.utterance.toLowerCase()).not.toContain("got it");
    expect(second.decision.utterance.toLowerCase()).not.toContain("got it");
    expect(first.decision.utterance).not.toBe(second.decision.utterance);
  });

  it("removes generic filler embedded in the follow-up line", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "probe",
      missing: "specificity",
      reason: "the answer needs one concrete detail",
      acknowledgement: "",
      line: "Got it. Can you walk me through the specific decision you made?"
    });

    const result = await service.answer(
      started.state.id,
      { text: "I worked on the sync layer.", startMs: 500, endMs: 2_000 },
      3_000
    );

    expect(result.decision.utterance).toContain(
      "Can you walk me through the specific decision you made?"
    );
    expect(result.decision.utterance.toLowerCase()).not.toContain("you worked on the sync layer");
    expect(result.decision.utterance.split("?")[0]).not.toBe(
      "Can you walk me through the specific decision you made"
    );
    expect(result.decision.utterance.toLowerCase()).not.toContain("got it");
  });

  it("acknowledges the candidate's detail before a connected follow-up", async () => {
    const careerQuestion = {
      ...questions[0]!,
      text: "Why did you choose this career?",
      stage: "career" as const,
      probeIfMissing: "What made React the right place for you to begin?"
    };
    const { service, decide } = harness([careerQuestion]);
    decide.mockResolvedValue({
      action: "probe",
      missing: "specificity",
      reason: "the motivation needs one more layer",
      acknowledgement: "React was the entry point for you",
      line: "What about React made programming feel worth pursuing?"
    });
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [careerQuestion]
    );

    const result = await service.answer(
      started.state.id,
      {
        text: "I wanted to learn React and other programming languages.",
        startMs: 500,
        endMs: 2_000
      },
      3_000
    );

    expect(result.decision.utterance).toBe(
      "React was the entry point for you. What about React made programming feel worth pursuing?"
    );
    expect(result.decision.utterance).not.toContain("Why did you choose this career?");
  });

  it("uses Gemini Live's hiring-manager decision without a second decider model call", async () => {
    const careerQuestion = {
      ...questions[0]!,
      text: "Why did you choose this career?",
      stage: "career" as const,
      maxFollowUps: 2,
      probeIfMissing: "What was the turning point?"
    };
    const completedEvaluation: QuestionEvaluation = {
      source: "semantic-evaluator",
      score: 74,
      verdict: "mostly-correct",
      confidence: 0.8,
      summary: "Grounded motivation.",
      strengths: [],
      gaps: [],
      rubricScores: [],
      answerExcerpts: [],
      execution: null,
      evaluatedAt: 3_000
    };
    const { service, store, decide, evaluate } = harness([careerQuestion], completedEvaluation);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [careerQuestion]
    );

    const result = await service.answer(
      started.state.id,
      { text: "React made software feel tangible to me.", startMs: 500, endMs: 2_000 },
      3_000,
      undefined,
      {
        action: "probe",
        missing: "specificity",
        reason: "the turning point is still unclear",
        acknowledgement: "React made the work feel tangible",
        line: "What was the moment that turned that interest into a career choice?"
      }
    );

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(store.evaluationRecoveryCount()).toBe(1);
    expect(result.state.questionEvaluations?.["0"]?.source).toBe("evaluation-unavailable");
    expect(result.decision.action).toBe("probe");
    expect(result.state.followUpCount).toBe(1);
    expect(result.decision.utterance).toBe(
      "React made the work feel tangible. What was the moment that turned that interest into a career choice?"
    );
    expect(result.state.turns.at(-1)?.runtime?.promptVersion).toBe("gemini-live-conversation-v2");
  });

  it("lets Gemini challenge concerning conduct without adding validating filler", async () => {
    const conflictQuestion = {
      ...questions[0]!,
      text: "Tell me about a disagreement with a teammate or manager.",
      stage: "project" as const,
      maxFollowUps: 2,
      probeIfMissing: "What responsibility did you take for how the situation escalated?"
    };
    const { service, decide } = harness([conflictQuestion, questions[1]!]);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [conflictQuestion, questions[1]!]
    );

    const result = await service.answer(
      started.state.id,
      {
        text: "The disagreement escalated and I punched him.",
        startMs: 500,
        endMs: 2_000
      },
      3_000,
      undefined,
      {
        action: "challenge",
        missing: "outcome",
        candidateIntent: "answer",
        reason: "the answer describes violence without accountability or repair",
        acknowledgement: "Thank you for sharing that specific example.",
        line: "What responsibility did you take, and what would you do differently now?"
      }
    );

    expect(decide).not.toHaveBeenCalled();
    expect(result.decision.action).toBe("challenge");
    expect(result.state.questionIndex).toBe(0);
    expect(result.state.followUpCount).toBe(1);
    expect(result.decision.utterance).toBe(
      "What responsibility did you take, and what would you do differently now?"
    );
    expect(result.decision.utterance).not.toContain("Thank you");
  });

  it("uses Gemini Live's resume decision without a second decider model call", async () => {
    const resumeQuestion = {
      ...questions[0]!,
      text: "What outcome did you personally own at NovaCart?",
      stage: "current-role" as const,
      maxFollowUps: 1,
      evaluationParameterKeys: ["personal-ownership", "impact-learning"]
    };
    const { service, decide, evaluate } = harness([resumeQuestion]);
    const started = await service.start(
      {
        ...setup,
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      },
      "user-1",
      1_000,
      [resumeQuestion]
    );

    const result = await service.answer(
      started.state.id,
      {
        text: "I owned checkout reliability and reduced failed payments by 20 percent.",
        startMs: 500,
        endMs: 2_000
      },
      3_000,
      undefined,
      {
        action: "move_on",
        missing: "none",
        reason: "the answer contains ownership and impact",
        acknowledgement: "You owned checkout reliability and tied it to failed payments",
        line: ""
      }
    );

    expect(decide).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.state.phase).toBe("done");
    expect(result.state.turns.at(-1)?.runtime?.promptVersion).toBe("gemini-live-conversation-v2");
  });

  it("replaces Gemini provider disclosure with James's recruiting identity", async () => {
    const careerQuestion = {
      ...questions[0]!,
      text: "Why did you choose this career?",
      stage: "career" as const,
      maxFollowUps: 2
    };
    const { service, decide } = harness([careerQuestion]);
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [careerQuestion]
    );

    const result = await service.answer(
      started.state.id,
      { text: "What's your name?", startMs: 500, endMs: 2_000 },
      3_000,
      undefined,
      {
        action: "respond",
        missing: "none",
        reason: "candidate asked for interviewer identity",
        acknowledgement: "",
        candidateResponse: "I'm an AI assistant created by Google.",
        line: "Could you walk me through the career choices that brought you here?"
      }
    );

    expect(decide).not.toHaveBeenCalled();
    expect(result.decision.utterance).toContain("I'm James from the recruiting team.");
    expect(result.decision.utterance).not.toMatch(/Google|AI assistant/i);
    expect(result.decision.utterance).toContain("career choices");
  });

  it("rejects Gemini-led decisions outside the hiring-manager round", async () => {
    const { service } = harness();
    const started = await service.start(setup, "user-1", 1_000);

    await expect(
      service.answer(
        started.state.id,
        { text: "My answer.", startMs: 500, endMs: 2_000 },
        3_000,
        undefined,
        {
          action: "move_on",
          missing: "none",
          reason: "complete",
          acknowledgement: "",
          line: ""
        }
      )
    ).rejects.toMatchObject({ code: "LIVE_PROPOSAL_NOT_ALLOWED" });
  });

  it("discards a stale model follow-up when the state machine forces move on", async () => {
    const followUpQuestion = { ...questions[0]!, maxFollowUps: 1 };
    const { service, decide } = harness([followUpQuestion, questions[1]!]);
    decide
      .mockResolvedValueOnce({
        action: "probe",
        missing: "outcome",
        reason: "the outcome is missing",
        acknowledgement: "",
        line: "What measurable impact did it have?"
      })
      .mockResolvedValueOnce({
        action: "probe",
        missing: "specificity",
        reason: "the follow-up is still vague",
        acknowledgement: "I see",
        line: "Which exact metric changed after that?"
      });
    const started = await service.start(setup, "user-1", 1_000);

    const first = await service.answer(
      started.state.id,
      { text: "I owned the synchronization work.", startMs: 500, endMs: 2_000 },
      3_000
    );
    const second = await service.answer(
      first.state.id,
      { text: "It made the experience faster.", startMs: 3_500, endMs: 5_000 },
      6_000
    );

    expect(second.decision.action).toBe("move_on");
    expect(second.decision.forcedBy).toBe("follow-up-budget");
    expect(second.decision.utterance).toContain(questions[1]!.text);
    expect(second.decision.utterance).not.toContain("Which exact metric changed");
  });

  it("preserves a multi-turn HR follow-up budget when the decider is unavailable", async () => {
    const deepQuestion = {
      ...questions[0]!,
      stage: "career" as const,
      maxFollowUps: 3,
      probeIfMissing: "What was the most important turning point?"
    };
    const { service, decide } = harness([deepQuestion, questions[1]!]);
    decide.mockRejectedValue(new Error("provider unavailable"));
    const started = await service.start(
      { ...setup, roundType: "hiring-manager", resumeRound: true },
      "user-1",
      1_000,
      [deepQuestion, questions[1]!]
    );

    const first = await service.answer(
      started.state.id,
      { text: "I moved from frontend into backend.", startMs: 500, endMs: 2_000 },
      3_000
    );
    const second = await service.answer(
      first.state.id,
      { text: "The payment work was the turning point.", startMs: 2_500, endMs: 4_000 },
      5_000
    );

    expect(first.decision.action).toBe("probe");
    expect(first.decision.utterance).toContain("What was the most important turning point?");
    expect(second.decision.action).toBe("probe");
    expect(second.state.followUpCount).toBe(2);
    expect(second.decision.utterance).toContain("change what you wanted from your next role");
  });

  it("records answer evidence and carries it into the next decision", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide
      .mockResolvedValueOnce({
        action: "probe",
        missing: "outcome",
        reason: "impact is missing",
        acknowledgement: "",
        line: "What changed for users?"
      })
      .mockResolvedValue({
        action: "move_on",
        missing: "outcome",
        reason: "ownership and implementation are clear but impact is missing",
        acknowledgement: "",
        line: ""
      });

    const first = await service.answer(
      started.state.id,
      {
        text: "I personally owned the React editor sync and chose Redis because it reduced duplicate updates.",
        startMs: 500,
        endMs: 2_000
      },
      3_000
    );

    const result = await service.answer(
      first.state.id,
      {
        text: "The outcome was a 30 percent reduction in duplicate updates.",
        startMs: 3_500,
        endMs: 5_000
      },
      6_000
    );

    expect(result.state.evidence?.["0"]).toEqual(
      expect.objectContaining({
        ownership: expect.arrayContaining([expect.stringContaining("personally owned")]),
        decision: expect.arrayContaining([expect.stringContaining("chose Redis")]),
        specificity: expect.arrayContaining([expect.stringContaining("React")]),
        gaps: expect.arrayContaining(["outcome"])
      })
    );
    expect(decide).toHaveBeenLastCalledWith(
      expect.objectContaining({
        evidenceLedger: expect.objectContaining({
          ownership: expect.arrayContaining([expect.stringContaining("personally owned")]),
          decision: expect.arrayContaining([expect.stringContaining("chose Redis")]),
          specificity: expect.arrayContaining([expect.stringContaining("React")]),
          gaps: expect.arrayContaining(["outcome"])
        })
      })
    );
  });

  it("speaks only one focused follow-up when the model combines questions", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "probe",
      missing: "outcome",
      reason: "impact is missing",
      acknowledgement: "",
      line: "What changed for users? How did you measure it?"
    });

    const result = await service.answer(
      started.state.id,
      { text: "I shipped the payment flow.", startMs: 500, endMs: 2_000 },
      3_000
    );

    expect(result.decision.utterance).toContain("What changed for users?");
  });

  it("only exposes durable reports to the session owner", async () => {
    const { service } = harness();
    const started = await service.start(setup, "user-1", 1_000);

    await expect(service.history("user-1", 10, 2_000)).resolves.toHaveLength(1);
    await expect(service.history("user-2", 10, 2_000)).resolves.toHaveLength(0);
    await expect(service.report("user-1", started.state.id, 2_000)).resolves.toMatchObject({
      sessionId: started.state.id
    });
    await expect(service.report("user-2", started.state.id, 2_000)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    });
  });
});
