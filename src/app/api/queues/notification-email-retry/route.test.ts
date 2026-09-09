import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retryOne: vi.fn(),
  callbackOptions: null as null | {
    retry: (error: unknown, metadata: { deliveryCount: number }) => unknown;
  }
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    notificationDispatcher: { retryOne: mocks.retryOne }
  })
}));

vi.mock("@vercel/queue", () => ({
  handleCallback: (
    callback: (message: unknown) => Promise<void>,
    options: typeof mocks.callbackOptions
  ) => {
    mocks.callbackOptions = options;
    return callback;
  }
}));

import { POST } from "./route";

const invoke = POST as unknown as (message: unknown) => Promise<void>;

describe("notification email retry queue", () => {
  beforeEach(() => {
    mocks.retryOne.mockReset().mockResolvedValue(true);
  });

  it("validates and dispatches one persisted notification id", async () => {
    await invoke({
      version: 1,
      notificationId: "00000000-0000-4000-8000-000000000001"
    });

    expect(mocks.retryOne).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });

  it("rejects malformed queue messages before touching the dispatcher", async () => {
    await expect(invoke({ version: 1, notificationId: "not-a-uuid" })).rejects.toThrow();
    expect(mocks.retryOne).not.toHaveBeenCalled();
  });

  it("retries transient consumer failures before acknowledging poison messages", () => {
    expect(mocks.callbackOptions?.retry(new Error("temporary"), { deliveryCount: 3 })).toEqual({
      afterSeconds: 60
    });
    expect(mocks.callbackOptions?.retry(new Error("permanent"), { deliveryCount: 4 })).toEqual({
      acknowledge: true
    });
  });
});
