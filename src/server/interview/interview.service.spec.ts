import { InterviewDecider } from "./decider";
import { buildFundamentalsPlan } from "./fundamentals-round";
import { InterviewPlanner } from "./planner";
import { InterviewService } from "./interview.service";
import { MemorySessionStore } from "./session-store";
import type { TechnicalAnswerEvaluator } from "./technical-answer-evaluator";
import type { InterviewSetup, PlannedQuestion, QuestionEvaluation } from "./types";

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
  const planQuestions = jest.fn().mockResolvedValue(plan);
  const planner = { plan: planQuestions } as unknown as InterviewPlanner;
  const decide = jest.fn();
  const decider = { decide } as unknown as InterviewDecider;
  const evaluate = jest.fn().mockResolvedValue(evaluation);
  const evaluator = evaluation
    ? ({ evaluate } as unknown as TechnicalAnswerEvaluator)
    : undefined;
  const service = new InterviewService(
    planner,
    decider,
    new MemorySessionStore(),
    10,
    evaluator
  );

  return { service, decide, evaluate, planQuestions };
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
    // Maya moves straight into the next question, as she does after any move_on.
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
  it("opens as a calm, named interviewer", async () => {
    const { service } = harness();
    const result = await service.start(setup, "user-1", 1_000);

    expect(result.utterance).toContain("I'm Maya, your Trailgrad interviewer");
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

  it("opens DSA rounds with a dedicated Maya introduction", async () => {
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

    expect(result.decision.utterance).toBe(
      "Can you walk me through the specific decision you made?"
    );
    expect(result.decision.utterance.toLowerCase()).not.toContain("got it");
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

    expect(result.decision.utterance).toBe("What changed for users?");
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
