import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PracticeRoadmapHome } from "@/lib/practice/practice-roadmap";
import type { DsaRecommendation } from "@/lib/practice/dsa-recommendation";
import { PracticeSessionsView } from "./practice-sessions-view";

const practiceRoadmap: PracticeRoadmapHome = {
  roadmapId: "roadmap-1",
  title: "Practice roadmap",
  generationVersion: 1,
  generatedAt: 1,
  sourcePlan: {
    id: "plan-1",
    revision: 1,
    profileVersionId: "profile-1",
    profileRevision: 1
  },
  sessions: [
    ["dsa", "DSA · Arrays", "available", "/practice/dsa", 200],
    ["core-technical", "JavaScript & React", "unavailable", null, 0],
    ["applied-engineering", "Applied Engineering", "unavailable", null, 0],
    ["architecture-system-design", "Architecture", "unavailable", null, 0],
    ["resume-behavioral-defense", "Resume Defense", "unavailable", null, 0],
    ["final-mock", "Final Mock", "unavailable", null, 0]
  ].map(([key, title, availability, href, totalQuestions], index) => ({
    key,
    order: index + 1,
    title,
    purpose: `Purpose ${index + 1}`,
    covers: [`Topic ${index + 1}`],
    difficulty: "adaptive",
    durationMinutes: 20,
    sourceBlueprintId: null,
    sourceBlueprintKind: null,
    availability,
    status: index === 0 ? "ACTIVE" : "LOCKED",
    totalQuestions,
    attemptedQuestions: 0,
    completedQuestions: 0,
    progressPercent: 0,
    href
  })) as PracticeRoadmapHome["sessions"]
};

describe("PracticeSessionsView", () => {
  afterEach(cleanup);
  it("renders the same six-slot roadmap shape while only enabling an implemented bank", () => {
    render(<PracticeSessionsView practiceRoadmap={practiceRoadmap} />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(screen.queryByText(/readiness/i)).toBeNull();
    expect(
      screen.getByRole("link", { name: /DSA · Arrays.*Start session/i }).getAttribute("href")
    ).toBe("/practice/dsa");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getAllByText("Coming soon")).toHaveLength(5);
    expect(
      screen.getByText("Your weekly rhythm starts with one solved question.")
    ).toBeInTheDocument();
    expect(screen.getByText("Start your practice momentum")).toBeInTheDocument();
  });

  it("enables every published Part 4 workspace when the service supplies its href", () => {
    const launched = {
      ...practiceRoadmap,
      sessions: practiceRoadmap.sessions.map((session) => ({
        ...session,
        availability: "available" as const,
        totalQuestions: session.totalQuestions || 12,
        href: session.href ?? `/practice/${session.key}`
      }))
    };

    render(<PracticeSessionsView practiceRoadmap={launched} />);

    expect(screen.getAllByText("Start session")).toHaveLength(6);
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Final Mock.*Start session/i }).getAttribute("href")
    ).toBe("/practice/final-mock");
  });

  it("switches from the first-time message to the weekly chart after the first solve", () => {
    const started = {
      ...practiceRoadmap,
      sessions: practiceRoadmap.sessions.map((session, index) =>
        index === 0 ? { ...session, completedQuestions: 1, progressPercent: 1 } : session
      )
    };

    render(
      <PracticeSessionsView
        practiceRoadmap={started}
        activity={[
          { date: "2026-08-23", solved: 0 },
          { date: "2026-08-24", solved: 0 },
          { date: "2026-08-25", solved: 0 },
          { date: "2026-08-26", solved: 0 },
          { date: "2026-08-27", solved: 0 },
          { date: "2026-08-28", solved: 0 },
          { date: "2026-08-29", solved: 1 }
        ]}
      />
    );

    expect(
      screen.getByRole("img", { name: /1 question solved in the last 7 days/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Your weekly rhythm starts with one solved question.")).toBeNull();
  });

  it("uses the adaptive DSA block for the target, strength, and priority cards", () => {
    const recommendation = {
      tier: "building",
      source: "performance",
      targetLabel: "Full Stack mid-level",
      focusChapterId: "arrays-hashing",
      focusLabel: "Arrays & Hashing",
      strengthLabel: "Trees",
      blockTitle: "Arrays & Hashing focus block",
      rationale: "Verified solutions show this is the clearest gap.",
      questions: [],
      minutes: 75,
      mix: { easy: 2, medium: 5, hard: 1 },
      estimatedPathQuestions: 72,
      availableQuestions: 200
    } satisfies DsaRecommendation;

    render(
      <PracticeSessionsView practiceRoadmap={practiceRoadmap} dsaRecommendation={recommendation} />
    );

    expect(screen.getByText("Arrays & Hashing block")).toBeInTheDocument();
    expect(screen.getByText("Trees is a strength")).toBeInTheDocument();
    expect(screen.getByText("Why Arrays & Hashing")).toBeInTheDocument();
  });

  it("separates overall DSA solves from progress inside the current block", () => {
    const started = {
      ...practiceRoadmap,
      sessions: practiceRoadmap.sessions.map((session, index) =>
        index === 0 ? { ...session, completedQuestions: 1, progressPercent: 1 } : session
      )
    };
    const recommendation = {
      tier: "building",
      source: "performance",
      targetLabel: "Full Stack mid-level",
      focusChapterId: "arrays-hashing",
      focusLabel: "Arrays & Hashing",
      strengthLabel: null,
      blockTitle: "Arrays & Hashing",
      rationale: "This is the clearest next step.",
      questions: Array.from({ length: 8 }, (_, index) => ({ slug: `block-${index + 1}` })),
      minutes: 120,
      mix: { easy: 2, medium: 5, hard: 1 },
      estimatedPathQuestions: 72,
      availableQuestions: 200
    } as unknown as DsaRecommendation;

    render(
      <PracticeSessionsView
        practiceRoadmap={started}
        dsaRecommendation={recommendation}
        dsaBlockCompletedQuestions={0}
      />
    );

    expect(screen.getByText("1 solved overall · 0/8 current block")).toBeInTheDocument();
    expect(screen.getByText("0/8 current block · 2 hr")).toBeInTheDocument();
  });
});
