import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
  useRouter: () => ({ push: routerPush })
}));

import { showCurrentPeerHelp } from "@/lib/help/help-ui-events";
import { CurrentPeerHelpPrompt } from "./current-peer-help-prompt";

function jsonResponse(payload: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(payload) } as unknown as Response;
}

describe("CurrentPeerHelpPrompt", () => {
  beforeEach(() => routerPush.mockReset());

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the centered blurred treatment and lets a waiting learner withdraw", async () => {
    const requestId = "00000000-0000-4000-8000-000000000001";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            requestId,
            seat: "learner",
            status: "OPEN",
            slug: "contains-duplicate",
            title: "Contains Duplicate",
            language: "javascript",
            started: false,
            peer: null
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { status: "CANCELLED" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CurrentPeerHelpPrompt />);
    act(() => showCurrentPeerHelp());

    expect(
      await screen.findByText("You’ve already asked a mate about Contains Duplicate")
    ).toBeTruthy();
    const backdrop = screen.getByTestId("current-peer-help-backdrop");
    expect(backdrop.className).toContain("backdrop-blur-[5px]");
    expect(backdrop.className).toContain("bg-black/25");

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/help/request?id=${requestId}`, {
        method: "DELETE"
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("offers join and hand-back when a helper accepted but has not started", async () => {
    const requestId = "00000000-0000-4000-8000-000000000002";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            requestId,
            seat: "helper",
            status: "CLAIMED",
            slug: "two-sum",
            title: "Two Sum",
            language: "javascript",
            started: false,
            peer: { label: "Asha Verma", headline: null, profileImage: null }
          }
        })
      )
    );

    render(<CurrentPeerHelpPrompt />);
    act(() => showCurrentPeerHelp());

    const join = await screen.findByRole("button", { name: "Join Trailmate room" });
    expect(screen.getByRole("button", { name: "Hand back" })).toBeTruthy();
    fireEvent.click(join);
    expect(routerPush).toHaveBeenCalledWith(`/help/room/${requestId}?from=%2Fpractice`);
  });
});
