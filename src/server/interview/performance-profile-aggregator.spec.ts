import type { SessionBlueprint } from "@/lib/interviews/personalized-plan";
import {
  aggregateCandidatePerformanceProfile,
  completedAdaptiveSessions,
  completedPersonalizedSessions,
  performanceSourceFingerprint
} from "./performance-profile-aggregator";
import type { StoredInterviewSession } from "./session-store";
import type { InterviewState, PlannedQuestion } from "./types";

const NOW = Date.UTC(2026, 7, 24, 12);

function blueprint(): SessionBlueprint {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    kind: "core-technical",
    order: 2,
    title: "React & Frontend Engineering",
    subtitle: "Mechanisms and trade-offs",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "React is central to the target role.",
    topics: [
      {
        key: "react",
        label: "React",
        targetPercent: 100,
        skillKeys: ["react", "typescript"],
        objectives: ["Explain rendering and state trade-offs"]
      }
    ],
    structure: [
      {
        kind: "core",
        questionCount: 2,
        formats: ["spoken"],
        purpose: "Probe mechanisms."
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
        key: "technical-depth",
        label: "Technical depth",
        weightPercent: 100,
        strongSignals: ["Explains rendering behavior"],
        weakSignals: ["Only names hooks"]
      }
    ]
  };
}

function question(text: string): PlannedQuestion {
  return {
    text,
    kind: "conversation",
    competency: "Technical depth",
    blueprintStage: "core",
    blueprintDifficulty: "intermediate",
    blueprintFormat: "spoken",
    topicKey: "react",
    skillKeys: ["react", "typescript"],
    rubricKeys: ["technical-depth"],
    maxFollowUps: 2,
    mustHit: ["rendering mechanism", "trade-off"],
    probeIfMissing: "What causes that rendering behavior?"
  };
}

function personalizedSession(overrides: Partial<InterviewState> = {}): StoredInterviewSession {
  const state: InterviewState = {
    id: "11111111-1111-4111-8111-111111111111",
    setup: {
      role: "frontend",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "Built a collaborative React editor.",
      personalizedPlanId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      personalizedBlueprint: blueprint(),
      questionCount: 3
    },
    plan: [
      question("Why did this state boundary reduce rerenders?"),
      question("How does React schedule this update?")
    ],
    phase: "done",
    questionIndex: 2,
    followUpCount: 0,
    startedAt: NOW - 60_000,
    turns: [
      {
        speaker: "agent",
        text: "Why did this state boundary reduce rerenders?",
        startMs: 0,
        endMs: 0,
        action: "intro",
        questionIndex: 0
      },
      {
        speaker: "user",
        text: "I chose local state because it reduced rerenders by 30 percent for our users.",
        startMs: 1_000,
        endMs: 8_000,
        questionIndex: 0
      },
      {
        speaker: "agent",
        text: "How does React schedule this update?",
        startMs: 8_000,
        endMs: 8_000,
        action: "move_on",
        questionIndex: 1
      },
      {
        speaker: "user",
        text: "React rerenders the component.",
        startMs: 9_000,
        endMs: 11_000,
        questionIndex: 1
      },
      {
        speaker: "agent",
        text: "What causes that rendering behavior?",
        startMs: 11_000,
        endMs: 11_000,
        action: "probe",
        questionIndex: 1
      }
    ],
    evidence: {},
    ...overrides
  };
  return { state, touchedAt: NOW };
}

function dsaSession(): StoredInterviewSession {
  const state: InterviewState = {
    id: "66666666-6666-4666-8666-666666666666",
    setup: {
      role: "frontend",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "DSA interview",
      templateId: "frontend-dsa",
      templateTitle: "DSA practice interview",
      dsaQuestionSlugs: ["two-sum"],
      questionCount: 3
    },
    plan: [
      {
        text: "Walk me through Two Sum.",
        kind: "code",
        competency: "Algorithmic reasoning",
        mustHit: ["approach", "complexity"],
        probeIfMissing: "What is the complexity?"
      }
    ],
    phase: "done",
    questionIndex: 1,
    followUpCount: 0,
    startedAt: NOW - 40_000,
    turns: [
      {
        speaker: "user",
        text: "I use a hash map in one pass, giving O(n) time and O(n) space.",
        startMs: 1_000,
        endMs: 8_000,
        questionIndex: 0
      }
    ],
    evidence: {}
  };
  return { state, touchedAt: NOW };
}

