import {
  createReportsOverview,
  parameterScoresForReport,
  roundParameterScore
} from "./reports-overview";
import type { InterviewCompetencyReport, InterviewReport } from "@/lib/shared/types";

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
    expect(overview.families).toHaveLength(5);
    expect(overview.families.every((family) => family.averageScore === null)).toBe(true);
    expect(overview.latest).toBeNull();
    expect(overview.best).toBeNull();
    expect(overview.generatedAt).toBe(5_000);
  });

  it("keeps separate overall scores for the five permanent interview families", () => {
    const overview = createReportsOverview([
      report({
        sessionId: "hr",
        setup: { roundType: "hiring-manager", resumeRound: true } as InterviewReport["setup"],
        competencies: [competency("Accountability", 81)]
      }),
      report({
        sessionId: "resume",
        setup: {
          roundType: "behavioral",
          resumeRound: true,
          templateId: "resume-behavioral-defense"
        } as InterviewReport["setup"],
        competencies: [competency("Resume claim", 67)]
      }),
      report({
        sessionId: "dsa",
        setup: { roundType: "technical", templateId: "dsa" } as InterviewReport["setup"],
        competencies: [competency("Correctness", 74)]
      }),
      report({
        sessionId: "design",
        setup: {
          roundType: "technical",
          templateId: "system-design"
        } as InterviewReport["setup"],
        competencies: [competency("Architecture reasoning", 79)]
      }),
      report({
        sessionId: "core",
        setup: {
          roundType: "technical",
          templateId: "technical-deep-dive"
        } as InterviewReport["setup"],
        competencies: [competency("Concept depth", 88)]
      })
    ]);

    expect(
      Object.fromEntries(overview.families.map((family) => [family.family, family.averageScore]))
    ).toEqual({
      dsa: 74,
      "system-design": 79,
      "core-technical-projects": 88,
      "hr-behavioral": 81,
      "resume-behavioral": 67
    });
  });

  it("uses stored round-specific parameter scores and marks legacy fallbacks as derived", () => {
    const direct = competency("Accountability", 70);
    direct.technicalEvaluation = {
      source: "semantic-evaluator",
      score: 70,
      verdict: "mostly-correct",
      confidence: 0.9,
      summary: "Owned the mistake.",
      strengths: [],
      gaps: [],
      rubricScores: [
        { rubricKey: "accountability", score: 84, rationale: "Clear repair and change." }
      ],
      execution: null
    };
    const overview = createReportsOverview([
      report({
        sessionId: "legacy",
        startedAt: DAY,
        setup: { roundType: "hiring-manager", resumeRound: true } as InterviewReport["setup"],
        competencies: [competency("Accountability", 60)]
      }),
      report({
        sessionId: "direct",
        startedAt: 2 * DAY,
        setup: { roundType: "hiring-manager", resumeRound: true } as InterviewReport["setup"],
        competencies: [direct]
      })
    ]);
    const accountability = overview.families
      .find((family) => family.family === "hr-behavioral")
      ?.parameters.find((parameter) => parameter.key === "accountability");
    const hrFamily = overview.families.find((family) => family.family === "hr-behavioral");

    expect(accountability).toMatchObject({
      latestScore: 84,
      averageScore: 72,
      rounds: 2,
      evaluatedRounds: 1
    });
    expect(hrFamily?.latestScore).toBe(72);
  });

  it("normalizes a complete compact conversation rubric at report level", () => {
    const direct = competency("Career motivation", 3);
    direct.technicalEvaluation = {
      source: "semantic-evaluator",
      score: 3,
      verdict: "incorrect",
      confidence: 0.8,
      summary: "The answer had very limited evidence.",
      strengths: [],
      gaps: [],
      rubricScores: [
        "motivation-fit",
        "judgement",
        "collaboration",
        "accountability",
        "self-awareness",
        "communication"
      ].map((rubricKey, index) => ({
        rubricKey,
        score: index + 1,
        rationale: "Limited evidence on the hundred-point rubric."
      })),
      execution: null
    };
    const legacy = report({
      sessionId: "legacy-ten-point",
      setup: { roundType: "hiring-manager", resumeRound: true } as InterviewReport["setup"],
      competencies: [direct]
    });

    expect(roundParameterScore(legacy)).toBe(35);
  });

  it("weights targeted Resume parameters on one explicit 0-100 scale", () => {
    const direct = competency("Project deep-dive", 68);
    direct.technicalEvaluation = {
      source: "semantic-evaluator",
      score: 68,
      verdict: "partially-correct",
      confidence: 0.9,
      summary: "Concrete evidence with a weak outcome.",
      strengths: [],
      gaps: [],
      rubricScores: [
        ["claim-credibility", 80],
        ["personal-ownership", 80],
        ["decision-making", 60],
        ["specificity", 60],
        ["impact-learning", 40],
        ["communication", 100]
      ].map(([rubricKey, score]) => ({
        rubricKey: String(rubricKey),
        score: Number(score),
        rationale: "Transcript-grounded evidence."
      })),
      execution: null
    };
    const resume = report({
      sessionId: "weighted-resume",
      setup: {
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      } as InterviewReport["setup"],
      competencies: [direct]
    });

    expect(roundParameterScore(resume)).toBe(68);
    expect(
      createReportsOverview([resume]).families.find(
        (family) => family.family === "resume-behavioral"
      )?.averageScore
    ).toBe(68);
  });

  it("never treats a new Resume score as an implicit ten-point score", () => {
    const direct = competency("Resume evidence", 5);
    direct.technicalEvaluation = {
      source: "semantic-evaluator",
      score: 5,
      verdict: "insufficient-evidence",
      confidence: 0.9,
      summary: "Almost no assessable evidence.",
      strengths: [],
      gaps: ["The claim was unsupported."],
      rubricScores: [{ rubricKey: "claim-credibility", score: 5, rationale: "Unsupported claim." }],
      execution: null
    };
    const resume = report({
      sessionId: "low-resume",
      setup: {
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      } as InterviewReport["setup"],
      competencies: [direct]
    });

    expect(parameterScoresForReport(resume)[0]?.score).toBe(5);
    expect(roundParameterScore(resume)).toBe(5);
  });

  it("does not average unavailable-evaluation placeholder zeros into a round score", () => {
    const resume = report({
      sessionId: "unavailable-resume-evaluation",
      setup: {
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      } as InterviewReport["setup"],
      competencies: [
        {
          ...competency("Career story", 70),
          technicalEvaluation: {
            source: "semantic-evaluator",
            score: 70,
            verdict: "mostly-correct",
            confidence: 0.9,
            summary: "Credible evidence.",
            strengths: [],
            gaps: [],
            rubricScores: [
              { rubricKey: "claim-credibility", score: 70, rationale: "Credible evidence." }
            ],
            execution: null
          }
        },
        {
          ...competency("Technical skill", 0),
          technicalEvaluation: {
            source: "evaluation-unavailable",
            score: 0,
            verdict: "insufficient-evidence",
            confidence: 0,
            summary: "Evaluation unavailable.",
            strengths: [],
            gaps: ["Retry evaluation."],
            rubricScores: [
              {
                rubricKey: "claim-credibility",
                score: 0,
                rationale: "Not scored because evaluation was unavailable."
              }
            ],
            execution: null
          }
        }
      ]
    });

    expect(
      parameterScoresForReport(resume).find((item) => item.key === "claim-credibility")
    ).toMatchObject({
      score: 70,
      evaluated: true
    });
  });

  it("does not score an end-interview utterance that answered no planned question", () => {
    const endedOnly = report({
      sessionId: "ended-only",
      answerCount: 1,
      questionsCovered: 0,
      competencies: [competency("Career story", 0, false)]
    });

    const overview = createReportsOverview([endedOnly]);

    expect(overview.scoredRounds).toBe(0);
    expect(overview.latestCompletedReport).toBeNull();
    expect(overview.families.every((family) => family.latestScore === null)).toBe(true);
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

  it("routes every completed-round drill-down to the canonical reports page", () => {
    const overview = createReportsOverview([
      report({ sessionId: "complete", startedAt: DAY, status: "completed" })
    ]);

    expect(overview.rounds[0]?.href).toBe("/reports");
    expect(overview.trend[0]?.href).toBe("/reports");
    expect(overview.matrix.rounds[0]?.href).toBe("/reports");
  });

  it("uses the latest answered round for the report, even during wrap-up", () => {
    const overview = createReportsOverview([
      report({ sessionId: "finished", startedAt: DAY, status: "completed" }),
      report({ sessionId: "just-answered", startedAt: 2 * DAY, status: "in_progress" })
    ]);

    expect(overview.latestCompletedReport?.sessionId).toBe("just-answered");
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
