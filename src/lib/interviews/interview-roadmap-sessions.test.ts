import { describe, expect, it } from "vitest";
import { interviewRoadmapSessions, roadmapSessionHref } from "./interview-roadmap-sessions";
import {
  INTERVIEW_SESSION_KINDS,
  PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
  type PersonalizedInterviewPlan,
  type SessionBlueprint
} from "./personalized-plan";
import type { InterviewHistoryItem } from "@/lib/shared/types";

function blueprint(
  kind: (typeof INTERVIEW_SESSION_KINDS)[number],
  index: number
): SessionBlueprint {
  const titles: Record<(typeof INTERVIEW_SESSION_KINDS)[number], string> = {
    "problem-solving": "Problem Solving · Java",
    "core-technical": "React & Frontend Engineering",
    "applied-engineering": "Java & Spring Boot",
    "architecture-system-design": "Full Stack System Design",
    "final-mock": "Full Stack Mock"
  };

  return {
    id: `blueprint-${kind}`,
    kind,
    order: index + 1,
    title: titles[kind],
    subtitle: `Personalized ${kind} session`,
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "Grounded in the candidate profile.",
    topics: [
      {
        key: "java",
        label: "Java",
        targetPercent: 100,
        skillKeys: ["java"],
        objectives: ["Explain engineering choices"]
      }
    ],
    structure: [
      {
        kind: "core",
        questionCount: 4,
        formats: ["spoken"],
        purpose: "Test technical depth."
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
        strongSignals: ["Explains mechanisms"],
        weakSignals: ["Only names technologies"]
      }
    ]
  };
}

function plan(): PersonalizedInterviewPlan {
  return {
    schemaVersion: PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
    id: "plan-java-fullstack",
    revision: 1,
    status: "ready",
    generatedAt: 1_787_600_000_000,
    sourceSnapshot: {
      candidateProfile: {
        id: "profile-java-fullstack",
        revision: 1,
        sourceResumeFingerprint: "resume-java-fullstack"
      },
      targetRole: {
        title: "Java React Full Stack Engineer",
        family: "fullstack",
        source: "declared"
      },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Prioritize Java, Spring Boot, and React.",
    sessions: INTERVIEW_SESSION_KINDS.map(blueprint)
  };
}

function historyItem(
  templateId: string | undefined,
  overrides: Partial<InterviewHistoryItem> = {}
): InterviewHistoryItem {
  return {
    sessionId: `session-${templateId ?? "legacy"}`,
    status: "in_progress",
    setup: {
      role: "fullstack",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "",
      templateId,
      templateTitle: templateId === undefined ? "DSA practice interview" : undefined
    },
    startedAt: 100,
    updatedAt: 100,
    durationMs: 1_000,
    questionCount: 3,
    questionsCovered: 1,
    answerCount: 1,
    ...overrides
  };
}

describe("personalized interview roadmap sessions", () => {
  it("shows DSA and Resume & Behavioral while preserving the personalized technical sessions", () => {
    const sessions = interviewRoadmapSessions({
      personalizedPlan: plan(),
      roadmap: null,
      history: []
    });

    expect(sessions.map((session) => session.id)).toEqual([
      "frontend-dsa",
      "blueprint-core-technical",
      "blueprint-applied-engineering",
      "blueprint-architecture-system-design",
      "resume-behavioral-defense",
      "blueprint-final-mock"
    ]);
    expect(sessions.map((session) => session.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sessions.map((session) => session.title)).toEqual([
      "DSA · Java",
      "React & Frontend Engineering",
      "Java & Spring Boot",
      "Full Stack System Design",
      "Resume & Behavioral Defense",
      "Full Stack Mock"
    ]);

    expect(roadmapSessionHref(sessions[0]!)).toBe("/interview/dsa");
    expect(roadmapSessionHref(sessions[4]!)).toBe("/interview/resume");
    expect(roadmapSessionHref(sessions[5]!)).toBe(
      "/interview?plan=plan-java-fullstack&blueprint=blueprint-final-mock"
    );
  });

  it("uses dedicated DSA and resume history to restore their visible progress", () => {
    const sessions = interviewRoadmapSessions({
      personalizedPlan: plan(),
      roadmap: null,
      history: [
        historyItem(undefined),
        historyItem("frontend-dsa", {
          sessionId: "new-dsa-session",
          updatedAt: 200,
          questionsCovered: 2
        }),
        historyItem("resume-behavioral-defense", {
          status: "completed",
          questionCount: 8,
          questionsCovered: 8
        })
      ]
    });

    expect(sessions[0]).toMatchObject({
      totalQuestions: 3,
      completedQuestions: 2,
      progressPercent: 67
    });
    expect(sessions[4]).toMatchObject({
      totalQuestions: 8,
      completedQuestions: 8,
      progressPercent: 100
    });
  });

  it("preserves completion by stable kind when adaptation creates new blueprint ids", () => {
    const regenerated = plan();
    regenerated.id = "plan-java-fullstack-revision-2";
    regenerated.revision = 2;
    regenerated.sessions = regenerated.sessions.map((session) => ({
      ...session,
      id: `revision-2-${session.kind}`
    }));
    const oldCoreBlueprint = {
      ...blueprint("core-technical", 1),
      id: "revision-1-core-technical"
    };

    const sessions = interviewRoadmapSessions({
      personalizedPlan: regenerated,
      roadmap: null,
      history: [
        historyItem(oldCoreBlueprint.id, {
          status: "completed",
          questionCount: 4,
          questionsCovered: 4,
          setup: {
            role: "fullstack",
            level: "3-5",
            roundType: "technical",
            intensity: "realistic",
            context: "",
            templateId: oldCoreBlueprint.id,
            personalizedPlanId: "plan-java-fullstack-revision-1",
            personalizedBlueprint: oldCoreBlueprint
          }
        })
      ]
    });
    const core = sessions.find((session) => session.kind === "core-technical");

    expect(core).toMatchObject({
      id: "revision-2-core-technical",
      progressPercent: 100,
      attemptStatus: "completed",
      updatedPracticeAvailable: true
    });
    expect(roadmapSessionHref(core!)).toBe(
      "/interview?plan=plan-java-fullstack-revision-2&blueprint=revision-2-core-technical"
    );
  });

  it("resumes an in-progress stable slot even after its plan is superseded", () => {
    const regenerated = plan();
    regenerated.id = "plan-java-fullstack-revision-2";
    regenerated.sessions = regenerated.sessions.map((session) => ({
      ...session,
      id: `revision-2-${session.kind}`
    }));
    const oldAppliedBlueprint = {
      ...blueprint("applied-engineering", 2),
      id: "revision-1-applied-engineering"
    };

    const sessions = interviewRoadmapSessions({
      personalizedPlan: regenerated,
      roadmap: null,
      history: [
        historyItem(oldAppliedBlueprint.id, {
          sessionId: "live-old-plan-session",
          status: "in_progress",
          questionCount: 4,
          questionsCovered: 2,
          setup: {
            role: "fullstack",
            level: "3-5",
            roundType: "technical",
            intensity: "realistic",
            context: "",
            templateId: oldAppliedBlueprint.id,
            personalizedPlanId: "plan-java-fullstack-revision-1",
            personalizedBlueprint: oldAppliedBlueprint
          }
        })
      ]
    });
    const applied = sessions.find((session) => session.kind === "applied-engineering");

    expect(applied).toMatchObject({
      progressPercent: 50,
      attemptStatus: "in_progress",
      resumeSessionId: "live-old-plan-session"
    });
    expect(roadmapSessionHref(applied!)).toBe(
      "/interview/voice?session=live-old-plan-session"
    );
  });
});
