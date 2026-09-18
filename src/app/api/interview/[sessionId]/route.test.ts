import { describe, expect, it } from "vitest";
import type { InterviewState } from "@/features/interviews/server/types";
import { serialiseInterviewState } from "./route";

describe("interview public state serializer", () => {
  it("omits story-practice answer guides while retaining the public room contract", () => {
    const state = {
      id: "11111111-1111-4111-8111-111111111111",
      setup: {
        role: "backend",
        level: "3-5",
        roundType: "technical",
        intensity: "realistic",
        context: "Frozen incident context",
        durationMinutes: 30,
        questionCount: 5,
        storyPracticeAssessment: {
          kind: "story-practice-assessment",
          practice: "applied-engineering",
          blockId: "block-1",
          assessmentId: "assessment-1",
          snapshotVersion: 1,
          evaluatorVersion: "applied-evaluator-v1"
        }
      },
      plan: [
        {
          text: "Defend the strongest production signal.",
          evidenceAnchor: "The retry counter rose after timeouts.",
          kind: "conversation",
          stage: "rapid",
          competency: "Diagnosis",
          answerFormat: "spoken",
          mustHit: ["strongest observable signal"],
          probeIfMissing: "Which signal establishes the causal chain?",
          maxFollowUps: 1,
          storyPracticeInterviewerGuide: {
            practice: "applied-engineering",
            label: "Applied Engineering",
            expectedAnswer: "PRIVATE_EXPECTED_ANSWER",
            rubric: [{ criterion: "PRIVATE_RUBRIC", points: 10 }]
          }
        }
      ],
      phase: "questioning",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);
    const payload = JSON.stringify(serialized);

    expect(serialized.currentQuestion).toMatchObject({
      text: "Defend the strongest production signal.",
      evidenceAnchor: "The retry counter rose after timeouts.",
      expects: ["strongest observable signal"],
      maxFollowUps: 1
    });
    expect(serialized.setup.storyPracticeAssessment?.practice).toBe("applied-engineering");
    expect(payload).not.toContain("storyPracticeInterviewerGuide");
    expect(payload).not.toContain("PRIVATE_EXPECTED_ANSWER");
    expect(payload).not.toContain("PRIVATE_RUBRIC");
  });

  it("normalizes section metadata for existing hiring-manager sessions", () => {
    const legacyStages = [
      "career",
      "current-role",
      "project",
      "project",
      "behavioral",
      "project",
      "behavioral",
      "behavioral"
    ] as const;
    const state = {
      id: "11111111-1111-4111-8111-111111111111",
      setup: {
        role: "frontend",
        level: "3-5",
        roundType: "hiring-manager",
        intensity: "realistic",
        context: "Final conversation",
        resumeRound: true
      },
      plan: legacyStages.map((stage, index) => ({
        text: `Question ${index + 1}`,
        stage,
        mustHit: ["a concrete example"],
        probeIfMissing: "What did you personally do?"
      })),
      phase: "questioning",
      questionIndex: 4,
      skippedQuestionIndexes: [3],
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);

    expect(serialized.stages).toEqual([
      "career",
      "current-role",
      "project",
      "project",
      "project",
      "behavioral",
      "behavioral",
      "behavioral"
    ]);
    expect(serialized.currentQuestion?.stage).toBe("project");
    expect(serialized.skippedQuestionIndexes).toEqual([3]);
  });

  it("never exposes the system-design evidence anchor or scoring rubric", () => {
    const state = {
      id: "11111111-1111-4111-8111-111111111111",
      setup: {
        role: "backend",
        level: "3-5",
        roundType: "technical",
        intensity: "realistic",
        context: "DSA and design",
        dsaDesignRound: {
          kind: "dsa-design-round",
          version: 1,
          designScenarioKey: "global-media-processing",
          designScenarioVersion: 1,
          designScenarioTitle: "Global media upload and processing",
          designDifficulty: "standard"
        }
      },
      plan: [
        {
          text: "Design a global media upload platform. Begin by asking questions.",
          evidenceAnchor: "PRIVATE_SCENARIO_CONTEXT",
          interviewSection: "design",
          stage: "design-frame",
          mustHit: ["PRIVATE_SCORING_RUBRIC"],
          probeIfMissing: "Ask one focused question."
        }
      ],
      phase: "questioning",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);
    expect(serialized.currentQuestion?.evidenceAnchor).toBeNull();
    expect(serialized.currentQuestion?.expects).toBeNull();
    expect(JSON.stringify(serialized)).not.toContain("PRIVATE_SCENARIO_CONTEXT");
    expect(JSON.stringify(serialized)).not.toContain("PRIVATE_SCORING_RUBRIC");
  });

  it("keeps provider telemetry server-side", () => {
    const state = {
      id: "11111111-1111-4111-8111-111111111111",
      setup: {
        role: "frontend",
        level: "3-5",
        roundType: "hiring-manager",
        intensity: "realistic",
        context: "Final conversation"
      },
      plan: [],
      phase: "done",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: [
        {
          speaker: "agent",
          text: "Thanks for the conversation.",
          startMs: 1,
          endMs: 1,
          runtime: {
            engineVersion: "engine-test",
            promptVersion: "prompt-test",
            durationMs: 50,
            usedFallback: false,
            calls: [
              {
                provider: "groq",
                operation: "interview.decide",
                model: "private-model-route",
                modelClass: "fast",
                attempt: 1,
                maxAttempts: 1,
                durationMs: 40,
                outcome: "success"
              }
            ]
          }
        }
      ]
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);

    expect(serialized.turns[0]).not.toHaveProperty("runtime");
    expect(JSON.stringify(serialized)).not.toContain("private-model-route");
  });

  it("does not expose unreached DSA & Design questions or private review guides", () => {
    const state = {
      id: "22222222-2222-4222-8222-222222222222",
      setup: {
        role: "backend",
        level: "3-5",
        roundType: "technical",
        intensity: "realistic",
        context: "Combined technical interview",
        agenda: ["Two Sum", "Binary Search", "Design scenario: Social feed"],
        templateId: "dsa",
        templateTitle: "DSA & Design interview",
        dsaQuestionSlugs: ["two-sum", "binary-search"],
        dsaDesignRound: {
          kind: "dsa-design-round",
          version: 1,
          designScenarioKey: "social-feed",
          designScenarioVersion: 1,
          designScenarioTitle: "Social feed",
          designDifficulty: "standard"
        }
      },
      plan: [
        {
          text: "Solve Two Sum.",
          kind: "code",
          interviewSection: "dsa",
          mustHit: ["correctness"],
          probeIfMissing: "Why is it correct?"
        },
        {
          text: "PRIVATE_UNREACHED_DESIGN_PROMPT",
          kind: "conversation",
          interviewSection: "design",
          mustHit: ["PRIVATE_EXPECTED_SIGNAL"],
          probeIfMissing: "PRIVATE_PROBE",
          storyPracticeInterviewerGuide: {
            practice: "architecture-design",
            label: "Architecture & Design",
            expectedAnswer: "PRIVATE_EXPECTED_ANSWER",
            rubric: [{ criterion: "PRIVATE_RUBRIC", points: 10 }]
          }
        }
      ],
      phase: "questioning",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const payload = JSON.stringify(serialiseInterviewState(state));
    expect(payload).toContain("Solve Two Sum.");
    expect(payload).not.toContain("PRIVATE_UNREACHED_DESIGN_PROMPT");
    expect(payload).not.toContain("PRIVATE_EXPECTED_SIGNAL");
    expect(payload).not.toContain("PRIVATE_EXPECTED_ANSWER");
    expect(payload).not.toContain("PRIVATE_RUBRIC");
  });

  it("exposes only the safe Core Technical & Projects question contract", () => {
    const state = {
      id: "33333333-3333-4333-8333-333333333333",
      setup: {
        role: "backend",
        level: "3-5",
        roundType: "technical",
        intensity: "realistic",
        context: "Core Technical & Projects interview",
        templateId: "technical-deep-dive",
        templateTitle: "Core Technical & Projects interview",
        technicalDeepDive: {
          kind: "technical-deep-dive",
          version: 2,
          coreBlueprintId: "core-blueprint-1",
          appliedBlueprintId: "applied-blueprint-1",
          project: { sourceKind: "project", sourceId: "project-1", name: "Ledger" }
        }
      },
      plan: [
        {
          text: "Which isolation level fits this write path?",
          kind: "mcq",
          options: ["Read committed", "Serializable", "Read uncommitted"],
          answerIndex: 1,
          explanation: "PRIVATE_AUTHORED_EXPLANATION",
          technicalProjectsSection: "technical-calibration",
          mustHit: ["write skew"],
          probeIfMissing: "Which mechanism determines the guarantee?",
          maxFollowUps: 0
        },
        {
          text: "PRIVATE_UNREACHED_PROJECT_PROMPT",
          kind: "conversation",
          technicalProjectsSection: "project-deep-dive",
          projectAct: "mechanism",
          mustHit: ["request path"],
          probeIfMissing: "Trace one request end to end.",
          technicalProjectInterviewerGuide: {
            sourceKind: "project",
            sourceId: "project-1",
            groundedFacts: ["PRIVATE_GROUNDED_FACT"],
            allowedSkillKeys: ["postgresql"],
            strongSignals: ["PRIVATE_STRONG_SIGNAL"],
            contradictionChecks: ["PRIVATE_CONTRADICTION_CHECK"],
            rubric: [{ criterion: "PRIVATE_PROJECT_RUBRIC", points: 10 }]
          }
        }
      ],
      phase: "questioning",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);
    const payload = JSON.stringify(serialized);

    expect(serialized.currentQuestion).toMatchObject({
      text: "Which isolation level fits this write path?",
      technicalProjectsSection: "technical-calibration",
      options: ["Read committed", "Serializable", "Read uncommitted"],
      maxFollowUps: 0
    });
    expect(payload).not.toContain("answerIndex");
    expect(payload).not.toContain("PRIVATE_AUTHORED_EXPLANATION");
    expect(payload).not.toContain("PRIVATE_UNREACHED_PROJECT_PROMPT");
    expect(payload).not.toContain("PRIVATE_GROUNDED_FACT");
    expect(payload).not.toContain("PRIVATE_PROJECT_RUBRIC");
  });

  it("formats Core Technical review questions and zeroes codeTask", () => {
    const state = {
      id: "cf6d426b-8aad-4def-a9be-b23438bf1d2e",
      setup: {
        role: "backend",
        level: "3-5",
        context: "Distributed database concurrency evaluation",
        roundType: "technical",
        intensity: "realistic",
        templateId: "core-technical-block-assessment",
        coreTechnicalAssessment: {
          kind: "core-technical-assessment",
          blockId: "block-1",
          assessmentId: "assessment-1",
          snapshotVersion: 1,
          evaluatorVersion: "eval-1"
        }
      },
      plan: [
        {
          text: "What causes transaction deadlocks under serializable isolation?",
          evidenceAnchor: "Transaction isolation levels",
          codeTask: "Transaction isolation levels",
          kind: "mcq",
          options: ["Concurrent lock acquisition order", "Read replicas lag", "Network partition", "Garbage collection"],
          stage: "rapid",
          mustHit: [],
          probeIfMissing: "",
          dsaReviewContext: {
            title: "Concurrency",
            difficulty: "intermediate",
            problemStatement: "Transactions acquire row locks in conflicting order.",
            constraints: [],
            examples: []
          }
        }
      ],
      phase: "questioning",
      questionIndex: 0,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);

    expect(serialized.currentQuestion).toMatchObject({
      text: "What causes transaction deadlocks under serializable isolation?",
      kind: "mcq",
      codeTask: null,
      dsaTransferQuestion: null
    });
    expect(serialized.currentQuestion?.options).toHaveLength(4);
    expect(serialized.currentQuestion?.dsaReviewContext).toBeDefined();
  });

  it("formats Core Technical transfer question with its transfer metadata", () => {
    const state = {
      id: "cf6d426b-8aad-4def-a9be-b23438bf1d2e",
      setup: {
        role: "backend",
        level: "3-5",
        context: "Distributed database concurrency evaluation",
        roundType: "technical",
        intensity: "realistic",
        templateId: "core-technical-block-assessment",
        coreTechnicalAssessment: {
          kind: "core-technical-assessment",
          blockId: "block-1",
          assessmentId: "assessment-1",
          snapshotVersion: 1,
          evaluatorVersion: "eval-1"
        }
      },
      plan: [
        { text: "Q1", stage: "rapid", mustHit: [], probeIfMissing: "" },
        { text: "Q2", stage: "rapid", mustHit: [], probeIfMissing: "" },
        { text: "Q3", stage: "explain", mustHit: [], probeIfMissing: "" },
        {
          text: "Implement ordered lock acquisition to prevent deadlocks.",
          codeTask: "Implement ordered lock acquisition to prevent deadlocks.",
          kind: "code",
          stage: "explain",
          mustHit: [],
          probeIfMissing: "",
          dsaTransferQuestion: {
            slug: "core-technical-transfer-4",
            title: "Ordered Lock Acquisition",
            primaryPattern: "concurrency-control",
            difficulty: "medium",
            expectedTimeMinutes: 10,
            problemStatement: "Sort resources before acquiring locks.",
            promptSummary: "Sort resources before acquiring locks.",
            constraints: ["Deterministic lock order"],
            examples: [],
            starterCode: {
              javascript: "function solution(input) { return input; }\nmodule.exports = { solution };",
              python: "",
              cpp: "",
              java: ""
            }
          }
        }
      ],
      phase: "questioning",
      questionIndex: 3,
      followUpCount: 0,
      startedAt: 1,
      turns: []
    } satisfies InterviewState;

    const serialized = serialiseInterviewState(state);

    expect(serialized.currentQuestion).toMatchObject({
      kind: "code",
      options: null
    });
    expect(serialized.currentQuestion?.dsaTransferQuestion).toBeDefined();
    expect(serialized.currentQuestion?.dsaTransferQuestion?.starterCode.javascript).toContain("function solution");
    expect(serialized.currentQuestion?.dsaTransferQuestion?.constraints.length).toBeGreaterThan(0);
  });
});
