import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush })
}));

import { HelpRequestToast } from "./help-request-toast";
import { WorkspaceHelpPollingProvider } from "./workspace-help-polling";

const request = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "LRU Cache",
  language: "javascript",
  estimatedMinutes: 8,
  learner: { label: "Nikhil Verma", headline: null, profileImage: null }
};

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

function renderToast() {
  render(
    <WorkspaceHelpPollingProvider>
      <HelpRequestToast />
    </WorkspaceHelpPollingProvider>
  );
}

describe("HelpRequestToast", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a helper accept and go directly to the voice room", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/help/status") {
        return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
      }
      if (url === "/api/help/inbox") {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { open: [request], claimed: [], helpedPeopleCount: 0 }
          })
        );
      }
      if (url === "/api/help/active") {
        return Promise.resolve(jsonResponse({ success: true, data: null }));
      }
      return Promise.resolve(jsonResponse({ success: true, data: { claimed: true } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderToast();

    fireEvent.click(await screen.findByRole("button", { name: "Join them" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/help/request/${request.id}`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "claim" })
        })
      );
      expect(routerPush).toHaveBeenCalledWith(`/trailmate/room/${request.id}?from=%2F`);
    });
  });

  it("lets a helper quietly decline without navigating", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/help/status") {
        return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
      }
      if (url === "/api/help/inbox") {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { open: [request], claimed: [], helpedPeopleCount: 0 }
          })
        );
      }
      if (url === "/api/help/active") {
        return Promise.resolve(jsonResponse({ success: true, data: null }));
      }
      return Promise.resolve(jsonResponse({ success: true, data: { declined: true } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderToast();

    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/help/request/${request.id}`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "decline" })
        })
      );
      expect(screen.queryByRole("complementary", { name: "New Trailmate request" })).toBeNull();
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("discovers a request after page load without a refresh", async () => {
    let inboxLoads = 0;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/help/status") {
        return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
      }
      if (url === "/api/help/active") {
        return Promise.resolve(jsonResponse({ success: true, data: null }));
      }
      inboxLoads += 1;
      return Promise.resolve(
        jsonResponse({
          success: true,
          data: {
            open: inboxLoads === 1 ? [] : [request],
            claimed: [],
            helpedPeopleCount: 0
          }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderToast();
    await waitFor(() => expect(inboxLoads).toBe(1));

    window.dispatchEvent(new Event("focus"));

    expect(await screen.findByText("LRU Cache")).toBeTruthy();
    expect(inboxLoads).toBe(2);
  });
});
