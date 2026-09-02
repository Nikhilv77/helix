import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useWorkspaceNotifications,
  WorkspaceNotificationPollingProvider
} from "./workspace-notification-polling";

function Probe() {
  const { unread } = useWorkspaceNotifications();
  return <span>{unread}</span>;
}

describe("WorkspaceNotificationPollingProvider", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shares one initial request across both responsive inbox placements", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { items: [], unread: 2 }
      })
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <WorkspaceNotificationPollingProvider>
        <Probe />
        <Probe />
      </WorkspaceNotificationPollingProvider>
    );

    await waitFor(() => expect(view.getAllByText("2")).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
