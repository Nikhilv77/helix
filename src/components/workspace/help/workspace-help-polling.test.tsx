import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceHelpPolling, WorkspaceHelpPollingProvider } from "./workspace-help-polling";

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

function Probe() {
  const { activeLoaded, inboxLoaded } = useWorkspaceHelpPolling();
  return <span>{activeLoaded && inboxLoaded ? "ready" : "loading"}</span>;
}

function renderProvider() {
  render(
    <WorkspaceHelpPollingProvider>
      <Probe />
    </WorkspaceHelpPollingProvider>
  );
}

describe("WorkspaceHelpPollingProvider", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pauses while hidden and refreshes immediately when visible again", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const calls = { active: 0, inbox: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/help/inbox") {
          calls.inbox += 1;
          return Promise.resolve(
            jsonResponse({
              success: true,
              data: { open: [], claimed: [], helpedPeopleCount: 0 }
            })
          );
        }
        calls.active += 1;
        return Promise.resolve(jsonResponse({ success: true, data: null }));
      })
    );

    renderProvider();
    await waitFor(() => expect(calls).toEqual({ active: 1, inbox: 1 }));

    visibility = "hidden";
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(calls).toEqual({ active: 1, inbox: 1 });

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(calls).toEqual({ active: 2, inbox: 2 }));
  });

  it("queues one trailing refresh instead of overlapping slow requests", async () => {
    let releaseInbox: (response: Response) => void = () => {
      throw new Error("Inbox request was not started.");
    };
    let releaseActive: (response: Response) => void = () => {
      throw new Error("Active request was not started.");
    };
    const calls = { active: 0, inbox: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/help/inbox") {
          calls.inbox += 1;
          if (calls.inbox === 1) {
            return new Promise<Response>((resolve) => {
              releaseInbox = resolve;
            });
          }
          return Promise.resolve(
            jsonResponse({
              success: true,
              data: { open: [], claimed: [], helpedPeopleCount: 0 }
            })
          );
        }
        calls.active += 1;
        if (calls.active === 1) {
          return new Promise<Response>((resolve) => {
            releaseActive = resolve;
          });
        }
        return Promise.resolve(jsonResponse({ success: true, data: null }));
      })
    );

    renderProvider();
    await waitFor(() => expect(calls).toEqual({ active: 1, inbox: 1 }));

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
    expect(calls).toEqual({ active: 1, inbox: 1 });

    releaseInbox(
      jsonResponse({
        success: true,
        data: { open: [], claimed: [], helpedPeopleCount: 0 }
      })
    );
    releaseActive(jsonResponse({ success: true, data: null }));

    await waitFor(() => expect(calls).toEqual({ active: 2, inbox: 2 }));
  });
});
