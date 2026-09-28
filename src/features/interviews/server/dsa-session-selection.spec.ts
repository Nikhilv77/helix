import type { CandidatePerformanceProfile } from "@/features/interviews/domain/performance-profile";
import {
  dsaDifficultyBand,
  selectDsaInterviewPair,
  selectDsaInterviewQuestions,
  type DsaSelectionCandidate
} from "./dsa-session-selection";

const NOW = Date.UTC(2026, 7, 25, 12);

function performance(score: number, confidence = 0.7): CandidatePerformanceProfile {
  return {
    schemaVersion: 3,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 1,
    sourceSessionFingerprint: "sha256-dsa",
    generatedAt: NOW,
    completedSessionCount: 1,
    answeredQuestionCount: 3,
    sourceSessionIds: ["session-dsa"],
    skills: [
      {
        skillKey: "problem-solving",
        score,
        confidence,
        sampleSize: 3,
        lastObservedAt: NOW,
        trend: null,
        topicKeys: ["dsa:arrays-hashing"],
        rubricPerformance: []
      }
    ]
  };
}

const candidates: DsaSelectionCandidate[] = [
  { slug: "easy-1", title: "Easy 1", difficulty: "easy", primaryPattern: "arrays" },
  { slug: "easy-2", title: "Easy 2", difficulty: "easy", primaryPattern: "strings" },
  { slug: "medium-1", title: "Medium 1", difficulty: "medium", primaryPattern: "trees" },
  { slug: "medium-2", title: "Medium 2", difficulty: "medium", primaryPattern: "graphs" },
  { slug: "hard-1", title: "Hard 1", difficulty: "hard", primaryPattern: "dp" },
  { slug: "hard-2", title: "Hard 2", difficulty: "hard", primaryPattern: "backtracking" }
];

describe("adaptive DSA session selection", () => {
  it("maps demonstrated performance to a trusted difficulty band", () => {
    expect(dsaDifficultyBand(null)).toBeNull();
    expect(dsaDifficultyBand(performance(42))).toBe("foundational");
    expect(dsaDifficultyBand(performance(70))).toBe("intermediate");
    expect(dsaDifficultyBand(performance(88))).toBe("advanced");
    expect(dsaDifficultyBand(performance(88, 0.2))).toBeNull();
  });

  it("prefers easier solved questions after weak evidence", () => {
    const selected = selectDsaInterviewQuestions({
      solved: candidates,
      fallback: [],
      performance: performance(42),
      count: 3,
      random: () => 0.5
    });

    expect(selected.map((item) => item.difficulty)).toEqual(["easy", "easy", "medium"]);
  });

  it("prefers harder solved questions after strong evidence", () => {
    const selected = selectDsaInterviewQuestions({
      solved: candidates,
      fallback: [],
      performance: performance(90),
      count: 3,
      random: () => 0.5
    });

    expect(selected.map((item) => item.difficulty)).toEqual(["hard", "hard", "medium"]);
  });
});

describe("DSA interview pair", () => {
  const item = (slug: string, primaryPattern: string, difficulty = "medium") => ({
    slug,
    title: slug,
    difficulty,
    primaryPattern
  });
  const first = () => 0;

  it("pairs one solved problem with an unseen one from the same pattern", () => {
    const pair = selectDsaInterviewPair({
      solved: [item("two-sum", "hashing"), item("merge-intervals", "intervals")],
      unseen: [item("group-anagrams", "hashing"), item("insert-interval", "intervals")],
      curated: [],
      performance: null,
      random: first
    });

    expect(pair).toHaveLength(2);
    expect(["two-sum", "merge-intervals"]).toContain(pair[0]!.slug);
    expect(pair[1]!.primaryPattern).toBe(pair[0]!.primaryPattern);
    expect(["group-anagrams", "insert-interval"]).toContain(pair[1]!.slug);
  });

  it("never offers a solved problem as the new one", () => {
    const pair = selectDsaInterviewPair({
      solved: [item("two-sum", "hashing")],
      unseen: [item("two-sum", "hashing"), item("valid-anagram", "hashing")],
      curated: [],
      performance: null,
      random: first
    });

    expect(pair.map((question) => question.slug)).toEqual(["two-sum", "valid-anagram"]);
  });

  it("falls back to another practised pattern, then to a second solved problem", () => {
    const otherPattern = selectDsaInterviewPair({
      solved: [item("two-sum", "hashing"), item("merge-intervals", "intervals")],
      unseen: [item("insert-interval", "intervals")],
      curated: [],
      performance: null,
      random: first
    });
    expect(otherPattern.map((question) => question.slug)).toContain("insert-interval");

    const nothingNew = selectDsaInterviewPair({
      solved: [item("two-sum", "hashing"), item("merge-intervals", "intervals")],
      unseen: [],
      curated: [],
      performance: null,
      random: first
    });
    expect(nothingNew.map((question) => question.slug).sort()).toEqual([
      "merge-intervals",
      "two-sum"
    ]);
  });
});
