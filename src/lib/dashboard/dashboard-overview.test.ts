import { describe, expect, it } from "vitest";
import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressOverview } from "@/lib/roadmap/progress";
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
    readinessScore: null,
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
  lastActiveAt = null
}: {
  completed?: number;
  attempts?: number;
  solvedThisWeek?: number;
  lastActiveAt?: number | null;
} = {}): ProgressOverview {
  return {
    totals: {
      completedQuestions: completed,
      totalAttempts: attempts,
      solvedThisWeek
    },
    streak: { lastActiveAt },
    nextUp: {
      title: "Evaluate retrieval quality",
      href: "/dsa-questions/evaluate-retrieval"
    }
  } as ProgressOverview;
}

const latestInterview = {
  status: "completed",
  recommendedFocus: "Measurement specificity",
  strongest: "Architecture",
  nextStep: "Name the metric, threshold, and production decision it changes",
  href: "/sessions/session-1"
} as ReportsOverview["latest"];

describe("buildDashboardOverview", () => {
  it("uses resume priorities only when both evidence sources confirm no activity", () => {
    const result = buildDashboardOverview(profile, reports(), practice(), NOW);

    expect(result.coaching.state).toBe("resume-priority");
    expect(result.coaching.title).toContain("RAG evaluation and System design");
    expect(result.coaching.body).toContain("not a measured weakness yet");
    expect(result.readiness.status).toBe("forming");
  });

  it("prioritizes resuming an interview that is still open", () => {
    const result = buildDashboardOverview(
      profile,
      reports({
        rounds: [{ status: "in_progress", href: "/interview/voice?session=open" }] as ReportsOverview["rounds"]
      }),
      practice({ completed: 4, attempts: 5 }),
      NOW
    );

    expect(result.coaching.state).toBe("interview-in-progress");
    expect(result.coaching.actionHref).toContain("session=open");
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
