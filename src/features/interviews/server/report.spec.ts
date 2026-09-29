import {
  createHistoryItem,
  createInterviewReport,
  createInterviewReportSnapshot,
  createWorkspaceInsights,
  createWorkspaceInsightsFromReports,
  readInterviewReportSnapshot
} from "./report";
import type { InterviewState } from "./types";
import { roundParameterScore } from "@/features/reports/application/reports-overview";

const state: InterviewState = {
  id: "44444444-4444-4444-8444-444444444444",
  setup: {
    role: "frontend",
    level: "3-5",
    roundType: "technical",
    intensity: "realistic",
    context: "Built a collaborative editor and its offline synchronization."
  },
  plan: [
    {
      text: "What did you personally own?",
      evidenceAnchor: "Collaborative editor conflict resolver",
      competency: "Ownership",
      intent: "Find personal scope.",
      mustHit: ["scope"],
      probeIfMissing: "Which decision was yours?"
    },
    {
      text: "Implement a bounded retry queue.",
      kind: "code",
      language: "TypeScript",
      codeTask: "Implement a bounded retry queue.",
      competency: "Implementation",
      mustHit: ["backoff"],
      probeIfMissing: "How do retries stop?"
    }
  ],
  phase: "done",
  questionIndex: 1,
  followUpCount: 0,
  startedAt: 1_000,
  turns: [
    {
      speaker: "agent",
      text: "What did you personally own?",
      startMs: 0,
      endMs: 0,
      action: "intro",
      questionIndex: 0
    },
    {
      speaker: "user",
      text: "I owned the conflict resolver.",
      startMs: 1_000,
      endMs: 4_000,
      questionIndex: 0
    },
    {
      speaker: "agent",
      text: "Which decision was yours?",
      startMs: 4_100,
      endMs: 4_100,
      action: "probe",
      questionIndex: 0
    },
    {
      speaker: "user",
      text: "I selected the CRDT strategy.",
      startMs: 4_200,
      endMs: 7_000,
      questionIndex: 0
    },
    {
      speaker: "agent",
      text: "Implement a bounded retry queue.",
      startMs: 7_100,
      endMs: 7_100,
      action: "move_on",
      questionIndex: 1
    },
    {
      speaker: "user",
      text: "```ts\nfunction retry() {}\n```",
      startMs: 8_000,
      endMs: 12_000,
      questionIndex: 1
    }
  ]
};

