import { rankCandidates, scoreCandidate, type HelperCandidate } from "./helper-matching";

const NOW = new Date("2026-08-26T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function candidate(overrides: Partial<HelperCandidate> = {}): HelperCandidate {
  return {
    ownerId: "user-1",
    completedAt: daysAgo(7),
    patternCompletions: 4,
    totalCompletions: 12,
    qualificationScore: 1,
    exactQuestionScore: 1,
    languageScore: 1,
    ...overrides
  };
}

describe("helper scoring", () => {
  it("stays inside 0 and 1 at both extremes", () => {
    const best = scoreCandidate(
      candidate({ completedAt: NOW, patternCompletions: 50, totalCompletions: 500 }),
      NOW
    );
    const worst = scoreCandidate(
      candidate({
        completedAt: daysAgo(3_650),
        patternCompletions: 0,
        totalCompletions: 0,
        qualificationScore: 0,
        exactQuestionScore: 0,
        languageScore: 0
      }),
      NOW
    );

    expect(best).toBeLessThanOrEqual(1);
    expect(best).toBeGreaterThan(0.95);
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThan(0.01);
  });

  it("halves the recency term after the half-life", () => {
    const fresh = scoreCandidate(
      candidate({
        completedAt: NOW,
        patternCompletions: 0,
        totalCompletions: 0,
        qualificationScore: 0,
        exactQuestionScore: 0,
        languageScore: 0
      }),
      NOW
    );
    const stale = scoreCandidate(
      candidate({
        completedAt: daysAgo(21),
        patternCompletions: 0,
        totalCompletions: 0,
        qualificationScore: 0,
        exactQuestionScore: 0,
        languageScore: 0
      }),
      NOW
    );

    expect(stale).toBeCloseTo(fresh / 2, 5);
  });

  it("prefers a recent solver over a prolific but stale one", () => {
    // Recency is weighted highest on purpose: recall of where this problem
    // goes wrong matters more for explaining it than raw volume since.
    const recent = candidate({
      ownerId: "recent",
      completedAt: daysAgo(2),
      patternCompletions: 1,
      totalCompletions: 3
    });
    const prolific = candidate({
      ownerId: "prolific",
      completedAt: daysAgo(180),
      patternCompletions: 40,
      totalCompletions: 200
    });

    expect(rankCandidates([prolific, recent], NOW)[0]!.ownerId).toBe("recent");
  });

  it("separates two equally recent solvers by pattern depth", () => {
    const shallow = candidate({ ownerId: "shallow", patternCompletions: 1, totalCompletions: 12 });
    const deep = candidate({ ownerId: "deep", patternCompletions: 8, totalCompletions: 12 });

    expect(rankCandidates([shallow, deep], NOW)[0]!.ownerId).toBe("deep");
  });

  it("prefers stronger qualification evidence when other signals match", () => {
    const profileQualified = candidate({
      ownerId: "profile",
      qualificationScore: 0.7,
      exactQuestionScore: 0
    });
    const exactSolver = candidate({ ownerId: "exact", qualificationScore: 1 });

    expect(rankCandidates([profileQualified, exactSolver], NOW)[0]!.ownerId).toBe("exact");
  });

  it("prefers evidence in the learner's language without excluding other languages", () => {
    const crossLanguage = candidate({ ownerId: "cross-language", languageScore: 0 });
    const sameLanguage = candidate({ ownerId: "same-language", languageScore: 0.8 });

    const ranked = rankCandidates([crossLanguage, sameLanguage], NOW);
    expect(ranked.map((entry) => entry.ownerId)).toEqual(["same-language", "cross-language"]);
  });

  it("stops rewarding pattern depth past saturation", () => {
    const saturated = scoreCandidate(candidate({ patternCompletions: 8 }), NOW);
    const beyond = scoreCandidate(candidate({ patternCompletions: 80 }), NOW);

    expect(beyond).toBe(saturated);
  });

  it("breaks a score tie by who solved it most recently", () => {
    const older = candidate({ ownerId: "older", completedAt: daysAgo(9) });
    const newer = candidate({ ownerId: "newer", completedAt: daysAgo(9) });
    // Same score; nudge one so the tiebreak is exercised deterministically.
    newer.completedAt = new Date(older.completedAt.getTime() + 1_000);

    const ranked = rankCandidates([older, newer], NOW);
    expect(ranked[0]!.ownerId).toBe("newer");
  });

  it("returns everyone it was given, ordered", () => {
    const ranked = rankCandidates(
      [
        candidate({ ownerId: "a", completedAt: daysAgo(40) }),
        candidate({ ownerId: "b", completedAt: daysAgo(1) }),
        candidate({ ownerId: "c", completedAt: daysAgo(15) })
      ],
      NOW
    );

    expect(ranked.map((entry) => entry.ownerId)).toEqual(["b", "c", "a"]);
    expect(ranked).toHaveLength(3);
  });

  it("handles an empty pool without inventing anyone", () => {
    expect(rankCandidates([], NOW)).toEqual([]);
  });

  it("does not treat a future completion as better than now", () => {
    // Clock skew between app servers should not produce a score above 1.
    const skewed = scoreCandidate(
      candidate({ completedAt: new Date(NOW.getTime() + 86_400_000) }),
      NOW
    );
    const current = scoreCandidate(candidate({ completedAt: NOW }), NOW);

    expect(skewed).toBeLessThanOrEqual(current);
  });
});
