import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HelpOverview } from "@/lib/help/help-history";
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
  topHelpers: []
};

const emptyHistory = { items: [], nextCursor: null };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("peer support hub", () => {
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
