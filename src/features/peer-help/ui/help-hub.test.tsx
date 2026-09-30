import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HelpOverview } from "@/features/peer-help/contracts/help-history";
import { HelpHub } from "./help-hub";

const overview: HelpOverview = {
  viewer: {
    label: "Asha Verma",
    headline: "Frontend candidate",
    profileImage: "/images/profile/avatars/avatar-06.jpg"
  },
  helpReceived: 3,
  peopleHelped: 1,
  activeReceived: 0,
  activeGiven: 0,
  positiveHelps: 1,
  availabilityCredits: 0,
  activeConversation: null,
  topHelpers: [],
  topHelpersTotal: 0,
  onlineMates: 0
};

const emptyHistory = { items: [], nextCursor: null };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function topHelper(label: string, helpedCount: number, thankedCount: number) {
  return { participant: { label, headline: null, profileImage: null }, helpedCount, thankedCount };
}

describe("peer support hub", () => {
  it("shows the top five and opens the full leaderboard from View all", async () => {
    const board = Array.from({ length: 12 }, (_, index) =>
      topHelper(`Mate ${index + 1}`, 30 - index, 20 - index)
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { helpers: board } })
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <HelpHub
        initialOverview={{ ...overview, topHelpers: board.slice(0, 5), topHelpersTotal: 12 }}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );

    expect(screen.getByText("Mate 5")).toBeTruthy();
    expect(screen.queryByText("Mate 6")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /View all Top Trailmates/ }));

    const dialog = await screen.findByRole("dialog", { name: "Top Trailmates" });
    expect(fetchMock).toHaveBeenCalledWith("/api/help/leaderboard", expect.anything());
    expect(await screen.findByText("Mate 12")).toBeTruthy();
    expect(dialog.textContent).toContain("Showing the top 12");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Top Trailmates" })).toBeNull();
  });

  it("offers View all only when there is more to see", () => {
    render(
      <HelpHub
        initialOverview={{
          ...overview,
          topHelpers: [topHelper("Only Mate", 3, 2)],
          topHelpersTotal: 1
        }}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );
    expect(screen.getByText("Only Mate")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /View all Top Trailmates/ })).toBeNull();
  });

  it("turns empty sections into a next step, with faded outlines kept out of the a11y tree", () => {
    const { container } = render(
      <HelpHub
        initialOverview={{ ...overview, peopleHelped: 0, onlineMates: 4 }}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );

    expect(screen.getByText("Ready to help")).toBeTruthy();
    expect(screen.queryByText(/mates? online now/)).toBeNull();
    expect(screen.getByText("Nobody’s on the board yet")).toBeTruthy();
    expect(screen.getByText("The people you support will appear here")).toBeTruthy();
    expect(screen.getByText("The people who support you will appear here")).toBeTruthy();
    const practiceLinks = screen.getAllByRole("link", { name: /Go to practice/ });
    expect(practiceLinks).toHaveLength(2);
    expect(practiceLinks.every((link) => link.getAttribute("href") === "/practice")).toBe(true);
    // The outlines are decoration: hidden from assistive tech and not clickable.
    const outlines = container.querySelectorAll('[aria-hidden="true"].pointer-events-none');
    expect(outlines.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the supported count and hides the online line when nobody is online", () => {
    render(
      <HelpHub
        initialOverview={overview}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );
    expect(screen.getByText("Supported 1 person")).toBeTruthy();
    expect(screen.queryByText(/online now/)).toBeNull();
  });

  it("uses the profile-led layout without the old marketing hero", () => {
    render(
      <HelpHub
        initialOverview={overview}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );

    expect(screen.getByText("Asha Verma")).toBeTruthy();
    expect(screen.getByText("Supported 1 person")).toBeTruthy();
    expect(screen.getByText("People you’ve supported")).toBeTruthy();
    expect(screen.getByText("People who supported you")).toBeTruthy();
    expect(screen.queryByText("Ask. Talk. Keep moving.")).toBeNull();
  });

  it("opens the full badge ranking from the profile badge", () => {
    render(
      <HelpHub
        initialOverview={overview}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /First Assist/i }));

    const dialog = screen.getByRole("dialog", { name: "First Assist" });
    expect(dialog).toBeTruthy();
    expect(dialog.closest("main")).toBeNull();
    expect(dialog.parentElement?.className).toContain("fixed inset-0");
    expect(dialog.parentElement?.className).not.toContain("backdrop-blur");
    expect(screen.getByText("Trusted Mate")).toBeTruthy();
    expect(screen.getByText("Trail Guide")).toBeTruthy();
  });

  it("pauses active-conversation polling while hidden and refreshes when visible", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: overview })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HelpHub
        initialOverview={{
          ...overview,
          activeConversation: {
            requestId: "request-1",
            seat: "learner",
            slug: "two-sum",
            title: "Two Sum",
            language: "typescript",
            started: true,
            peer: { label: "Maya", headline: null, profileImage: null }
          }
        }}
        initialReceivedHistory={emptyHistory}
        initialGivenHistory={emptyHistory}
      />
    );

    act(() => vi.advanceTimersByTime(20_000));
    expect(fetchMock).not.toHaveBeenCalled();

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
