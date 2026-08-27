import { describe, expect, it, vi } from "vitest";
import { PrepStateSaveQueue, type PrepStatePatch } from "./prep-state-save-queue";

describe("PrepStateSaveQueue", () => {
  it("serializes an older save before sending a newer coalesced value", async () => {
    const first = deferred<void>();
    const calls: PrepStatePatch[] = [];
    let active = 0;
    let maximumActive = 0;
    const sender = vi.fn(async (patch: PrepStatePatch) => {
      calls.push(patch);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (calls.length === 1) await first.promise;
      active -= 1;
    });
    const queue = new PrepStateSaveQueue(sender);

    queue.enqueue({ draftAnswer: "older" });
    const flush = queue.flush();
    await Promise.resolve();
    queue.enqueue({ draftAnswer: "newer" });
    queue.enqueue({ note: "coalesced note" });

    expect(sender).toHaveBeenCalledTimes(1);
    first.resolve();
    await flush;

    expect(calls).toEqual([
      { draftAnswer: "older" },
      { draftAnswer: "newer", note: "coalesced note" }
    ]);
    expect(maximumActive).toBe(1);
  });

  it("retains failed fields while allowing a newer value to supersede them", async () => {
    const calls: PrepStatePatch[] = [];
    const retryCounts: number[] = [];
    const sender = vi.fn(async (patch: PrepStatePatch, context: { retryCount: number }) => {
      calls.push(patch);
      retryCounts.push(context.retryCount);
      if (calls.length === 1) throw new Error("offline");
    });
    const queue = new PrepStateSaveQueue(sender);

    queue.enqueue({ draftAnswer: "older", note: "keep me" });
    await expect(queue.flush()).rejects.toThrow("offline");
    queue.enqueue({ draftAnswer: "newer" });
    await queue.flush();

    expect(calls).toEqual([
      { draftAnswer: "older", note: "keep me" },
      { draftAnswer: "newer", note: "keep me" }
    ]);
    expect(retryCounts).toEqual([0, 1]);
  });

  it("bounds the client-reported retry count accepted by the state API", async () => {
    let failing = true;
    const retryCounts: number[] = [];
    const queue = new PrepStateSaveQueue(async (_patch, context) => {
      retryCounts.push(context.retryCount);
      if (failing) throw new Error("offline");
    });
    queue.enqueue({ note: "retain me" });

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(queue.flush()).rejects.toThrow("offline");
    }
    failing = false;
    await queue.flush();

    expect(retryCounts.at(-1)).toBe(20);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
