import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  requireOnboardedProfile: vi.fn(),
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
  logError: vi.fn()
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));

// The page reads three services. Mocking only `home` made every test throw
// inside Promise.all before reaching its assertion.
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    practiceRoadmapService: { home: mocks.home, activity: mocks.activity },
    interviewService: { insights: mocks.insights },
    dsaService: { fullPlan: mocks.fullPlan },
    frontendRoadmapService: { questionStatuses: mocks.questionStatuses },
    practiceEvidenceStore: { refresh: mocks.practiceEvidence },
    coreTechnicalEligibilityService: { forProfile: mocks.coreTechnicalEligibility },
    coreTechnicalPracticeService: { current: mocks.coreTechnicalCurrent },
    coreTechnicalWorkspaceAnalyticsService: { practice: mocks.coreTechnicalAnalytics },
    appliedEngineeringEligibilityService: { forProfile: mocks.appliedEngineeringEligibility },
    appliedEngineeringPracticeService: { current: mocks.appliedEngineeringCurrent },
    appliedEngineeringWorkspaceAnalyticsService: { practice: mocks.appliedEngineeringAnalytics },
    architectureDesign: {
      eligibility: { forProfile: mocks.architectureDesignEligibility },
      practice: { current: mocks.architectureDesignCurrent },
      workspaceAnalytics: { practice: mocks.architectureDesignAnalytics }
    }
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
    mocks.insights.mockResolvedValue(null);
    mocks.activity.mockResolvedValue([]);
    mocks.fullPlan.mockResolvedValue(null);
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
  });

  it("does not reach the Practice generator when the onboarding guard rejects access", async () => {
    mocks.requireOnboardedProfile.mockRejectedValue(new Error("NEXT_REDIRECT:/"));

    await expect(PracticePage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.home).not.toHaveBeenCalled();
  });

  it("shows a recoverable error state without claiming saved progress was lost", async () => {
    mocks.requireOnboardedProfile.mockResolvedValue({
      userId: "user-1",
      ownerId: "owner-1",
      profile: { resume: { fullName: "Asha Verma" } } as CandidateProfile
    });
    mocks.home.mockRejectedValue(new Error("temporary database error"));

    render(await PracticePage());

    expect(screen.getByRole("alert").textContent).toContain(
      "We couldn’t prepare your practice path"
    );
    expect(screen.getByRole("alert").textContent).toContain("Your saved progress is safe");
    expect(mocks.home).toHaveBeenCalledWith("owner-1");
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "practice.roadmap_generation_failed",
      ownerId: "owner-1",
      reason: "temporary database error"
    });
  });

  it("keeps a disabled Architecture card visible when Architecture reads fail", async () => {
    mocks.requireOnboardedProfile.mockResolvedValue({
      userId: "user-1",
      ownerId: "owner-1",
      profile: { resume: { fullName: "Asha Verma" } } as CandidateProfile
    });
    mocks.home.mockResolvedValue(practiceRoadmap());
    mocks.architectureDesignEligibility.mockRejectedValue(new Error("temporary failure"));
    mocks.architectureDesignCurrent.mockRejectedValue(new Error("temporary failure"));
    mocks.architectureDesignAnalytics.mockRejectedValue(new Error("temporary failure"));

    render(await PracticePage());

    expect(screen.getByRole("link", { name: /DSA.*Start session/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Architecture & Design" })).toBeInTheDocument();
    expect(
      screen.getByText("The reviewed Architecture & Design scenario path is not available yet.")
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Architecture & Design/i })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

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
