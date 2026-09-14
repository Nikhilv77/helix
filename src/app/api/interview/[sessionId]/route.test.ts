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
});
