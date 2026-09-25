import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSummary, invalidate } = vi.hoisted(() => ({
  readSummary: vi.fn().mockResolvedValue({}),
  invalidate: vi.fn()
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    candidateAnalyticsSnapshotStore: { readSummary, invalidate }
  })
}));
vi.mock("./candidate-analytics-loader", () => ({
  buildCandidateAnalytics: vi.fn()
}));

import { refreshCandidateAnalytics } from "./refresh-candidate-analytics";

describe("refreshCandidateAnalytics", () => {
  beforeEach(() => {
    readSummary.mockClear();
    invalidate.mockClear();
  });

  it("rebuilds a dirty snapshot without bumping its version again", async () => {
    await refreshCandidateAnalytics("owner-1");

    expect(readSummary).toHaveBeenCalledOnce();
    // A refresh after a write must rebuild rather than return the saved payload.
    expect(readSummary).toHaveBeenCalledWith("owner-1", expect.any(Function), {
      requireFresh: true
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
