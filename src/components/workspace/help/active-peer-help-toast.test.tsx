import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
  useRouter: () => ({ push: routerPush })
}));

import { ActivePeerHelpToast } from "./active-peer-help-toast";

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
          data: {
            requestId: "00000000-0000-4000-8000-000000000001",
            seat: "learner",
            slug: "two-sum",
            title: "Two Sum",
            language: "javascript",
            started: true,
            peer: { label: "Asha Verma", headline: null, profileImage: null }
          }
        })
      })
    );

    render(<ActivePeerHelpToast />);

    expect(await screen.findByText("Peer help with Asha Verma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        "/help/room/00000000-0000-4000-8000-000000000001?from=%2Fpractice"
      )
    );
  });
});
