import { act, cleanup, render, waitFor } from "@testing-library/react";
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pauses while hidden and refreshes immediately when visible again", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const calls = { active: 0, inbox: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/help/status") {
          calls.status += 1;
          return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
        }
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
    await waitFor(() => expect(calls).toEqual({ active: 1, inbox: 1, status: 1 }));

    visibility = "hidden";
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(calls).toEqual({ active: 1, inbox: 1, status: 1 });

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(calls).toEqual({ active: 2, inbox: 2, status: 2 }));
  });

  it("does not lose the visible-again refresh while an aborted status check unwinds", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    let releaseFirstStatus: (() => void) | undefined;
    const calls = { active: 0, inbox: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/help/status") {
          calls.status += 1;
          if (calls.status === 1) {
            return new Promise<Response>((resolve) => {
              releaseFirstStatus = () =>
                resolve(jsonResponse({ success: true, data: { version: "v1" } }));
            });
          }
          return Promise.resolve(jsonResponse({ success: true, data: { version: "v1" } }));
        }
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
    await waitFor(() => expect(calls.status).toBe(1));

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => releaseFirstStatus?.());

    await waitFor(() => expect(calls).toEqual({ active: 1, inbox: 1, status: 2 }));
  });

  it("polls a tiny status and reloads full help data only when it changes", async () => {
    vi.useFakeTimers();
    let version = "v1";
    const calls = { active: 0, inbox: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/help/status") {
          calls.status += 1;
          return Promise.resolve(jsonResponse({ success: true, data: { version } }));
        }
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
    await act(async () => {});
    expect(calls).toEqual({ active: 1, inbox: 1, status: 1 });

    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(calls).toEqual({ active: 1, inbox: 1, status: 2 });

    version = "v2";
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(calls).toEqual({ active: 2, inbox: 2, status: 3 });
  });
});
