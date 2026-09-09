import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PracticeRoadmapHome } from "@/features/practice/shared/domain/practice-roadmap";
import type { DsaRecommendation } from "@/features/practice/dsa/domain/dsa-recommendation";
import { PracticeSessionsView } from "./practice-sessions-view";

const practiceRoadmap: PracticeRoadmapHome = {
  roadmapId: "roadmap-1",
  title: "Practice roadmap",
  generationVersion: 2,
  generatedAt: 1,
  sourcePlan: {
    id: "plan-1",
    revision: 1,
    profileVersionId: "profile-1",
    profileRevision: 1
  },
  sessions: [["dsa", "DSA · Arrays", "available", "/practice/dsa", 200]].map(
    ([key, title, availability, href, totalQuestions], index) => ({
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
    })
  ) as PracticeRoadmapHome["sessions"]
};

describe("PracticeSessionsView", () => {
  afterEach(cleanup);
  it("renders only the preserved DSA Practice session", () => {
    render(<PracticeSessionsView practiceRoadmap={practiceRoadmap} />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.queryByText(/readiness/i)).toBeNull();
    expect(
      screen.getByRole("link", { name: /DSA · Arrays.*Start session/i }).getAttribute("href")
    ).toBe("/practice/dsa");
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(
      screen.getByText("Your weekly rhythm starts with one solved question.")
    ).toBeInTheDocument();
    expect(screen.getByText("Start your practice momentum")).toBeInTheDocument();
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
    expect(
      screen.getByText(
        "0/8 current block · 2 hr. Finish this focused set to unlock your next adaptive block."
      )
    ).toBeInTheDocument();
  });

  it("adds Core Technical only when the server supplies an eligible or resumable entry", () => {
    render(
      <PracticeSessionsView
        practiceRoadmap={practiceRoadmap}
        coreTechnicalEntry={{
          key: "core-technical",
          order: 2,
          title: "Core Technical · Node.js",
          purpose: "Trace one realistic Node.js incident through connected interview questions.",
          covers: ["Async scheduling", "Production debugging"],
          difficulty: "adaptive",
          durationMinutes: 45,
          availability: "available",
          status: "ACTIVE",
          totalQuestions: 8,
          attemptedQuestions: 0,
          completedQuestions: 0,
          progressPercent: 0,
          href: "/practice/core-technical"
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /Core Technical · Node\.js.*Start session/i })
    ).toHaveAttribute("href", "/practice/core-technical");
    expect(screen.getByRole("link", { name: /DSA · Arrays.*Start session/i })).toHaveAttribute(
      "href",
      "/practice/dsa"
    );
  });

  it("includes historical Core Technical questions in the existing Practice totals", () => {
    render(
      <PracticeSessionsView
        practiceRoadmap={practiceRoadmap}
        activity={[
          { date: "2026-08-28", solved: 0 },
          { date: "2026-08-29", solved: 2 }
        ]}
        coreTechnicalTotals={{ totalQuestions: 16, completedQuestions: 2 }}
      />
    );

    expect(
      screen.getByText(/You’ve solved 2 questions so far\. 214 questions are waiting/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /2 questions solved in the last 2 days/i })
    ).toBeInTheDocument();
  });

  it("adds Applied Engineering after Core Technical at order three", () => {
    render(
      <PracticeSessionsView
        practiceRoadmap={practiceRoadmap}
        appliedEngineeringEntry={{
          key: "applied-engineering",
          order: 3,
          title: "Applied Engineering · Node.js",
          purpose: "Diagnose a production incident.",
          covers: ["Evidence selection", "Safe delivery"],
          difficulty: "adaptive",
          durationMinutes: 50,
          availability: "available",
          status: "ACTIVE",
          totalQuestions: 8,
          attemptedQuestions: 0,
          completedQuestions: 0,
          progressPercent: 0,
          href: "/practice/applied-engineering"
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /Applied Engineering · Node\.js.*Start session/i })
    ).toHaveAttribute("href", "/practice/applied-engineering");
  });

  it("adds Architecture & Design as the order-four non-executable session", () => {
    render(
      <PracticeSessionsView
        practiceRoadmap={practiceRoadmap}
        architectureDesignEntry={{
          key: "architecture-design",
          order: 4,
          title: "Architecture & Design",
          purpose: "Defend a role-aligned system design.",
          covers: ["Requirements", "Reliability", "Trade-offs"],
          difficulty: "adaptive",
          durationMinutes: 45,
          availability: "available",
          status: "ACTIVE",
          totalQuestions: 4,
          attemptedQuestions: 0,
          completedQuestions: 0,
          progressPercent: 0,
          href: "/practice/architecture-design"
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /Architecture & Design.*Start session/i })
    ).toHaveAttribute("href", "/practice/architecture-design");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map(({ textContent }) => textContent)
    ).toEqual(["DSA · Arrays", "Architecture & Design"]);
  });

  it("keeps Architecture & Design discoverable when reviewed scenarios are unavailable", () => {
    render(
      <PracticeSessionsView
        practiceRoadmap={practiceRoadmap}
        architectureDesignEntry={{
          key: "architecture-design",
          order: 4,
          title: "Architecture & Design",
          purpose: "Design a role-aligned system.",
          covers: ["Requirements", "Reliability", "Trade-offs"],
          difficulty: "adaptive",
          durationMinutes: 45,
          availability: "unavailable",
          availabilityLabel: "Two reviewed scenarios must be published before this opens.",
          status: "LOCKED",
          totalQuestions: 4,
          attemptedQuestions: 0,
          completedQuestions: 0,
          progressPercent: 0,
          href: null
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Architecture & Design" })).toBeInTheDocument();
    expect(
      screen.getByText("Two reviewed scenarios must be published before this opens.")
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Architecture & Design/i })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.queryByRole("link", { name: /Architecture & Design/i })).toBeNull();
  });
});
