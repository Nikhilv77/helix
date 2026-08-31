import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
  useRouter: () => ({ push: routerPush })
}));

import { ActivePeerHelpToast } from "./active-peer-help-toast";
import { HelperReadyToast } from "./helper-ready-toast";
import { announcePeerHelpEnded } from "@/lib/help/help-ui-events";

const activeMeeting = {
  requestId: "00000000-0000-4000-8000-000000000001",
  seat: "learner",
  status: "CLAIMED",
  slug: "two-sum",
  title: "Two Sum",
  language: "javascript",
  started: true,
  peer: { label: "Asha Verma", headline: null, profileImage: null }
};

describe("ActivePeerHelpToast", () => {
  afterEach(() => {
    cleanup();
    routerPush.mockReset();
    vi.unstubAllGlobals();
  });

  it("names the peer and resumes back to the current page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: activeMeeting
        })
      })
    );

    render(<ActivePeerHelpToast />);

    expect(await screen.findByText("Trailmate with Asha Verma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        "/trailmate/room/00000000-0000-4000-8000-000000000001?from=%2Fpractice"
      )
    );
  });

  it("does not compete with the first centered helper-ready prompt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: activeMeeting })
      })
    );

    render(
      <>
        <ActivePeerHelpToast />
        <HelperReadyToast title="Two Sum" helper={activeMeeting.peer} onJoin={() => undefined} />
      </>
    );

    expect(await screen.findByRole("button", { name: /join trailmate room/i })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Trailmate with Asha Verma")).toBeNull());
  });

  it("removes the room nudge immediately when either participant ends the meeting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: activeMeeting })
      })
    );

    render(<ActivePeerHelpToast />);
    expect(await screen.findByText("Trailmate with Asha Verma")).toBeTruthy();

    act(() => announcePeerHelpEnded(activeMeeting.requestId));
    await waitFor(() => expect(screen.queryByText("Trailmate with Asha Verma")).toBeNull());
  });
});
