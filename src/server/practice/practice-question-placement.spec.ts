import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import {
  selectPracticeQuestionPlacements,
  type PracticePlacementCandidate
} from "./practice-question-placement";

describe("practice question placement", () => {
  it("is deterministic and chapter-balanced across the four Practice sessions", () => {
    const candidates = [
      ...bank("core-technical", 12, 3),
      ...bank("applied-engineering", 42, 4),
      ...bank("architecture-system-design", 12, 4)
    ];

    const first = selectPracticeQuestionPlacements(candidates, plan());
    const second = selectPracticeQuestionPlacements([...candidates].reverse(), plan());

    expect(first).toEqual(second);
    expect(count(first, "core-technical")).toBe(12);
    expect(count(first, "applied-engineering")).toBe(24);
    expect(count(first, "architecture-system-design")).toBe(12);
    expect(
      new Set(
        first
          .filter((item) => item.practiceSessionKey === "applied-engineering")
          .map((item) => item.chapterKey)
      ).size
    ).toBe(4);
  });

  it("places no final mock — that round is interview-only", () => {
    const placed = selectPracticeQuestionPlacements(bank("core-technical", 12, 3), plan());
    expect(placed.every((item) => (item.practiceSessionKey as string) !== "final-mock")).toBe(true);
  });

  it("places no resume round — defending your own history is not drillable", () => {
    const placed = selectPracticeQuestionPlacements(
      bank("resume-behavioral-defense", 9, 2),
      plan()
    );
    expect(placed).toHaveLength(0);
  });
});

describe("format weighting", () => {
  /**
   * Topic matching alone favoured the incumbents: an essay titled after the
   * blueprint's topics shares more tokens with them than an artifact question
   * does. Eleven typed questions displaced ten predict-run ones in the same
   * session before this weight existed.
   */
  const typed = bank("core-technical", 6, 1).map((candidate, index) => ({
    ...candidate,
    questionProgressId: `typed-${index}`,
    sourceQuestionId: `typed-source-${index}`,
    format: "typed"
  }));
  const artifact = bank("core-technical", 6, 1).map((candidate, index) => ({
    ...candidate,
    questionProgressId: `artifact-${index}`,
    sourceQuestionId: `artifact-source-${index}`,
    format: "find-the-flaw"
  }));

  it("prefers an artifact question over an essay when topics tie", () => {
    const placed = selectPracticeQuestionPlacements([...typed, ...artifact], plan(), "3-5", null)
      .filter((item) => item.practiceSessionKey === "core-technical")
      .slice(0, 6);
    expect(placed.every((item) => item.questionProgressId.startsWith("artifact-"))).toBe(true);
  });

  it("does not shut essays out entirely — they fill the remaining slots", () => {
    const placed = selectPracticeQuestionPlacements(
      [...typed, ...artifact],
      plan(),
      "3-5",
      null
    ).filter((item) => item.practiceSessionKey === "core-technical");
    expect(placed.some((item) => item.questionProgressId.startsWith("typed-"))).toBe(true);
  });

  it("is small enough that a strong topic match still wins", () => {
    // The weight is 12 and each matching blueprint token is worth 10, so a
    // single coincidental match loses and a genuine two-token match wins. The
    // fixture blueprint's topic yields the tokens "react" and "explain".
    const onTopic = typed.map((candidate) => ({
      ...candidate,
      tags: ["react"],
      whatItTests: ["react", "explain"]
    }));
    // Every scored field has to move: candidateTokens is built from title,
    // prompt and competency as well as tags, and the shared fixture mentions
    // React in all of them.
    const offTopic = artifact.map((candidate) => ({
      ...candidate,
      title: "Unrelated question",
      prompt: "Something with no overlap at all.",
      competency: "unrelated",
      tags: ["unrelated"],
      whatItTests: ["unrelated"]
    }));
    const placed = selectPracticeQuestionPlacements([...offTopic, ...onTopic], plan(), "3-5", null)
      .filter((item) => item.practiceSessionKey === "core-technical")
      .slice(0, 3);
    expect(placed.some((item) => item.questionProgressId.startsWith("typed-"))).toBe(true);
  });
});

