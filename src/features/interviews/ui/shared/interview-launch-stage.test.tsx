import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(async () => "session-token"),
  speak: vi.fn(async () => "unavailable" as const),
  stop: vi.fn(),
  setAwaitingGesture: vi.fn()
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mocks.getToken, isLoaded: true, isSignedIn: true })
}));

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: mocks.speak,
    stop: mocks.stop,
    awaitingGesture: false,
    setAwaitingGesture: mocks.setAwaitingGesture
  })
}));

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "maya", name: "Maya" })
}));

vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="maya-stage" />
}));

import { InterviewLaunchStage } from "./interview-launch-stage";

describe("InterviewLaunchStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ success: true, data: { sessionId: "session-1" } }, { status: 200 })
      )
    );
  });

  it("continues into an already-created interview when coach audio is unavailable", async () => {
    const navigate = vi.fn();

    render(
      <InterviewLaunchStage
        ready
        startPath="/api/interview/resume/start"
        copy={{ eyebrow: "Resume interview", headline: "Ready", body: "Prepare", script: "Go" }}
        workspaceAccent="ember"
        waitForVoiceBeforeNavigate
        navigateToInterview={navigate}
      />
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("session-1"));
    expect(mocks.speak).toHaveBeenCalledOnce();
  });
});
