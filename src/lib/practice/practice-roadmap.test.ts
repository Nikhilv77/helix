import { describe, expect, it } from "vitest";
import {
  INTERVIEW_SESSION_KINDS,
  type PersonalizedInterviewPlan,
  type SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import { PRACTICE_SESSION_KEYS, projectPracticeSessions } from "./practice-roadmap";

function blueprint(
  kind: (typeof INTERVIEW_SESSION_KINDS)[number],
  index: number
): SessionBlueprint {
  return {
    id: `blueprint-${kind}`,
    kind,
    order: index + 1,
    title: kind === "problem-solving" ? "Problem Solving · TypeScript" : `Title ${kind}`,
    subtitle: `Purpose ${kind}`,
    durationMinutes: 30 + index,
    difficulty: "adaptive",
    rationale: "Candidate evidence",
    topics: [
      {
        key: "topic",
        label: `Topic ${kind}`,
        targetPercent: 100,
        skillKeys: [],
        objectives: ["Explain the trade-offs"]
      }
    ],
    structure: [
      {
        kind: "core",
        questionCount: 3,
        formats: ["spoken"],
        purpose: "Test depth"
      }
    ],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "depth",
        label: "Depth",
        weightPercent: 100,
        strongSignals: ["Specific reasoning"],
        weakSignals: ["Vague answer"]
      }
    ]
  };
}

function plan(idSuffix = "one"): PersonalizedInterviewPlan {
  return {
    schemaVersion: 1,
    id: `00000000-0000-4000-8000-0000000000${idSuffix === "one" ? "01" : "02"}`,
    revision: idSuffix === "one" ? 1 : 2,
    status: "ready",
    generatedAt: 1,
    sourceSnapshot: {
      candidateProfile: {
        id: "00000000-0000-4000-8000-000000000010",
        revision: 1,
        sourceResumeFingerprint: "resume"
      },
      targetRole: { title: "Engineer", family: "fullstack", source: "declared" },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Personalized preparation",
    sessions: INTERVIEW_SESSION_KINDS.map((kind, index) => {
      const session = blueprint(kind, index);
      return idSuffix === "one" ? session : { ...session, id: `${session.id}-regenerated` };
    })
  };
}

describe("projectPracticeSessions", () => {
  it("projects only DSA while the story-driven non-DSA flow is rebuilt", () => {
    const sessions = projectPracticeSessions(plan());

    expect(sessions.map((session) => session.key)).toEqual(PRACTICE_SESSION_KEYS);
    expect(sessions[0]).toMatchObject({
      key: "dsa",
      title: "DSA · TypeScript",
      sourceBlueprintId: "blueprint-problem-solving"
    });

    const keys = sessions.map((session) => session.key as string);
    expect(keys).not.toContain("core-technical");
    expect(keys).not.toContain("applied-engineering");
    expect(keys).not.toContain("architecture-system-design");
    expect(keys).not.toContain("resume-behavioral-defense");
    expect(keys).not.toContain("final-mock");
  });

  it("keeps stable Practice keys when immutable blueprint IDs are regenerated", () => {
    expect(projectPracticeSessions(plan("two")).map((session) => session.key)).toEqual(
      projectPracticeSessions(plan("one")).map((session) => session.key)
    );
  });
});
