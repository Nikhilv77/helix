import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

const mocks = vi.hoisted(() => ({
  eligibility: vi.fn(),
  current: vi.fn(),
  historyList: vi.fn(),
  historyRead: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: () =>
    Promise.resolve({ ownerId: "owner-one", profile: { targetRole: "backend", level: "3-5" } })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { nodeEnv: "test" },
    architectureDesign: {
      eligibility: { forProfile: mocks.eligibility },
      practice: { current: mocks.current },
      history: { list: mocks.historyList, read: mocks.historyRead }
    }
  })
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound
}));
vi.mock("@/features/practice/architecture-design/ui/architecture-design-overview", () => ({
  ArchitectureDesignOverview: ({
    block,
    history
  }: {
    block: { id: string };
    history: { totalBlocks: number };
  }) => <div data-testid="scenario" data-block={block.id} data-total={history.totalBlocks} />
}));
vi.mock("@/features/practice/architecture-design/ui/architecture-design-preparation", () => ({
  ArchitectureDesignPreparation: () => <div data-testid="preparation" />
}));

import ArchitectureDesignPracticePage from "./page";

describe("ArchitectureDesignPracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eligibility.mockResolvedValue({ available: true, message: "Ready", scenarios: [] });
    mocks.current.mockResolvedValue(null);
    mocks.historyList.mockResolvedValue([]);
  });

  it("shows the role-aligned confirmation only when the server marks the path eligible", async () => {
    render(await ArchitectureDesignPracticePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("preparation")).toBeInTheDocument();

    mocks.eligibility.mockResolvedValue({
      available: false,
      message: "Two reviewed scenarios are required.",
      scenarios: []
    });
    render(await ArchitectureDesignPracticePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent("Two reviewed scenarios are required.");
  });

  it("reads only the owner's requested historical scenario", async () => {
    mocks.current.mockResolvedValue({ id: "current", ordinal: 2 });
    mocks.historyRead.mockResolvedValue({ id: "old", ordinal: 1 });
    mocks.historyList.mockResolvedValue([
      { id: "current", ordinal: 2, isCurrent: true },
      { id: "old", ordinal: 1, isCurrent: false }
    ]);

    render(
      await ArchitectureDesignPracticePage({
        searchParams: Promise.resolve({ block: "old" })
      })
    );

    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "old");
    expect(screen.getByTestId("scenario")).toHaveAttribute("data-block", "old");
    expect(screen.getByTestId("scenario")).toHaveAttribute("data-total", "2");
  });

  it("uses the owner-safe not-found boundary for foreign history IDs", async () => {
    mocks.historyRead.mockRejectedValue(
      new NotFoundErrorException("ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND", "not found")
    );
    await expect(
      ArchitectureDesignPracticePage({ searchParams: Promise.resolve({ block: "foreign" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
