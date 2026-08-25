import { createHistoryItem, createInterviewReport, createWorkspaceInsights } from "./report";
import type { InterviewState } from "./types";

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

  it("marks an unfinished room expired without discarding its history", () => {
    const history = createHistoryItem(
      { state: { ...state, phase: "questioning" }, touchedAt: 1_000 },
      60 * 60 * 1000 + 1_001
    );

    expect(history.status).toBe("expired");
    expect(history.durationMs).toBe(12_000);
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
});
