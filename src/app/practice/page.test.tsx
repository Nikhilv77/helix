import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  profileGet: vi.fn(),
  home: vi.fn(),
  insights: vi.fn(),
  activity: vi.fn(),
  fullPlan: vi.fn(),
  questionStatuses: vi.fn(),
  practiceEvidence: vi.fn(),
  coreTechnicalEligibility: vi.fn(),
  coreTechnicalCurrent: vi.fn(),
  coreTechnicalAnalytics: vi.fn(),
  appliedEngineeringEligibility: vi.fn(),
  appliedEngineeringCurrent: vi.fn(),
  appliedEngineeringAnalytics: vi.fn(),
  architectureDesignEligibility: vi.fn(),
  architectureDesignCurrent: vi.fn(),
  architectureDesignAnalytics: vi.fn(),
  aiMlSummaries: vi.fn(),
  cachedPersonalizedPlan: vi.fn(),
  dsaCurrentBlock: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user-1" })
}));

vi.mock("@/features/interviews/server/owner", () => ({
  authenticatedOwnerId: () => "owner-1"
}));

vi.mock("@/server/auth/request-user", () => ({
  getUserIdForRequest: async () => "user-1"
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }
}));

vi.mock("@/features/interviews/server/cached-personalized-plan", () => ({
  cachedPersonalizedPlan: mocks.cachedPersonalizedPlan
}));

// The page reads three services. Mocking only `home` made every test throw
// inside Promise.all before reaching its assertion.
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    profileService: { get: mocks.profileGet },
    practiceHomeSnapshotStore: {
      readOrBuild: async (_ownerId: string, build: () => Promise<{ view: { props: unknown } }>) =>
        (await build()).view.props
    },
    practiceRoadmapService: { home: mocks.home, activity: mocks.activity },
    interviewService: { insights: mocks.insights },
    dsaService: { fullPlan: mocks.fullPlan },
    dsaPracticeBlockStore: { currentWithReadiness: mocks.dsaCurrentBlock },
    frontendRoadmapService: { questionStatuses: mocks.questionStatuses },
    practiceEvidenceStore: { refresh: mocks.practiceEvidence },
    coreTechnicalEligibilityService: { forProfile: mocks.coreTechnicalEligibility },
    coreTechnicalPracticeService: { currentEntryBlock: mocks.coreTechnicalCurrent },
    coreTechnicalWorkspaceAnalyticsService: { entrySummary: mocks.coreTechnicalAnalytics },
    appliedEngineeringEligibilityService: { forProfile: mocks.appliedEngineeringEligibility },
    appliedEngineeringPracticeService: { currentEntryBlock: mocks.appliedEngineeringCurrent },
    appliedEngineeringWorkspaceAnalyticsService: {
      entrySummary: mocks.appliedEngineeringAnalytics
    },
    architectureDesign: {
      eligibility: { forProfile: mocks.architectureDesignEligibility },
      practice: { currentEntryBlock: mocks.architectureDesignCurrent },
      workspaceAnalytics: { entrySummary: mocks.architectureDesignAnalytics }
    },
    aiMlPracticeService: { summaries: mocks.aiMlSummaries }
  })
}));

vi.mock("@/server/common/logger", () => ({
  Logger: class {
    error = mocks.logError;
  }
}));

import PracticePage from "./page";

