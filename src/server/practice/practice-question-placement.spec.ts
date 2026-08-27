import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import {
  selectPracticeQuestionPlacements,
  type PracticePlacementCandidate
} from "./practice-question-placement";

describe("practice question placement", () => {
  it("is deterministic, chapter-balanced, and reuses canonical progress in Final Mock", () => {
    const candidates = [
      ...bank("core-technical", 12, 3),
      ...bank("applied-engineering", 42, 4),
      ...bank("architecture-system-design", 12, 4),
      ...bank("resume-behavioral-defense", 9, 2)
    ];

    const first = selectPracticeQuestionPlacements(candidates, plan());
    const second = selectPracticeQuestionPlacements([...candidates].reverse(), plan());

    expect(first).toEqual(second);
    expect(count(first, "core-technical")).toBe(12);
    expect(count(first, "applied-engineering")).toBe(24);
    expect(count(first, "architecture-system-design")).toBe(12);
    expect(count(first, "resume-behavioral-defense")).toBe(9);
    expect(count(first, "final-mock")).toBe(12);
    expect(new Set(first.filter((item) => item.practiceSessionKey === "applied-engineering").map((item) => item.chapterKey)).size).toBe(4);

    const primaryIds = new Set(
      first.filter((item) => item.practiceSessionKey !== "final-mock").map((item) => item.questionProgressId)
    );
    expect(
      first
        .filter((item) => item.practiceSessionKey === "final-mock")
        .every((item) => primaryIds.has(item.questionProgressId))
    ).toBe(true);
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
  const kinds = [
    "problem-solving",
    "core-technical",
    "applied-engineering",
    "architecture-system-design",
    "final-mock"
  ] as const;
  return {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    revision: 1,
    status: "ready",
    generatedAt: 1,
    sourceSnapshot: {
      candidateProfile: {
        id: "00000000-0000-4000-8000-000000000002",
        revision: 1,
        sourceResumeFingerprint: "resume"
      },
      targetRole: { title: "Frontend Engineer", family: "frontend", source: "declared" },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "test",
    sessions: kinds.map((kind, index) => ({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      kind,
      order: index + 1,
      title: kind,
      subtitle: kind,
      durationMinutes: 30,
      difficulty: "adaptive" as const,
      rationale: "test",
      topics: [{ key: "react", label: "React", targetPercent: 100, skillKeys: ["react"], objectives: ["Explain React"] }],
      structure: [{ kind: "core" as const, questionCount: 3, formats: ["spoken" as const], purpose: "test" }],
      followUpPolicy: { maxPerQuestion: 1, probeWeakClaims: true, increaseDifficultyAfterStrongAnswer: true, stayWithinBlueprintTopics: true as const },
      rubric: [{ key: "depth", label: "Depth", weightPercent: 100, strongSignals: ["specific"], weakSignals: ["vague"] }]
    }))
  };
}