describe("interview report", () => {
  it("derives grounded coverage and interaction metrics from persisted turns", () => {
    const report = createInterviewReport({ state, touchedAt: 14_000 }, 20_000);

    expect(report.status).toBe("completed");
    expect(report.questionsCovered).toBe(2);
    expect(report.answerCount).toBe(3);
    expect(report.interaction.probes).toBe(1);
    expect(report.codeExercise).toMatchObject({ language: "TypeScript", submitted: true });
    expect(report.competencies).toEqual([
      expect.objectContaining({ label: "Ownership", answered: true }),
      expect.objectContaining({ label: "Implementation", answered: true })
    ]);
    expect(report.competencies[0]).toMatchObject({
      evidenceAnchor: "Collaborative editor conflict resolver",
      evidenceLevel: "developing",
      evidenceBreakdown: expect.objectContaining({ ownership: 88 }),
      signals: expect.arrayContaining(["Personal ownership"])
    });
    expect(report.summary.evidenceScore).toBeGreaterThan(0);
  });

  describe("coverage", () => {
    const extra = [
      {
        text: "How did you test it?",
        competency: "Testing",
        mustHit: ["tests"],
        probeIfMissing: "What would fail first?"
      },
      {
        text: "What would you change?",
        competency: "Reflection",
        mustHit: ["change"],
        probeIfMissing: "Why that?"
      }
    ];
    const firstAnswerOnly = state.turns.slice(0, 4);

    it("counts questions the candidate never reached after ending early", () => {
      const ended: InterviewState = {
        ...state,
        plan: [state.plan[0]!, state.plan[1]!, ...extra],
        questionIndex: 0,
        turns: [
          ...firstAnswerOnly,
          {
            speaker: "user",
            text: "Let's stop here.",
            startMs: 7_100,
            endMs: 8_000,
            endedInterview: true
          }
        ]
      };
      const oneQuestion: InterviewState = { ...ended, plan: [state.plan[0]!] };

      const report = createInterviewReport({ state: ended, touchedAt: 9_000 }, 20_000);
      const full = createInterviewReport({ state: oneQuestion, touchedAt: 9_000 }, 20_000);

      expect(full.summary.evidenceScore).toBeGreaterThan(20);
      expect(report.coverage).toEqual({ answered: 1, counted: 4 });
      expect(full.coverage).toEqual({ answered: 1, counted: 1 });
      expect(report.summary.evidenceScore).toBe(Math.round(full.summary.evidenceScore / 4));
      expect(roundParameterScore(report)).toBe(Math.round(roundParameterScore(full) / 4));
    });

    it("counts a declined question but not pacing skips or questions cut off by time", () => {
      const timed: InterviewState = {
        ...state,
        setup: { ...state.setup, durationMinutes: 5 },
        plan: [state.plan[0]!, state.plan[1]!, ...extra],
        questionIndex: 2,
        skippedQuestionIndexes: [3],
        turns: [
          ...firstAnswerOnly,
          {
            speaker: "user",
            text: "I don't know this one.",
            startMs: 7_100,
            endMs: 600_000,
            questionIndex: 1,
            skipped: true,
            assessmentExcluded: true
          }
        ]
      };

      const report = createInterviewReport({ state: timed, touchedAt: 601_000 }, 700_000);

      // Q0 answered, Q1 declined; Q2 was cut off by the clock and Q3 skipped for pacing.
      expect(report.coverage).toEqual({ answered: 1, counted: 2 });
    });
  });

  it("does not expose internal decision telemetry in report transcripts", () => {
    const traced: InterviewState = {
      ...state,
      turns: state.turns.map((turn, index) =>
        index === 0
          ? {
              ...turn,
              runtime: {
                engineVersion: "engine-test",
                promptVersion: "prompt-test",
                durationMs: 25,
                usedFallback: false,
                calls: [
                  {
                    provider: "groq",
                    operation: "interview.decide",
                    model: "internal-model",
                    modelClass: "fast",
                    attempt: 1,
                    maxAttempts: 1,
                    durationMs: 20,
                    outcome: "success"
                  }
                ]
              }
            }
          : turn
      )
    };

    const report = createInterviewReport({ state: traced, touchedAt: 14_000 }, 20_000);

    expect(report.transcript[0]).not.toHaveProperty("runtime");
    expect(JSON.stringify(report)).not.toContain("internal-model");
  });

  it("marks an unfinished room expired without discarding its history", () => {
    const history = createHistoryItem(
      { state: { ...state, phase: "questioning" }, touchedAt: 1_000 },
      60 * 60 * 1000 + 1_001
    );

    expect(history.status).toBe("expired");
    expect(history.durationMs).toBe(12_000);
  });

  it("rehydrates a compact report snapshot without exposing its transcript", () => {
    const active = { ...state, phase: "questioning" as const };
    const snapshot = createInterviewReportSnapshot({ state: active, touchedAt: 14_000 }, 14_000);
    const report = readInterviewReportSnapshot(snapshot, 14_000, 20_000);

    expect(snapshot.report).not.toHaveProperty("transcript");
    expect(report.transcript).toEqual([]);
    expect(report.status).toBe("in_progress");
    expect(report.durationMs).toBe(19_000);
  });

  it("expires a compact report using the last turn rather than idle wall time", () => {
    const active = { ...state, phase: "questioning" as const };
    const snapshot = createInterviewReportSnapshot({ state: active, touchedAt: 14_000 }, 14_000);
    const report = readInterviewReportSnapshot(snapshot, 14_000, 14_000 + 60 * 60 * 1000 + 1);

    expect(report.status).toBe("expired");
    expect(report.durationMs).toBe(12_000);
  });

  it("uses persisted technical correctness instead of fluent-answer heuristics", () => {
    const evaluated: InterviewState = {
      ...state,
      questionEvaluations: {
        "1": {
          source: "semantic-evaluator",
          score: 18,
          verdict: "incorrect",
          confidence: 0.96,
          summary: "The retry implementation has no retry bound or backoff.",
          strengths: ["Submitted syntactically recognizable code."],
          gaps: ["The implementation does not meet the bounded retry requirement."],
          rubricScores: [
            {
              rubricKey: "technical-correctness",
              score: 18,
              rationale: "Required behavior is absent."
            }
          ],
          answerExcerpts: ["function retry() {}"],
          execution: null,
          evaluatedAt: 13_000
        }
      }
    };

    const report = createInterviewReport({ state: evaluated, touchedAt: 14_000 }, 20_000);

    expect(report.competencies[1]).toMatchObject({
      evidenceScore: 18,
      evidenceLevel: "developing",
      gap: "The implementation does not meet the bounded retry requirement.",
      technicalEvaluation: {
        score: 18,
        verdict: "incorrect"
      }
    });
    expect(report.codeExercise?.correctnessScore).toBe(18);
  });

  it("does not let keyword hits outscore the evaluator on a graded answer", () => {
    // Question 0's answer says "I owned…", which the keyword pass alone reads as
    // ownership 88. The evaluator graded the answer as vague.
    const graded: InterviewState = {
      ...state,
      questionEvaluations: {
        "0": {
          source: "semantic-evaluator",
          score: 0,
          verdict: "insufficient-evidence",
          confidence: 1,
          summary: "No career story or concrete detail.",
          strengths: [],
          gaps: ["No career story or employment history."],
          rubricScores: [
            { rubricKey: "claim-credibility", score: 0, rationale: "No verifiable claims." },
            { rubricKey: "personal-ownership", score: 12, rationale: "Ownership is implied only." }
          ],
          answerExcerpts: [],
          execution: null,
          evaluatedAt: 13_000
        }
      }
    };

    const report = createInterviewReport({ state: graded, touchedAt: 14_000 }, 20_000);

    expect(report.competencies[0]?.evidenceBreakdown).toEqual({
      ownership: 12,
      decision: 0,
      specificity: 0,
      outcome: 0
    });

    // Snapshots saved before this fix held the keyword numbers; reading one
    // rebuilds the breakdown from the stored rubric scores.
    const snapshot = createInterviewReportSnapshot({ state: graded, touchedAt: 14_000 }, 14_000);
    const legacy = {
      ...snapshot,
      report: {
        ...snapshot.report,
        competencies: snapshot.report.competencies.map((item, index) =>
          index === 0
            ? {
                ...item,
                evidenceBreakdown: { ownership: 88, decision: 86, specificity: 0, outcome: 26 }
              }
            : item
        )
      }
    };
    expect(
      readInterviewReportSnapshot(legacy, 14_000, 20_000).competencies[0]?.evidenceBreakdown
    ).toEqual({ ownership: 12, decision: 0, specificity: 0, outcome: 0 });
  });

  it("calculates the headline from the six visible round parameters", () => {
    const rubricScores = [10, 20, 30, 40, 50, 60].map((score, index) => ({
      rubricKey: [
        "motivation-fit",
        "judgement",
        "collaboration",
        "accountability",
        "self-awareness",
        "communication"
      ][index]!,
      score,
      rationale: "Grounded parameter evidence."
    }));
    const hiringManagerState: InterviewState = {
      ...state,
      setup: { ...state.setup, roundType: "hiring-manager", resumeRound: true },
      plan: [state.plan[0]!],
      questionIndex: 1,
      turns: state.turns.filter((turn) => turn.questionIndex === 0),
      questionEvaluations: {
        "0": {
          source: "semantic-evaluator",
          score: 92,
          verdict: "mostly-correct",
          confidence: 0.9,
          summary: "The hidden overall score must not become the headline.",
          strengths: [],
          gaps: [],
          rubricScores,
          answerExcerpts: ["I owned the conflict resolver."],
          execution: null,
          evaluatedAt: 13_000
        }
      }
    };

    const report = createInterviewReport({ state: hiringManagerState, touchedAt: 14_000 }, 20_000);

    expect(report.summary.evidenceScore).toBe(35);
  });

  it("aggregates answer evidence into a workspace competency map", () => {
    const insights = createWorkspaceInsights([{ state, touchedAt: 14_000 }], 20_000);

    expect(insights.completedSessions).toBe(1);
    expect(insights.answeredQuestions).toBe(2);
    expect(insights.readinessScore).toBeGreaterThan(0);
    expect(insights.competencyMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Ownership", attempts: 1 }),
        expect.objectContaining({ label: "Implementation", attempts: 1 })
      ])
    );
  });

  it("builds the same workspace insights from transcript-free snapshots", () => {
    const report = createInterviewReport({ state, touchedAt: 14_000 }, 20_000);
    const compactInsights = createWorkspaceInsightsFromReports(
      [{ ...report, transcript: [] }],
      20_000
    );

    expect(compactInsights).toEqual(
      createWorkspaceInsights([{ state, touchedAt: 14_000 }], 20_000)
    );
  });
});
