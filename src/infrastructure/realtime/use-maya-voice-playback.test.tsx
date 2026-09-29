import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "daniel", name: "Daniel" })
}));
vi.mock("./voice-bus", () => ({ attachElement: vi.fn(), detachVoice: vi.fn() }));

import { useMayaVoice } from "./use-maya-voice";

// play() stays pending until the test settles it; pause() rejects a pending
// play() with an AbortError, as browsers do.
let pending: Array<{ element: HTMLMediaElement; resolve: () => void }> = [];

beforeEach(() => {
  pending = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement
  ) {
    return new Promise<void>((resolve, reject) => {
      pending.push({ element: this, resolve });
      this.addEventListener(
        "test-pause",
        () => reject(new DOMException("The play() request was interrupted.", "AbortError")),
        { once: true }
      );
    });
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement
  ) {
    this.dispatchEvent(new Event("test-pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("useMayaVoice playback", () => {
  it("does not report the voice as broken when a line is stopped before it starts", async () => {
    const { result } = renderHook(() => useMayaVoice());
    let outcome: string | undefined;
    await act(async () => {
      const speaking = result.current.speak("First line.");
      result.current.stop();
      outcome = await speaking;
    });
    expect(outcome).toBe("interrupted");
    expect(result.current.state).toBe("idle");
  });

  it("lets a newer line play when it replaces one that was still starting", async () => {
    const { result } = renderHook(() => useMayaVoice());
    let first: string | undefined;
    let second: Promise<string> | undefined;
    await act(async () => {
      const firstCall = result.current.speak("First line.");
      second = result.current.speak("Second line.");
      first = await firstCall;
    });
    expect(first).toBe("interrupted");
    expect(result.current.state).toBe("loading");

    await act(async () => {
      pending.at(-1)?.resolve();
      await second;
    });
    expect(await second).toBe("started");
    expect(result.current.state).toBe("speaking");
  });
});
