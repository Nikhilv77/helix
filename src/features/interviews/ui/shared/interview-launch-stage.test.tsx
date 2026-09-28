import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(async () => "session-token"),
  speak: vi.fn<(...args: unknown[]) => Promise<string>>(async () => "unavailable"),
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

  it("waits through an in-progress creation lease instead of showing an error", async () => {
    const navigate = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            success: false,
            error: {
              code: "INTERVIEW_CREATION_IN_PROGRESS",
              message: "An interview is already being prepared for you.",
              details: { retryAfterMs: 1 }
            }
          },
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(
        Response.json({ success: true, data: { sessionId: "session-after-race" } })
      );
    vi.stubGlobal("fetch", fetchMock);

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

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("session-after-race"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("plays the recorded intro while the session is still being created", async () => {
    const navigate = vi.fn();
    let finishIntro!: () => void;
    mocks.speak.mockImplementationOnce(async (...args: unknown[]) => {
      finishIntro = () => (args[2] as { onEnded: () => void }).onEnded();
      return "playing";
    });
    let releaseStart!: () => void;
    const startGate = new Promise<void>((resolve) => {
      releaseStart = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await startGate;
        return Response.json({ success: true, data: { sessionId: "session-slow" } });
      })
    );

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

    // The intro starts before the start request has answered.
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledOnce());
    finishIntro();
    expect(navigate).not.toHaveBeenCalled();

    // The room opens as soon as the session exists.
    releaseStart();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("session-slow"));
  });
});
