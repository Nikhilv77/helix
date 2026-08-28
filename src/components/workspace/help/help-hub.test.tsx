import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

afterEach(cleanup);

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
});
