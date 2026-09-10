import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  requireOnboardedProfile: vi.fn()
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));
vi.mock("@/features/interviews/ui/voice/voice-interview-client", () => ({
  VoiceInterviewClient: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="voice-room" data-session-id={sessionId} />
  )
}));

import VoiceInterviewPage from "./page";

const SESSION_ID = "22222222-2222-4222-8222-222222222222";

describe("VoiceInterviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOnboardedProfile.mockResolvedValue({
      profile: { workspaceAccent: "ember", resume: null, teacherId: "maya" }
    });
  });

  it("passes the route's durable session id directly into the live room", async () => {
    render(
      await VoiceInterviewPage({
        searchParams: Promise.resolve({ session: SESSION_ID })
      })
    );

    expect(screen.getByTestId("voice-room")).toHaveAttribute("data-session-id", SESSION_ID);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps a sessionless voice URL out of the media-room client", async () => {
    await expect(
      VoiceInterviewPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT:/interviews");

    expect(mocks.redirect).toHaveBeenCalledWith("/interviews");
  });
});
