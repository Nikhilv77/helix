import { createReportsOverview } from "./reports-overview";
import type { InterviewCompetencyReport, InterviewReport } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

function competency(
  label: string,
  evidenceScore: number,
  answered = true
): InterviewCompetencyReport {
  return {
    label,
    question: `Tell me about ${label}.`,
    answered,
    answerPreview: answered ? "We shipped it." : null,
    evidenceScore: answered ? evidenceScore : 0,
    evidenceLevel: answered ? (evidenceScore >= 75 ? "strong" : "developing") : "missing",
    signals: answered ? ["Personal ownership"] : [],
    gap: `Say more about ${label}.`,
    nextStep: `Practice ${label} with one number in it.`
  };
}

function report(overrides: Partial<InterviewReport> & { sessionId: string }): InterviewReport {
  const competencies = overrides.competencies ?? [competency("Ownership", 60)];
  const answered = competencies.filter((item) => item.answered);

  return {
    sessionId: overrides.sessionId,
    status: overrides.status ?? "completed",
    setup: {
      role: "frontend",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "A collaborative editor.",
      ...overrides.setup
    },
    startedAt: overrides.startedAt ?? 0,
    updatedAt: overrides.updatedAt ?? overrides.startedAt ?? 0,
    durationMs: overrides.durationMs ?? 10 * 60_000,
    questionCount: overrides.questionCount ?? competencies.length,
    questionsCovered: overrides.questionsCovered ?? answered.length,
    answerCount: overrides.answerCount ?? answered.length,
    competencies,
    interaction: {
      probes: 2,
      challenges: 1,
      clarifications: 1,
      interruptions: 0,
      ...overrides.interaction
    },
    codeExercise: overrides.codeExercise ?? null,
    summary: {
      evidenceScore: answered.length
        ? Math.round(
            answered.reduce((total, item) => total + item.evidenceScore, 0) / answered.length
          )
        : 0,
      strongest: answered[0]?.label ?? null,
      recommendedFocus: answered.at(-1)?.label ?? null,
      nextStep: "Add a measurable result.",
      ...overrides.summary
    },
    transcript: overrides.transcript ?? []
  };
}

