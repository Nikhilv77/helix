import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  rounds: vi.fn(),
  reportsOverview: vi.fn(),
  dashboard: vi.fn(),
  practice: vi.fn(),
  dashboardOverview: vi.fn(),
  mergeDashboardPractice: vi.fn(),
  buildDashboardOverview: vi.fn()
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    coreTechnicalWorkspaceAnalyticsService: {
      rounds: mocks.rounds,
      practice: mocks.practice
    },
    interviewService: { reportsOverview: mocks.reportsOverview },
    progressService: { dashboard: mocks.dashboard },
    helpHistoryService: { dashboardOverview: mocks.dashboardOverview }
  })
}));

vi.mock("@/lib/practice/core-technical/workspace-analytics", () => ({
  mergeDashboardPractice: mocks.mergeDashboardPractice
}));

vi.mock("@/features/dashboard/application/build-dashboard-overview", () => ({
  buildDashboardOverview: mocks.buildDashboardOverview
}));

import { loadDashboardOverview } from "./load-dashboard-overview";

const profile = { onboardingCompletedAt: 1 } as CandidateProfile;
const overview = { coaching: { state: "practice-started" } };

describe("loadDashboardOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildDashboardOverview.mockReturnValue(overview);
  });

  it("loads independent sources in parallel and merges Core Technical practice", async () => {
    const reports = { rounds: [] };
    const practice = { totals: { completedQuestions: 1 } };
    const corePractice = { completedQuestions: 2 };
    const combinedPractice = { totals: { completedQuestions: 3 } };
    const trailmate = { peopleHelped: 1 };
    mocks.rounds.mockResolvedValue({ history: [], reports: ["core-report"] });
    mocks.reportsOverview.mockResolvedValue(reports);
    mocks.dashboard.mockResolvedValue(practice);
    mocks.practice.mockResolvedValue(corePractice);
    mocks.dashboardOverview.mockResolvedValue(trailmate);
    mocks.mergeDashboardPractice.mockReturnValue(combinedPractice);

    await expect(loadDashboardOverview({ ownerId: "owner-1", profile, now: 1_000 })).resolves.toBe(
      overview
    );

    expect(mocks.rounds).toHaveBeenCalledWith("owner-1");
    expect(mocks.reportsOverview).toHaveBeenCalledWith("owner-1", 50, 1_000, ["core-report"]);
    expect(mocks.dashboard).toHaveBeenCalledWith("owner-1");
    expect(mocks.practice).toHaveBeenCalledWith("owner-1", 126);
    expect(mocks.dashboardOverview).toHaveBeenCalledWith("owner-1");
    expect(mocks.mergeDashboardPractice).toHaveBeenCalledWith(practice, corePractice);
    expect(mocks.buildDashboardOverview).toHaveBeenCalledWith(
      profile,
      reports,
      combinedPractice,
      1_000,
      trailmate
    );
  });

  it("isolates one failed source while retaining the others", async () => {
    const reports = { rounds: [] };
    const corePractice = { completedQuestions: 2 };
    const combinedPractice = { totals: { completedQuestions: 2 } };
    const trailmate = { peopleHelped: 1 };
    mocks.rounds.mockRejectedValue(new Error("rounds unavailable"));
    mocks.reportsOverview.mockResolvedValue(reports);
    mocks.dashboard.mockRejectedValue(new Error("progress unavailable"));
    mocks.practice.mockResolvedValue(corePractice);
    mocks.dashboardOverview.mockResolvedValue(trailmate);
    mocks.mergeDashboardPractice.mockReturnValue(combinedPractice);

    await loadDashboardOverview({ ownerId: "owner-1", profile, now: 2_000 });

    expect(mocks.reportsOverview).toHaveBeenCalledWith("owner-1", 50, 2_000, []);
    expect(mocks.mergeDashboardPractice).toHaveBeenCalledWith(null, corePractice);
    expect(mocks.buildDashboardOverview).toHaveBeenCalledWith(
      profile,
      reports,
      combinedPractice,
      2_000,
      trailmate
    );
  });

  it("builds the unavailable-state projection when every source fails", async () => {
    mocks.rounds.mockRejectedValue(new Error("rounds unavailable"));
    mocks.reportsOverview.mockRejectedValue(new Error("reports unavailable"));
    mocks.dashboard.mockRejectedValue(new Error("progress unavailable"));
    mocks.practice.mockRejectedValue(new Error("core practice unavailable"));
    mocks.dashboardOverview.mockRejectedValue(new Error("trailmate unavailable"));

    await expect(loadDashboardOverview({ ownerId: "owner-1", profile, now: 3_000 })).resolves.toBe(
      overview
    );

    expect(mocks.mergeDashboardPractice).not.toHaveBeenCalled();
    expect(mocks.buildDashboardOverview).toHaveBeenCalledWith(profile, null, null, 3_000, null);
  });
});
