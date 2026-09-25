import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  readSummary: vi.fn(),
  buildCandidateAnalytics: vi.fn()
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    candidateAnalyticsSnapshotStore: { readSummary: mocks.readSummary }
  })
}));

vi.mock("@/features/analytics/server/candidate-analytics-loader", () => ({
  buildCandidateAnalytics: mocks.buildCandidateAnalytics
}));

import { loadDashboardOverview } from "./load-dashboard-overview";

const profile = { onboardingCompletedAt: 1 } as CandidateProfile;
const overview = { coaching: { state: "practice-started" } };

describe("loadDashboardOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSummary.mockResolvedValue({ dashboard: overview });
  });

  it("reads the prepared candidate summary for Overview", async () => {
    await expect(loadDashboardOverview({ ownerId: "owner-1", profile, now: 1_000 })).resolves.toBe(
      overview
    );
    expect(mocks.readSummary).toHaveBeenCalledWith("owner-1", expect.any(Function));
  });

  it("passes the current profile to a rebuild after invalidation", async () => {
    await loadDashboardOverview({ ownerId: "owner-1", profile, now: 2_000 });
    const build = mocks.readSummary.mock.calls[0]?.[1] as () => Promise<unknown>;
    await build();
    expect(mocks.buildCandidateAnalytics).toHaveBeenCalledWith("owner-1", profile, 2_000);
  });
});
