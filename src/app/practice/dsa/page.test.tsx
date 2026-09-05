import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  requireOnboardedProfile: vi.fn(),
  recoverCurrent: vi.fn(),
  fullPlan: vi.fn(),
  home: vi.fn(),
  statuses: vi.fn(),
  evidence: vi.fn(),
  stable: vi.fn(),
  historyRead: vi.fn()
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));
vi.mock("@/server/dsa/stable-dsa-recommendation", () => ({
  buildStableDsaRecommendation: mocks.stable
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { nodeEnv: "test" },
    dsaBlockAssessmentFinalizationService: { recoverCurrent: mocks.recoverCurrent },
    dsaService: { fullPlan: mocks.fullPlan },
    frontendRoadmapService: { home: mocks.home, questionStatuses: mocks.statuses },
    practiceEvidenceStore: { refresh: mocks.evidence },
    dsaPracticeBlockStore: {},
    dsaBlockHistoryService: { read: mocks.historyRead }
  })
}));
vi.mock("@/components/workspace/dsa/dsa-topics", () => ({
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
    mocks.requireOnboardedProfile.mockResolvedValue({
      ownerId: "owner-a",
      profile: { targetRole: "frontend" }
    });
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
    mocks.home.mockResolvedValue(null);
    mocks.statuses.mockResolvedValue({ "saved-question": "COMPLETED" });
    mocks.evidence.mockResolvedValue(null);
    mocks.stable.mockResolvedValue(null);
    mocks.historyRead.mockResolvedValue({
      selected: { id: "11111111-1111-4111-8111-111111111111" },
      previousBlockId: null,
      nextBlockId: null,
      totalBlocks: 1
    });
  });

  it("recovers finalization before reading Practice and passes the URL-selected owned block", async () => {
    render(
      await DsaPracticePage({
        searchParams: Promise.resolve({
          block: "11111111-1111-4111-8111-111111111111",
          panel: "transcript"
        })
      })
    );

    expect(mocks.events.slice(0, 2)).toEqual(["recover", "plan"]);
    expect(mocks.historyRead).toHaveBeenCalledWith(
      "owner-a",
      "11111111-1111-4111-8111-111111111111",
      { "saved-question": "COMPLETED" }
    );
    expect(screen.getByTestId("topics")).toHaveAttribute(
      "data-block",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(screen.getByTestId("topics")).toHaveAttribute("data-panel", "transcript");
  });
});
