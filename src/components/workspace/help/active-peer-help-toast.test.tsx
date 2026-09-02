import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
  useRouter: () => ({ push: routerPush })
}));

import { ActivePeerHelpToast } from "./active-peer-help-toast";
import { HelperReadyToast } from "./helper-ready-toast";
import { announcePeerHelpEnded } from "@/lib/help/help-ui-events";
import { WorkspaceHelpPollingProvider } from "./workspace-help-polling";

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

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

function helpFetch(active: () => typeof activeMeeting | null = () => activeMeeting) {
  return vi.fn((input: string | URL | Request) => {
    if (String(input) === "/api/help/status") {
      return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
    }
    if (String(input) === "/api/help/inbox") {
      return Promise.resolve(
        jsonResponse({
          success: true,
          data: { open: [], claimed: [], helpedPeopleCount: 0 }
        })
      );
    }
    return Promise.resolve(jsonResponse({ success: true, data: active() }));
  });
}

function renderActive(children: ReactNode = <ActivePeerHelpToast />) {
  render(<WorkspaceHelpPollingProvider>{children}</WorkspaceHelpPollingProvider>);
}

describe("ActivePeerHelpToast", () => {
  afterEach(() => {
    cleanup();
    routerPush.mockReset();
    vi.unstubAllGlobals();
  });

  it("names the peer and resumes back to the current page", async () => {
    vi.stubGlobal("fetch", helpFetch());

    renderActive();

    expect(await screen.findByText("Trailmate with Asha Verma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        "/trailmate/room/00000000-0000-4000-8000-000000000001?from=%2Fpractice"
      )
    );
  });

  it("does not compete with the first centered helper-ready prompt", async () => {
    vi.stubGlobal("fetch", helpFetch());

    renderActive(
      <>
        <ActivePeerHelpToast />
        <HelperReadyToast title="Two Sum" helper={activeMeeting.peer} onJoin={() => undefined} />
      </>
    );

    expect(await screen.findByRole("button", { name: /join trailmate room/i })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Trailmate with Asha Verma")).toBeNull());
  });

  it("removes the room nudge immediately when either participant ends the meeting", async () => {
    let activeLoads = 0;
    vi.stubGlobal(
      "fetch",
      helpFetch(() => (++activeLoads === 1 ? activeMeeting : null))
    );

    renderActive();
    expect(await screen.findByText("Trailmate with Asha Verma")).toBeTruthy();

    act(() => announcePeerHelpEnded(activeMeeting.requestId));
    await waitFor(() => expect(screen.queryByText("Trailmate with Asha Verma")).toBeNull());
  });
});