describe("createReportsOverview", () => {
  it("returns an empty overview when there are no rounds", () => {
    const overview = createReportsOverview([], 5_000);

    expect(overview.totalRounds).toBe(0);
    expect(overview.readinessScore).toBeNull();
    expect(overview.scoreDelta).toBeNull();
    expect(overview.trend).toEqual([]);
    expect(overview.competencies).toEqual([]);
    expect(overview.matrix.rounds).toEqual([]);
    expect(overview.latest).toBeNull();
    expect(overview.best).toBeNull();
    expect(overview.generatedAt).toBe(5_000);
  });

  it("orders the trend chronologically regardless of input order", () => {
    const overview = createReportsOverview([
      report({ sessionId: "c", startedAt: 3 * DAY, competencies: [competency("Ownership", 80)] }),
      report({ sessionId: "a", startedAt: 1 * DAY, competencies: [competency("Ownership", 40)] }),
      report({ sessionId: "b", startedAt: 2 * DAY, competencies: [competency("Ownership", 60)] })
    ]);

    expect(overview.trend.map((point) => point.sessionId)).toEqual(["a", "b", "c"]);
    expect(overview.trend.map((point) => point.index)).toEqual([1, 2, 3]);
    expect(overview.firstScore).toBe(40);
    expect(overview.latestScore).toBe(80);
    expect(overview.bestScore).toBe(80);
    expect(overview.scoreDelta).toBe(40);
  });

  it("lists rounds newest first", () => {
    const overview = createReportsOverview([
      report({ sessionId: "a", startedAt: 1 * DAY }),
      report({ sessionId: "c", startedAt: 3 * DAY }),
      report({ sessionId: "b", startedAt: 2 * DAY })
    ]);

    expect(overview.rounds.map((round) => round.sessionId)).toEqual(["c", "b", "a"]);
  });

  // An abandoned round scores zero. Averaging it in would read as a collapse in
  // performance rather than a session the candidate simply closed.
  it("excludes rounds with no answers from every score", () => {
    const overview = createReportsOverview([
      report({ sessionId: "scored", startedAt: DAY, competencies: [competency("Ownership", 80)] }),
      report({
        sessionId: "abandoned",
        startedAt: 2 * DAY,
        status: "expired",
        competencies: [competency("Ownership", 0, false)]
      })
    ]);

    expect(overview.totalRounds).toBe(2);
    expect(overview.scoredRounds).toBe(1);
    expect(overview.readinessScore).toBe(80);
    expect(overview.latestScore).toBe(80);
    expect(overview.trend).toHaveLength(1);
    // It still appears in the list, with no score of its own.
    const abandoned = overview.rounds.find((round) => round.sessionId === "abandoned");
    expect(abandoned?.evidenceScore).toBeNull();
  });

  it("averages readiness over the five most recent scored rounds only", () => {
    const overview = createReportsOverview(
      [0, 1, 2, 3, 4, 5].map((index) =>
        report({
          sessionId: `s${index}`,
          startedAt: index * DAY,
          // 0 then five 80s: the outlier must fall outside the window.
          competencies: [competency("Ownership", index === 0 ? 20 : 80)]
        })
      )
    );

    expect(overview.scoredRounds).toBe(6);
    expect(overview.readinessScore).toBe(80);
  });

  it("tracks a competency across rounds and reports its movement", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "a",
        startedAt: DAY,
        competencies: [competency("Ownership", 40), competency("System design", 70)]
      }),
      report({
        sessionId: "b",
        startedAt: 2 * DAY,
        competencies: [competency("ownership", 80)]
      })
    ]);

    const ownership = overview.competencies.find((row) => row.label.toLowerCase() === "ownership");
    expect(ownership).toBeDefined();
    // Case differences are the same competency.
    expect(ownership?.rounds).toBe(2);
    expect(ownership?.firstScore).toBe(40);
    expect(ownership?.latestScore).toBe(80);
    expect(ownership?.delta).toBe(40);
    expect(ownership?.averageScore).toBe(60);
  });

  it("averages a competency asked twice in one round instead of counting it twice", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "a",
        startedAt: DAY,
        competencies: [competency("Ownership", 40), competency("Ownership", 80)]
      })
    ]);

    const ownership = overview.competencies[0];
    expect(ownership?.rounds).toBe(1);
    expect(ownership?.averageScore).toBe(60);
    expect(ownership?.answered).toBe(2);
  });

  it("builds a matrix cell per competency and round, null where never asked", () => {
    const overview = createReportsOverview([
      report({ sessionId: "a", startedAt: DAY, competencies: [competency("Ownership", 40)] }),
      report({
        sessionId: "b",
        startedAt: 2 * DAY,
        competencies: [competency("Ownership", 80), competency("Communication", 50)]
      })
    ]);

    expect(overview.matrix.rounds.map((round) => round.sessionId)).toEqual(["a", "b"]);

    const communication = overview.matrix.rows.find((row) => row.label === "Communication");
    expect(communication?.cells).toEqual([
      { score: null, answered: false },
      { score: 50, answered: true }
    ]);
  });

  it("surfaces the weakest answered competencies as recurring gaps", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "a",
        startedAt: DAY,
        competencies: [
          competency("Ownership", 30),
          competency("System design", 55),
          competency("Impact", 90),
          competency("Never answered", 0, false)
        ]
      })
    ]);

    const labels = overview.recurringGaps.map((gap) => gap.label);
    expect(labels[0]).toBe("Ownership");
    expect(labels).toContain("System design");
    // Strong enough to not be a gap.
    expect(labels).not.toContain("Impact");
    // Unanswered is a coverage problem, not a recurring gap.
    expect(labels).not.toContain("Never answered");
    expect(overview.recurringGaps[0]?.practiceHref).toContain("focus=Ownership");
  });

  it("groups round types with their own averages", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "a",
        startedAt: DAY,
        setup: { roundType: "behavioral" } as InterviewReport["setup"],
        competencies: [competency("Ownership", 40)]
      }),
      report({
        sessionId: "b",
        startedAt: 2 * DAY,
        setup: { roundType: "behavioral" } as InterviewReport["setup"],
        competencies: [competency("Ownership", 60)]
      }),
      report({
        sessionId: "c",
        startedAt: 3 * DAY,
        setup: { roundType: "technical" } as InterviewReport["setup"],
        competencies: [competency("Ownership", 90)]
      })
    ]);

    expect(overview.roundTypes).toEqual([
      { roundType: "behavioral", label: "Behavioral", rounds: 2, averageScore: 50 },
      { roundType: "technical", label: "Technical", rounds: 1, averageScore: 90 }
    ]);
  });

  it("totals interviewer pressure per scored round", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "a",
        startedAt: DAY,
        interaction: { probes: 3, challenges: 2, clarifications: 1, interruptions: 1 }
      }),
      report({
        sessionId: "b",
        startedAt: 2 * DAY,
        interaction: { probes: 1, challenges: 1, clarifications: 0, interruptions: 0 }
      })
    ]);

    expect(overview.pressure.probes).toBe(4);
    expect(overview.pressure.challenges).toBe(3);
    expect(overview.pressure.interruptions).toBe(1);
    // (6 + 2) follow-ups over two rounds.
    expect(overview.pressure.perRound).toBe(4);
  });

  it("points an in-progress round back at the live room, not a report", () => {
    const overview = createReportsOverview([
      report({ sessionId: "live", startedAt: DAY, status: "in_progress" })
    ]);

    expect(overview.rounds[0]?.href).toBe("/interview/voice?session=live");
  });
});
