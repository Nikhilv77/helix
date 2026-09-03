import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useWorkspaceNotifications,
  WorkspaceNotificationPollingProvider
} from "./workspace-notification-polling";
import { WORKSPACE_NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/notification-ui-events";

function Probe() {
  const { unread } = useWorkspaceNotifications();
  return <span>{unread}</span>;
}

describe("WorkspaceNotificationPollingProvider", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shares one initial status and full request across responsive placements", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) =>
      Promise.resolve({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue(
            String(input) === "/api/notifications/status"
              ? { success: true, data: { version: "v1", unread: 2 } }
              : { success: true, data: { items: [], unread: 2 } }
          )
      } as unknown as Response)
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <WorkspaceNotificationPollingProvider>
        <Probe />
        <Probe />
      </WorkspaceNotificationPollingProvider>
    );

    await waitFor(() => expect(view.getAllByText("2")).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("does not lose the visible-again refresh while an aborted status check unwinds", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    let releaseFirstStatus: (() => void) | undefined;
    const calls = { full: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/notifications/status") {
          calls.status += 1;
          if (calls.status === 1) {
            return new Promise<Response>((resolve) => {
              releaseFirstStatus = () =>
                resolve({
                  ok: true,
                  json: vi
                    .fn()
                    .mockResolvedValue({ success: true, data: { version: "v1", unread: 0 } })
                } as unknown as Response);
            });
          }
          return Promise.resolve({
            ok: true,
            json: vi
              .fn()
              .mockResolvedValue({ success: true, data: { version: "v1", unread: 0 } })
          } as unknown as Response);
        }
        calls.full += 1;
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ success: true, data: { items: [], unread: 0 } })
        } as unknown as Response);
      })
    );

    render(
      <WorkspaceNotificationPollingProvider>
        <Probe />
      </WorkspaceNotificationPollingProvider>
    );
    await waitFor(() => expect(calls.status).toBe(1));

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => releaseFirstStatus?.());

    await waitFor(() => expect(calls).toEqual({ full: 1, status: 2 }));
  });

  it("backs off unchanged status checks and resets after a change", async () => {
    vi.useFakeTimers();
    let version = "v1";
    const calls = { full: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/notifications/status") {
          calls.status += 1;
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              success: true,
              data: { version, unread: version === "v1" ? 0 : 1 }
            })
          } as unknown as Response);
        }
        calls.full += 1;
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ success: true, data: { items: [], unread: 0 } })
        } as unknown as Response);
      })
    );

    render(
      <WorkspaceNotificationPollingProvider>
        <Probe />
      </WorkspaceNotificationPollingProvider>
    );
    await act(async () => {});
    expect(calls).toEqual({ full: 1, status: 1 });

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(calls).toEqual({ full: 1, status: 2 });

    await act(async () => vi.advanceTimersByTimeAsync(119_999));
    expect(calls).toEqual({ full: 1, status: 2 });
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(calls).toEqual({ full: 1, status: 3 });

    version = "v2";
    await act(async () => vi.advanceTimersByTimeAsync(300_000));
    expect(calls).toEqual({ full: 2, status: 4 });

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(calls).toEqual({ full: 2, status: 5 });
  });

  it("refreshes the inbox immediately after an in-page notification is created", async () => {
    const calls = { full: 0, status: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/notifications/status") {
          calls.status += 1;
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              success: true,
              data: { version: `v${calls.status}`, unread: calls.status > 1 ? 1 : 0 }
            })
          } as unknown as Response);
        }
        calls.full += 1;
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            success: true,
            data: { items: [], unread: calls.full > 1 ? 1 : 0 }
          })
        } as unknown as Response);
      })
    );

    render(
      <WorkspaceNotificationPollingProvider>
        <Probe />
      </WorkspaceNotificationPollingProvider>
    );
    await waitFor(() => expect(calls).toEqual({ full: 1, status: 1 }));

    window.dispatchEvent(new Event(WORKSPACE_NOTIFICATIONS_CHANGED_EVENT));

    await waitFor(() => expect(calls).toEqual({ full: 2, status: 2 }));
  });
});
