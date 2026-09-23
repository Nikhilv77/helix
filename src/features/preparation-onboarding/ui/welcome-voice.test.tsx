import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreparationOnboardingState } from "../domain/preparation-onboarding";

const voice = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue("started"),
  stop: vi.fn(),
  preload: vi.fn(),
  setAwaitingGesture: vi.fn()
}));

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: voice.speak,
    stop: voice.stop,
    preload: voice.preload,
    awaitingGesture: false,
    setAwaitingGesture: voice.setAwaitingGesture
  })
}));

import { useWelcomeVoice } from "./welcome-voice";

const onboarding: PreparationOnboardingState = {
  stage: "target_role",
  updatedAt: 1,
  completedAt: null,
  baselineStartedAt: null,
  answers: {},
  questionIds: {},
  questions: {},
  skillProfile: null
};

describe("useWelcomeVoice", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not repeat a line when a choice only recreates the slide object", async () => {
    vi.useFakeTimers();
    const firstSlide = { title: "What role are you aiming for?", body: "Choose your track." };
    const { rerender } = renderHook(
      ({ current }) =>
        useWelcomeVoice({
          teacherId: "sophia",
          current,
          playbackKey: "target:0",
          slides: [current],
          visible: true,
          step: 1,
          alreadyOnboarded: false,
          baselineStage: null,
          activeBaselineSection: null,
          onboarding,
          targetRole: "fullstack"
        }),
      { initialProps: { current: firstSlide } }
    );

    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(voice.speak).toHaveBeenCalledOnce();

    rerender({ current: { ...firstSlide, body: "A newly selected track." } });
    await act(() => vi.advanceTimersByTimeAsync(60));

    expect(voice.speak).toHaveBeenCalledOnce();
  });

  it("speaks when the displayed line actually changes", async () => {
    vi.useFakeTimers();
    const firstSlide = { title: "First line", body: "First body" };
    const { rerender } = renderHook(
      ({ current, playbackKey }) =>
        useWelcomeVoice({
          teacherId: "sophia",
          current,
          playbackKey,
          slides: [current],
          visible: true,
          step: 1,
          alreadyOnboarded: false,
          baselineStage: null,
          activeBaselineSection: null,
          onboarding,
          targetRole: "fullstack"
        }),
      { initialProps: { current: firstSlide, playbackKey: "target:0" } }
    );

    await act(() => vi.advanceTimersByTimeAsync(60));
    rerender({
      current: { title: "Second line", body: "Second body" },
      playbackKey: "target:1"
    });
    await act(() => vi.advanceTimersByTimeAsync(60));

    expect(voice.speak).toHaveBeenCalledTimes(2);
    expect(voice.speak).toHaveBeenLastCalledWith("Second line Second body");
  });
});
