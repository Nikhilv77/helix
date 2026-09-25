import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readOrBuild: vi.fn(),
  refreshAnalytics: vi.fn()
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    profileService: {
      get: async () => ({
        onboardingCompletedAt: 1,
        preparationOnboarding: { completedAt: 1 }
      })
    },
    practiceHomeSnapshotStore: { readOrBuild: mocks.readOrBuild }
  })
}));
vi.mock("@/features/analytics/server/refresh-candidate-analytics", () => ({
  refreshCandidateAnalytics: mocks.refreshAnalytics
}));
vi.mock("@/features/practice/shared/server/practice-home-loader", () => ({
  loadPracticeHomeView: vi.fn()
}));

import { refreshPracticeHome } from "./refresh-practice-home";

describe("refreshPracticeHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("folds writes that arrive during a rebuild into one trailing rebuild", async () => {
    let finishFirst!: () => void;
    mocks.readOrBuild
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockResolvedValue(undefined);

    const first = refreshPracticeHome("owner-1");
    await vi.waitFor(() => expect(mocks.readOrBuild).toHaveBeenCalledTimes(1));
    const second = refreshPracticeHome("owner-1");
    const third = refreshPracticeHome("owner-1");
    finishFirst();
    await Promise.all([first, second, third]);

    expect(mocks.readOrBuild).toHaveBeenCalledTimes(2);
    expect(mocks.refreshAnalytics).toHaveBeenCalledTimes(2);
  });

  it("rebuilds separately for different owners and after a run completes", async () => {
    mocks.readOrBuild.mockResolvedValue(undefined);

    await Promise.all([refreshPracticeHome("owner-1"), refreshPracticeHome("owner-2")]);
    await refreshPracticeHome("owner-1");

    expect(mocks.readOrBuild).toHaveBeenCalledTimes(3);
  });
});
