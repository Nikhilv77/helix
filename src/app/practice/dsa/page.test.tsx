import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  requireOnboardedOwner: vi.fn(),
  recoverCurrent: vi.fn(),
  fullPlan: vi.fn(),
  dsaPage: vi.fn(),
  cachedDsaPage: vi.fn(),
  historyRows: vi.fn(),
  current: vi.fn(),
  currentWithReadiness: vi.fn(),
  evidence: vi.fn(),
  stable: vi.fn(),
  historyRead: vi.fn()
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedOwner: mocks.requireOnboardedOwner
}));
vi.mock("@/features/practice/dsa/server/dsa-practice-block.store", () => ({
  recommendationFromSnapshot: () => ({ questions: [] })
}));
vi.mock("@/features/practice/dsa/server/stable-dsa-recommendation", () => ({
  buildStableDsaRecommendation: mocks.stable
}));
vi.mock("@/features/practice/dsa/server/cached-dsa-page", () => ({
  cachedDsaPage: mocks.cachedDsaPage
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { nodeEnv: "test" },
    dsaBlockAssessmentFinalizationService: { recoverCurrent: mocks.recoverCurrent },
    dsaService: { fullPlan: mocks.fullPlan },
    frontendRoadmapService: { dsaPage: mocks.dsaPage },
    practiceEvidenceStore: { refresh: mocks.evidence },
    dsaPracticeBlockStore: {
      history: mocks.historyRows,
      current: mocks.current,
      currentWithReadiness: mocks.currentWithReadiness
    },
    dsaBlockHistoryService: { read: mocks.historyRead }
  })
}));
vi.mock("@/features/practice/dsa/ui/dsa-topics", () => ({
  DsaTopics: (props: { blockHistory: { selected: { id: string } } | null; panel: string }) => (
    <div
      data-testid="topics"
      data-block={props.blockHistory?.selected.id}
      data-panel={props.panel}
    />
  )
}));

import DsaPracticePage from "./page";

describe("DsaPracticePage block history read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events.length = 0;
    mocks.requireOnboardedOwner.mockResolvedValue({ ownerId: "owner-a" });
    mocks.recoverCurrent.mockImplementation(async () => {
      mocks.events.push("recover");
    });
    mocks.fullPlan.mockImplementation(async () => {
      mocks.events.push("plan");
      return {
        chapters: [],
        totalQuestions: 0,
        totalMinutes: 0,
        counts: { easy: 0, medium: 0, hard: 0 },
        firstQuestionSlug: null
      };
    });
    mocks.cachedDsaPage.mockResolvedValue({
      roadmap: null,
      questionStatuses: { "saved-question": "COMPLETED" }
    });
    mocks.historyRows.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      isCurrent: true,
      status: "PRACTISING",
      questionSlugs: ["unsolved-question"],
      recommendationSnapshot: {}
    }]);
    mocks.evidence.mockResolvedValue(null);
    mocks.stable.mockResolvedValue(null);
    mocks.historyRead.mockResolvedValue({
      selected: { id: "11111111-1111-4111-8111-111111111111" },
      previousBlockId: null,
      nextBlockId: null,
      totalBlocks: 1
    });
  });

  it("uses the saved block without rebuilding evidence and passes the URL-selected owned block", async () => {
    render(
      await DsaPracticePage({
        searchParams: Promise.resolve({
          block: "11111111-1111-4111-8111-111111111111",
          panel: "transcript"
        })
      })
    );

    expect(mocks.recoverCurrent).not.toHaveBeenCalled();
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.stable).not.toHaveBeenCalled();
    expect(mocks.historyRead).toHaveBeenCalledWith(
      "owner-a",
      "11111111-1111-4111-8111-111111111111",
      { "saved-question": "COMPLETED" },
      true,
      await mocks.historyRows.mock.results[0]?.value
    );
    expect(screen.getByTestId("topics")).toHaveAttribute(
      "data-block",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(screen.getByTestId("topics")).toHaveAttribute("data-panel", "transcript");
  });
});
