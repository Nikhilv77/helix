import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  avatarProps: null as {
    url: string;
    onModelReady?: (url: string) => void;
    onModelError?: (url: string) => void;
  } | null,
  speak: vi.fn(),
  stop: vi.fn()
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    ((props: {
      url: string;
      onModelReady?: (url: string) => void;
      onModelError?: (url: string) => void;
    }) => {
      mocks.avatarProps = props;
      return <div data-testid="teacher-avatar" data-url={props.url} />;
    }) as ComponentType<{
      url: string;
      onModelReady?: (url: string) => void;
      onModelError?: (url: string) => void;
    }>
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: mocks.speak,
    stop: mocks.stop,
    awaitingGesture: false
  })
}));

import { TeacherStep } from "./teacher-step";

describe("TeacherStep model handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.avatarProps = null;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows a loader instead of moving the card while the requested teacher loads", () => {
    render(
      <TeacherStep selected="sophia" onSelect={() => undefined} onContinue={() => undefined} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next teacher" }));

    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-url", "/avatars/ryan.glb");
    expect(screen.getByText("LOADING RYAN...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next teacher" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with ryan/i })).toBeDisabled();
    expect(mocks.speak).not.toHaveBeenCalled();

    act(() => mocks.avatarProps?.onModelReady?.("/avatars/ryan.glb"));

    expect(screen.queryByText("LOADING RYAN...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next teacher" })).toBeEnabled();
    expect(mocks.speak).toHaveBeenCalledWith(expect.any(String), "ryan");
  });

  it("restores the previous teacher if the requested model fails", () => {
    render(
      <TeacherStep selected="sophia" onSelect={() => undefined} onContinue={() => undefined} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next teacher" }));
    act(() => mocks.avatarProps?.onModelError?.("/avatars/ryan.glb"));

    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-url", "/avatars/sophia.glb");
    expect(screen.getByText("Ryan couldn't load. Try again.")).toBeInTheDocument();
    expect(mocks.speak).not.toHaveBeenCalled();
  });
});
