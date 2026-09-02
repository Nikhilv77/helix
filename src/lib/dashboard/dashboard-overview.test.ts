import { describe, expect, it } from "vitest";
import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressOverview } from "@/lib/roadmap/progress";
import type { HelpDashboardOverview } from "@/lib/help/help-history";
import type { CandidateProfile } from "@/lib/shared/types";
import { buildDashboardOverview } from "./dashboard-overview";

const NOW = Date.UTC(2026, 7, 28, 12);

const profile = {
  focusAreas: ["RAG evaluation", "System design"],
  resume: {
    roadmap: [],
    practiceQuestions: [],
    skills: ["Python"]
  }
} as unknown as CandidateProfile;

function reports(overrides: Partial<ReportsOverview> = {}): ReportsOverview {
  return {
    totalRounds: 0,
    completedRounds: 0,
    readinessScore: null,
    latestScore: null,
    scoreDelta: null,
    scoredRounds: 0,
    inProgressRounds: 0,
    rounds: [],
    latest: null,
    recurringGaps: [],
    ...overrides
  } as ReportsOverview;
}

function practice({
  completed = 0,
  attempts = 0,
  solvedThisWeek = 0,
  lastActiveAt = null,
  activity = []
}: {
  completed?: number;
  attempts?: number;
  solvedThisWeek?: number;
  lastActiveAt?: number | null;
  activity?: ProgressOverview["activity"];
} = {}): ProgressOverview {
  return {
    hasRoadmap: true,
    totals: {
      totalQuestions: 20,
      completedQuestions: completed,
      attemptedQuestions: Math.max(completed, attempts > 0 ? 1 : 0),
      completionPercent: Math.round((completed / 20) * 100),
      totalAttempts: attempts,
      solvedThisWeek
    },
    streak: { lastActiveAt },
    activity,
    sessions: [],
    nextUp: {
      title: "Evaluate retrieval quality",
      href: "/dsa-questions/evaluate-retrieval",
      chapterTitle: "RAG evaluation",
      difficulty: "medium",
      minutes: 20
    }
  } as unknown as ProgressOverview;
}

const latestInterview = {
  status: "completed",
  roundType: "technical",
  recommendedFocus: "Measurement specificity",
  strongest: "Architecture",
  nextStep: "Name the metric, threshold, and production decision it changes",
  evidenceScore: 62,
  href: "/reports"
} as ReportsOverview["latest"];

