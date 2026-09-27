import type { ReportCompetencyRow, ReportsOverview } from "@/features/reports/contracts/reports";
import { buildBriefingCopy } from "./report-briefing-stage";

function competency(label: string, averageScore: number, rounds = 2): ReportCompetencyRow {
  return {
    label,
    averageScore,
    latestScore: averageScore,
    firstScore: averageScore,
    delta: 0,
    rounds,
    answered: rounds,
    unanswered: 0,
    level: averageScore >= 75 ? "strong" : "developing",
    gap: null,
    nextStep: `Fix ${label}.`
  } as ReportCompetencyRow;
}

function overview(overrides: Partial<ReportsOverview> = {}): ReportsOverview {
  return {
    readinessScore: 64,
    latestScore: 64,
    scoreDelta: 8,
    scoredRounds: 3,
    best: null,
    latest: null,
    rounds: [],
    families: [],
    // Most-asked and weakest first, the order reports-overview produces.
    competencies: [competency("Impact", 41, 3), competency("Ownership", 86, 2)],
    recurringGaps: [
      { label: "Impact", occurrences: 3, averageScore: 41, nextStep: "End with the result.", practiceHref: "/interviews" }
    ],
    pressure: { perRound: 1.4 },
    ...overrides
  } as unknown as ReportsOverview;
}

const candidate = { name: "Arjun Mehta", discipline: "Backend Engineering" };

describe("Reports briefing copy", () => {
  it("names the best-scoring area as the strength, never the weakest", () => {
    const copy = buildBriefingCopy(overview(), candidate, "Maya");
    expect(copy.strongestLabel).toBe("Ownership");
    expect(copy.strongestText).toBe("Your best area so far, averaging 86/100 across 2 rounds.");
    expect(copy.gapLabel).toBe("Impact");
    expect(copy.summaryText).toBe(
      "Maya's short version: You're improving: up 8 points since your first scored round. Your strongest area is Ownership. The thing that keeps coming up is Impact."
    );
  });

  it("does not invent a strength or a gap when there is no evidence yet", () => {
    const copy = buildBriefingCopy(
      overview({
        readinessScore: null,
        latestScore: null,
        scoreDelta: null,
        scoredRounds: 0,
        competencies: [],
        recurringGaps: [],
        pressure: { perRound: 0 } as ReportsOverview["pressure"]
      }),
      candidate,
      "Maya"
    );
    expect(copy.strongestLabel).toBe("");
    expect(copy.gapLabel).toBe("");
    expect(copy.verdict).toBe("Not enough to score yet.");
    expect(copy.pressureText).toBe("No follow-up questions to count yet.");
    expect(copy.summaryText).not.toMatch(/Ownership|Answer endings/);
  });

  it("uses plain words rather than 'signal' jargon", () => {
    const copy = buildBriefingCopy(overview(), candidate, "Maya");
    for (const text of [copy.verdict, copy.trend, copy.summaryText, copy.pressureText]) {
      expect(text).not.toMatch(/signal/i);
    }
  });
});
