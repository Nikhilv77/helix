import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const voice = vi.hoisted(() => ({ stopVoice: vi.fn() }));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "daniel", name: "Daniel", portrait: "/daniel.jpg" })
}));
vi.mock("./welcome-voice", async (original) => ({
  ...(await original<typeof import("./welcome-voice")>()),
  useWelcomeVoice: () => ({
    voiceState: "idle",
    speaking: false,
    awaitingGesture: false,
    stopVoice: voice.stopVoice,
    toggleVoice: vi.fn()
  })
}));
vi.mock("./skill-profile-summary", () => ({ InitialSkillProfile: () => null }));

import { PreparationWelcome } from "./preparation-welcome";

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false
})) as typeof window.matchMedia;
Element.prototype.scrollTo ??= () => undefined;

function profile(completedAt: number | null): CandidateProfile {
  return {
    targetRole: "frontend",
    level: "mid",
    targetDate: null,
    targetCompany: "",
    headline: "Frontend engineer",
    resume: null,
    preparationOnboarding: {
      stage: "completed",
      updatedAt: 1,
      completedAt,
      baselineStartedAt: 1,
      answers: {},
      questionIds: {},
      questions: {},
      skillProfile: null
    }
  } as unknown as CandidateProfile;
}

describe("PreparationWelcome", () => {
  it("keeps the first results after finishing, even when the page refreshes the profile", () => {
    const view = render(<PreparationWelcome profile={profile(null)} />);
    expect(screen.getByText("First Skill Profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build my preparation/ })).toBeInTheDocument();

    // The workspace refreshes Home after the final answer saves `completedAt`.
    view.rerender(<PreparationWelcome profile={profile(Date.now())} />);

    expect(screen.getByText("First Skill Profile")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(screen.getByRole("button", { name: /Build my preparation/ })).toBeInTheDocument();
  });

  it("keeps the teacher talking when the refresh after the last answer unblocks the dialog", () => {
    voice.stopVoice.mockClear();
    const view = render(<PreparationWelcome profile={profile(null)} blocking />);

    // Saving the final answer refreshes Home, and the server now reports the
    // baseline as done, so the dialog stops being blocking mid-sentence.
    view.rerender(<PreparationWelcome profile={profile(Date.now())} blocking={false} />);

    expect(voice.stopVoice).not.toHaveBeenCalled();
    view.unmount();
    expect(voice.stopVoice).toHaveBeenCalled();
  });

  it("welcomes back someone who reopens the welcome after onboarding", () => {
    render(<PreparationWelcome profile={profile(Date.now())} />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue learning/ })).toBeInTheDocument();
  });
});