function behavioralSession(): StoredInterviewSession {
  const state: InterviewState = {
    id: "77777777-7777-4777-8777-777777777777",
    setup: {
      role: "frontend",
      level: "3-5",
      roundType: "behavioral",
      intensity: "realistic",
      context: "Resume interview",
      templateId: "resume-behavioral-defense",
      templateTitle: "Resume and Behavioral Defense",
      resumeRound: true
    },
    plan: [
      {
        text: "What did you own in this launch?",
        kind: "conversation",
        stage: "experience",
        competency: "Ownership and impact",
        mustHit: ["ownership", "outcome"],
        probeIfMissing: "What changed because of your work?"
      }
    ],
    phase: "done",
    questionIndex: 1,
    followUpCount: 0,
    startedAt: NOW - 20_000,
    turns: [
      {
        speaker: "user",
        text: "I owned the rollout because reliability mattered, and it reduced failures by 30 percent.",
        startMs: 1_000,
        endMs: 7_000,
        questionIndex: 0
      }
    ],
    evidence: {}
  };
  return { state, touchedAt: NOW };
}

describe("performance profile aggregation", () => {
  it("uses only completed personalized sessions", () => {
    const completed = personalizedSession();
    const incomplete = personalizedSession({
      id: "22222222-2222-4222-8222-222222222222",
      phase: "questioning"
    });
    const generic = personalizedSession({
      id: "33333333-3333-4333-8333-333333333333",
      setup: {
        role: "frontend",
        level: "3-5",
        roundType: "technical",
        intensity: "realistic",
        context: "Generic interview"
      }
    });

    expect(completedPersonalizedSessions([generic, incomplete, completed])).toEqual([completed]);
  });

  it("aggregates skill, topic, rubric, confidence, and trend evidence", () => {
    const session = personalizedSession();
    const profile = aggregateCandidatePerformanceProfile({
      id: "44444444-4444-4444-8444-444444444444",
      revision: 2,
      sessions: [session],
      generatedAt: NOW
    });

    expect(profile).toMatchObject({
      revision: 2,
      completedSessionCount: 1,
      answeredQuestionCount: 2,
      sourceSessionIds: [session.state.id]
    });
    expect(profile?.skills).toHaveLength(2);
    expect(profile?.skills.find((skill) => skill.skillKey === "react")).toMatchObject({
      sampleSize: 2,
      topicKeys: ["react"],
      rubricPerformance: [expect.objectContaining({ rubricKey: "technical-depth", sampleSize: 2 })]
    });
    expect(profile?.skills[0]?.confidence).toBeGreaterThan(0.4);
    expect(profile?.skills[0]?.score).toBeGreaterThan(40);
    expect(profile?.skills[0]?.score).toBeLessThan(90);
  });

  it("uses persisted technical verdicts instead of the no-follow-up score floor", () => {
    const technicalEvaluation = {
      source: "semantic-evaluator" as const,
      score: 22,
      verdict: "incorrect" as const,
      confidence: 0.95,
      summary: "The central rendering claim is false.",
      strengths: [],
      gaps: ["React does not schedule updates in the described way."],
      rubricScores: [
        { rubricKey: "technical-depth", score: 22, rationale: "Central mechanism is false." }
      ],
      answerExcerpts: ["React always rerenders everything."],
      execution: null,
      evaluatedAt: NOW
    };
    const session = personalizedSession({
      questionEvaluations: {
        "0": technicalEvaluation,
        "1": technicalEvaluation
      }
    });

    const profile = aggregateCandidatePerformanceProfile({
      id: "99999999-9999-4999-8999-999999999999",
      revision: 1,
      sessions: [session],
      generatedAt: NOW
    });

    expect(profile?.skills.find((skill) => skill.skillKey === "react")?.score).toBe(22);
  });

  it("includes DSA and resume/behavioral rounds in the adaptive profile", () => {
    const dsa = dsaSession();
    const behavioral = behavioralSession();
    expect(completedAdaptiveSessions([behavioral, dsa])).toEqual([dsa, behavioral]);

    const profile = aggregateCandidatePerformanceProfile({
      id: "88888888-8888-4888-8888-888888888888",
      revision: 1,
      sessions: [behavioral, dsa],
      generatedAt: NOW
    });

    expect(profile).toMatchObject({
      schemaVersion: 3,
      completedSessionCount: 2,
      answeredQuestionCount: 2
    });
    expect(profile?.skills.map((skill) => skill.skillKey)).toEqual(
      expect.arrayContaining([
        "problem-solving",
        "dsa-pattern:arrays-hashing",
        "behavioral:ownership",
        "behavioral:decision",
        "behavioral:specificity",
        "behavioral:outcome"
      ])
    );
    expect(profile?.skills.find((skill) => skill.skillKey === "behavioral:outcome")?.score).toBe(
      86
    );
  });

  it("produces the same fingerprint regardless of input ordering", () => {
    const older = personalizedSession();
    const newer = personalizedSession({
      id: "55555555-5555-4555-8555-555555555555",
      startedAt: NOW
    });

    expect(performanceSourceFingerprint([older, newer])).toBe(
      performanceSourceFingerprint([newer, older])
    );
  });
});