describe("buildDashboardOverview", () => {
  it("uses resume priorities only when both evidence sources confirm no activity", () => {
    const result = buildDashboardOverview(profile, reports(), practice(), NOW);

    expect(result.coaching.state).toBe("resume-priority");
    expect(result.coaching.title).toContain("RAG evaluation and System design");
    expect(result.coaching.body).toContain("not a measured weakness yet");
    expect(result.readiness.status).toBe("forming");
    expect(result.continuation.practice).toMatchObject({
      state: "start",
      title: "Evaluate retrieval quality",
      actionHref: "/dsa-questions/evaluate-retrieval",
      teacherAdvice: expect.any(String)
    });
    expect(result.continuation.interviews).toMatchObject({
      state: "start",
      title: "Take your first interview.",
      actionHref: "/interviews"
    });
    expect(result.explore).toMatchObject({
      progress: { state: "empty", actionHref: "/progress" },
      reports: { state: "empty", actionHref: "/reports" },
      trailmate: { state: "unavailable", actionHref: "/trailmate" }
    });
    expect(result.direction).toMatchObject({
      rhythm: { state: "empty", solved: 0, attempts: 0, activeDays: 0 },
      focus: {
        state: "practice",
        title: "RAG evaluation",
        actionHref: "/dsa-questions/evaluate-retrieval"
      }
    });
  });

  it("prioritizes resuming an interview that is still open", () => {
    const result = buildDashboardOverview(
      profile,
      reports({
        rounds: [
          { status: "in_progress", href: "/interview/voice?session=open" }
        ] as ReportsOverview["rounds"]
      }),
      practice({ completed: 4, attempts: 5 }),
      NOW
    );

    expect(result.coaching.state).toBe("interview-in-progress");
    expect(result.coaching.actionHref).toContain("session=open");
    expect(result.continuation.interviews.state).toBe("resume");
    expect(result.continuation.interviews.actionHref).toContain("session=open");
  });

  it("combines the latest interview weakness with established practice momentum", () => {
    const result = buildDashboardOverview(
      profile,
      reports({
        scoredRounds: 1,
        latest: latestInterview,
        recurringGaps: [
          {
            label: "Measurement specificity",
            practiceHref: "/practice?focus=measurement"
          }
        ] as ReportsOverview["recurringGaps"]
      }),
      practice({ completed: 8, attempts: 10, solvedThisWeek: 3, lastActiveAt: NOW }),
      NOW
    );

    expect(result.coaching.state).toBe("interview-with-practice");
    expect(result.coaching.body).toContain("3 completed questions this week");
    expect(result.coaching.body).toContain("Maintain the pace");
    expect(result.coaching.actionHref).toBe("/practice?focus=measurement");
  });

  it("sends an interviewed candidate without completed practice into a focused block", () => {
    const result = buildDashboardOverview(
      profile,
      reports({ scoredRounds: 1, latest: latestInterview }),
      practice(),
      NOW
    );

    expect(result.coaching.state).toBe("interview-needs-practice");
    expect(result.coaching.title).toContain("Measurement specificity");
    expect(result.coaching.body).toContain("metric, threshold");
    expect(result.continuation.interviews).toMatchObject({
      state: "next",
      latestScore: 62,
      completedRounds: 0
    });
    expect(result.explore.reports).toMatchObject({
      state: "available",
      latestScore: 62,
      actionHref: "/reports"
    });
  });

  it("encourages practice-only momentum without inventing an interview weakness", () => {
    const result = buildDashboardOverview(
      profile,
      reports(),
      practice({ completed: 5, attempts: 7, solvedThisWeek: 2, lastActiveAt: NOW }),
      NOW
    );

    expect(result.coaching.state).toBe("practice-momentum");
    expect(result.coaching.title).toContain("rhythm");
    expect(result.coaching.body).toContain("take an interview");
    const adviceWords = result.continuation.practice.teacherAdvice.split(/\s+/);
    expect(adviceWords.length).toBeGreaterThanOrEqual(10);
    expect(adviceWords.length).toBeLessThanOrEqual(14);
    expect(result.continuation.practice.teacherAdvice).not.toMatch(/["“”]/);
    expect(result.explore.progress).toMatchObject({
      state: "active",
      completedQuestions: 5,
      progressPercent: 25
    });
    expect(result.explore.progress.recentActivity).toHaveLength(7);
  });

  it("surfaces an active Trailmate room without inventing community activity", () => {
    const trailmate = {
      helpReceived: 2,
      peopleHelped: 1,
      activeConversation: {
        requestId: "room-1",
        seat: "learner",
        slug: "two-sum",
        title: "Two Sum",
        language: "typescript",
        started: true,
        peer: { label: "Asha", headline: null, profileImage: null }
      }
    } as HelpDashboardOverview;

    const result = buildDashboardOverview(profile, reports(), practice(), NOW, trailmate);

    expect(result.explore.trailmate).toMatchObject({
      state: "active",
      title: "Continue with Asha.",
      actionLabel: "Resume room",
      actionHref: "/trailmate/room/room-1",
      peopleHelped: 1,
      helpReceived: 2
    });
  });

  it("turns the latest seven practice days and recurring gap into direction", () => {
    const result = buildDashboardOverview(
      profile,
      reports({
        recurringGaps: [
          {
            label: "Measurement specificity",
            occurrences: 2,
            averageScore: 48,
            nextStep: "Name the metric and threshold before explaining the decision",
            practiceHref: "/practice?focus=measurement"
          }
        ]
      }),
      practice({
        completed: 4,
        attempts: 6,
        activity: [
          { date: "2026-08-23", solved: 1, attempts: 2 },
          { date: "2026-08-26", solved: 2, attempts: 3 },
          { date: "2026-08-28", solved: 0, attempts: 1 }
        ]
      }),
      NOW
    );

    expect(result.direction.rhythm).toMatchObject({
      state: "active",
      solved: 3,
      attempts: 6,
      activeDays: 3
    });
    expect(result.direction.rhythm.days).toHaveLength(7);
    expect(result.direction.rhythm.days[1]).toMatchObject({
      date: "2026-08-23",
      label: "Sun",
      solved: 1,
      attempts: 2
    });
    expect(result.direction.focus).toMatchObject({
      state: "interview",
      title: "Measurement specificity",
      supportingLabel: "Seen across 2 scored rounds",
      actionHref: "/practice?focus=measurement"
    });
  });

  it("distinguishes attempts from actual question completion", () => {
    const result = buildDashboardOverview(
      profile,
      reports(),
      practice({ attempts: 3, lastActiveAt: NOW }),
      NOW
    );

    expect(result.coaching.state).toBe("practice-started");
    expect(result.coaching.body).toContain("no question is complete yet");
  });

  it("welcomes a returning learner without framing the break as failure", () => {
    const result = buildDashboardOverview(
      profile,
      reports(),
      practice({ completed: 6, attempts: 9, lastActiveAt: NOW - 9 * 86_400_000 }),
      NOW
    );

    expect(result.coaching.state).toBe("practice-returning");
    expect(result.coaching.body).toContain("no need to catch up all at once");
  });

  it("does not claim there is no evidence when the evidence reads failed", () => {
    const result = buildDashboardOverview(profile, null, null, NOW);

    expect(result.coaching.state).toBe("evidence-unavailable");
    expect(result.readiness.status).toBe("unavailable");
  });

  it("shows a real readiness score and change only from scored interviews", () => {
    const result = buildDashboardOverview(
      profile,
      reports({ readinessScore: 72, scoreDelta: 8, scoredRounds: 3, latest: latestInterview }),
      practice(),
      NOW
    );

    expect(result.readiness).toMatchObject({
      status: "scored",
      score: 72,
      delta: 8,
      label: "Developing"
    });
    expect(result.readiness.detail).toContain("3 most recent scored rounds");
  });
});