describe("PracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileGet.mockResolvedValue(onboardedProfile());
    mocks.insights.mockResolvedValue(null);
    mocks.activity.mockResolvedValue([]);
    mocks.fullPlan.mockResolvedValue(null);
    mocks.cachedPersonalizedPlan.mockResolvedValue({ id: "plan-1" });
    mocks.dsaCurrentBlock.mockResolvedValue(null);
    mocks.questionStatuses.mockResolvedValue({});
    mocks.practiceEvidence.mockResolvedValue(null);
    mocks.coreTechnicalEligibility.mockResolvedValue({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      message: "Not published",
      stack: { language: "javascript", runtime: "nodejs", runtimeVersion: "22 LTS" },
      requiredStoryCount: 2,
      publishedStoryCount: 0,
      stories: []
    });
    mocks.coreTechnicalCurrent.mockResolvedValue(null);
    mocks.coreTechnicalAnalytics.mockResolvedValue(null);
    mocks.appliedEngineeringEligibility.mockResolvedValue({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      message: "Not published",
      stack: { language: "javascript", runtime: "nodejs", runtimeVersion: "22 LTS" },
      requiredIncidentCount: 2,
      publishedIncidentCount: 0,
      incidents: []
    });
    mocks.appliedEngineeringCurrent.mockResolvedValue(null);
    mocks.appliedEngineeringAnalytics.mockResolvedValue(null);
    mocks.architectureDesignEligibility.mockResolvedValue({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      message: "Not published",
      requiredScenarioCount: 2,
      publishedScenarioCount: 0,
      scenarios: []
    });
    mocks.architectureDesignCurrent.mockResolvedValue(null);
    mocks.architectureDesignAnalytics.mockResolvedValue(null);
    mocks.aiMlSummaries.mockResolvedValue([]);
  });

  it("does not reach the Practice generator when the onboarding guard rejects access", async () => {
    mocks.profileGet.mockResolvedValue(onboardedProfile({ onboardingCompletedAt: null }));

    await expect(PracticePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(mocks.home).not.toHaveBeenCalled();
  });

  it("shows a recoverable error state without claiming saved progress was lost", async () => {
    mocks.home.mockRejectedValue(new Error("temporary database error"));

    render(await PracticePage());

    expect(screen.getByRole("alert").textContent).toContain(
      "We couldn’t prepare your practice path"
    );
    expect(screen.getByRole("alert").textContent).toContain("Your saved progress is safe");
    expect(mocks.home).toHaveBeenCalledWith(
      "owner-1",
      undefined,
      expect.anything(),
      expect.any(Promise),
      expect.any(Function)
    );
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "practice.roadmap_generation_failed",
      ownerId: "owner-1",
      reason: "temporary database error"
    });
  });

  it("keeps a disabled Architecture card visible when Architecture reads fail", async () => {
    mocks.home.mockResolvedValue(practiceRoadmap());
    mocks.architectureDesignEligibility.mockRejectedValue(new Error("temporary failure"));
    mocks.architectureDesignCurrent.mockRejectedValue(new Error("temporary failure"));
    mocks.architectureDesignAnalytics.mockRejectedValue(new Error("temporary failure"));

    render(await PracticePage());

    expect(screen.getByRole("link", { name: /DSA.*Start session/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Architecture & Design" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Architecture & Design availability could not be checked. Please refresh the page."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Architecture & Design/i })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("shows the three AI/ML sessions and hides DSA", async () => {
    mocks.profileGet.mockResolvedValue(onboardedProfile({ targetRole: "ai-ml", level: "0-2" }));
    mocks.home.mockResolvedValue(practiceRoadmap());

    render(await PracticePage());

    expect(screen.queryByRole("heading", { name: "DSA" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Core Technical · AI/ML" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Applied Engineering · AI/ML" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Architecture & Design · AI/ML" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /Architecture & Design · AI\/ML/i })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("links AI/ML Architecture when a reviewed scenario is available", async () => {
    mocks.profileGet.mockResolvedValue(onboardedProfile({ targetRole: "ai-ml" }));
    mocks.home.mockResolvedValue(practiceRoadmap());
    mocks.architectureDesignEligibility.mockResolvedValue({ available: true });

    render(await PracticePage());

    expect(screen.getByRole("link", { name: /Architecture & Design · AI\/ML/i })).toHaveAttribute(
      "href",
      "/practice/architecture-design"
    );
  });

  it.each([
    ["frontend", "Frontend"],
    ["data", "Data"]
  ] as const)("shows DSA plus the %s story tracks and no Node.js tracks", async (role, label) => {
    mocks.profileGet.mockResolvedValue(onboardedProfile({ targetRole: role }));
    mocks.home.mockResolvedValue(practiceRoadmap());

    render(await PracticePage());

    expect(screen.getByRole("heading", { name: "DSA" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(`Core Technical · ${label}`) })
    ).toHaveAttribute("href", `/practice/${role}/core-technical`);
    expect(
      screen.getByRole("link", { name: new RegExp(`Applied Engineering · ${label}`) })
    ).toHaveAttribute("href", `/practice/${role}/applied-engineering`);
    expect(mocks.aiMlSummaries).toHaveBeenCalledWith("owner-1", role);
    expect(screen.queryByRole("article", { name: /Architecture & Design/i })).toBeNull();
    expect(screen.queryByText(/Node\.js/)).toBeNull();
  });

  it("warns rather than silently claiming zero AI/ML progress when the database read fails", async () => {
    mocks.profileGet.mockResolvedValue(onboardedProfile({ targetRole: "ai-ml" }));
    mocks.home.mockResolvedValue(practiceRoadmap());
    mocks.aiMlSummaries.mockRejectedValue(new Error("temporary database error"));

    render(await PracticePage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your saved practice progress is temporarily unavailable"
    );
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "practice.story_progress_read_failed",
      discipline: "ai-ml",
      ownerId: "owner-1",
      reason: "temporary database error"
    });
  });
});

function onboardedProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    targetRole: "fullstack",
    level: "0-2",
    onboardingCompletedAt: 1,
    preparationOnboarding: { completedAt: 1 },
    resume: { fullName: "Asha Verma", projects: [], experience: [] },
    ...overrides
  } as CandidateProfile;
}

function practiceRoadmap() {
  return {
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
    sessions: [
      {
        key: "dsa",
        order: 1,
        title: "DSA",
        purpose: "Practice algorithms.",
        covers: ["Arrays"],
        difficulty: "adaptive",
        durationMinutes: 20,
        sourceBlueprintId: null,
        sourceBlueprintKind: null,
        availability: "available",
        status: "ACTIVE",
        totalQuestions: 1,
        attemptedQuestions: 0,
        completedQuestions: 0,
        progressPercent: 0,
        href: "/practice/dsa"
      }
    ]
  };
}