describe("language gating", () => {
  /**
   * A `predict-run` question asks what JavaScript prints. For a Go candidate
   * there is no partially-correct answer, so it must not be offered at all —
   * unlike level or role, which are ranking signals rather than gates.
   */
  const jsOnly = bank("core-technical", 6, 2).map((candidate) => ({
    ...candidate,
    languages: ["javascript"]
  }));
  const agnostic = bank("core-technical", 6, 2).map((candidate, index) => ({
    ...candidate,
    questionProgressId: `agnostic-${index}`,
    sourceQuestionId: `agnostic-source-${index}`
  }));

  it("offers language-bound questions to a matching candidate", () => {
    const placed = selectPracticeQuestionPlacements(jsOnly, plan(), "3-5", "javascript");
    expect(count(placed, "core-technical")).toBe(6);
  });

  it("withholds them from a candidate using another language", () => {
    const placed = selectPracticeQuestionPlacements(jsOnly, plan(), "3-5", "go");
    expect(count(placed, "core-technical")).toBe(0);
  });

  it("withholds them when the candidate has no language set", () => {
    const placed = selectPracticeQuestionPlacements(jsOnly, plan(), "3-5", null);
    expect(count(placed, "core-technical")).toBe(0);
  });

  it("always offers language-agnostic questions", () => {
    // jest's expect takes no message argument, so the language is asserted
    // through the collected result rather than a per-iteration label.
    const counts = ["javascript", "go", "python", null].map((language) =>
      count(selectPracticeQuestionPlacements(agnostic, plan(), "3-5", language), "core-technical")
    );
    expect(counts).toEqual([6, 6, 6, 6]);
  });

  it("mixes both for a matching candidate and drops the bound half otherwise", () => {
    const mixed = [...jsOnly, ...agnostic];
    expect(
      count(
        selectPracticeQuestionPlacements(mixed, plan(), "3-5", "javascript"),
        "core-technical"
      )
    ).toBe(12);
    expect(
      count(selectPracticeQuestionPlacements(mixed, plan(), "3-5", "go"), "core-technical")
    ).toBe(6);
  });
});

function count(
  placements: ReturnType<typeof selectPracticeQuestionPlacements>,
  sessionKey: string
) {
  return placements.filter((placement) => placement.practiceSessionKey === sessionKey).length;
}

function bank(sessionKey: string, size: number, chapters: number): PracticePlacementCandidate[] {
  return Array.from({ length: size }, (_, index) => ({
    questionProgressId: `${sessionKey}-${index.toString().padStart(2, "0")}`,
    sourceQuestionId: `${sessionKey}-source-${index.toString().padStart(2, "0")}`,
    canonicalOrder: index + 1,
    sessionKey,
    chapterKey: `chapter-${index % chapters}`,
    contentVersion: 1,
    roles: ["frontend", "fullstack"],
    levels: ["0-2", "3-5", "5-plus"],
    languages: [],
    format: "typed",
    prerequisites: [],
    attemptCount: 0,
    bestScore: null,
    lastAttemptedAt: null,
    status: "LOCKED",
    title: `React question ${index}`,
    prompt: "Explain a React engineering decision and its failure behavior.",
    competency: "react",
    tags: ["react"],
    whatItTests: ["reasoning"]
  }));
}

function plan(): PersonalizedInterviewPlan {
  return {
    id: "plan-1",
    revision: 1,
    schemaVersion: 1,
    status: "active",
    generatedAt: 0,
    sourceSnapshot: {
      candidateProfile: { id: "profile-1", revision: 1 },
      targetRole: { title: "Frontend Engineer", family: "frontend", source: "declared" },
      experienceBand: "0-2"
    },
    rationale: "test",
    sessions: [
      {
        id: "core-technical",
        kind: "core-technical",
        order: 1,
        title: "Core",
        subtitle: "Core",
        durationMinutes: 30,
        difficulty: "intermediate",
        rationale: "test",
        topics: [
          {
            key: "react",
            label: "React",
            targetPercent: 100,
            skillKeys: ["react"],
            objectives: ["Explain React"]
          }
        ],
        structure: [
          { kind: "core" as const, questionCount: 3, formats: ["spoken" as const], purpose: "test" }
        ],
        rubric: [
          {
            key: "depth",
            label: "Depth",
            weightPercent: 100,
            strongSignals: ["specific"],
            weakSignals: ["vague"]
          }
        ]
      }
    ]
  } as unknown as PersonalizedInterviewPlan;
}
