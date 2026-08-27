import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PracticeRoadmapHome } from "@/lib/practice/practice-roadmap";
import type { CandidateProfile } from "@/lib/shared/types";
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
    ["frontend-dsa", "DSA · Arrays", "available", "/practice/dsa", 200],
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
    render(
      <PracticeSessionsView
        profile={{ resume: { fullName: "Asha Verma" } } as CandidateProfile}
        practiceRoadmap={practiceRoadmap}
      />
    );

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(
      screen.getByRole("link", { name: /DSA · Arrays.*Start session/i }).getAttribute("href")
    ).toBe("/practice/dsa");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getAllByText("Coming soon")).toHaveLength(5);
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

    render(
      <PracticeSessionsView
        profile={{ resume: { fullName: "Asha Verma" } } as CandidateProfile}
        practiceRoadmap={launched}
      />
    );

    expect(screen.getAllByText("Start session")).toHaveLength(6);
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Final Mock.*Start session/i }).getAttribute("href")
    ).toBe("/practice/final-mock");
  });
});
