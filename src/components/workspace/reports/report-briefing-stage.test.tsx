import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const voiceMocks = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue("started"),
  setAwaitingGesture: vi.fn()
}));

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "maya", name: "Maya" })
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: voiceMocks.speak,
    awaitingGesture: false,
    setAwaitingGesture: voiceMocks.setAwaitingGesture
  })
}));

vi.mock("./report-maya-avatar", () => ({
  ReportMayaAvatar: ({ speaking }: { speaking?: boolean }) => (
    <div data-testid="report-avatar" data-speaking={String(Boolean(speaking))} />
  )
}));

import { ReportEmptyStage } from "./report-briefing-stage";

describe("ReportEmptyStage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("briefly asks the candidate to interview before checking reports", async () => {
    vi.useFakeTimers();
    render(<ReportEmptyStage firstName="Arjun" exhausted={false} />);

    expect(voiceMocks.speak).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(480);
    });

    expect(voiceMocks.speak).toHaveBeenCalledOnce();
    expect(voiceMocks.speak).toHaveBeenCalledWith(
      "Take your first interview to unlock your reports."
    );
  });
});
