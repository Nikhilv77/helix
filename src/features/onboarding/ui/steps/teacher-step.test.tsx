import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preloadVoiceLine: vi.fn(),
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

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  preloadVoiceLine: mocks.preloadVoiceLine,
  // Maya's greeting is the only one pre-generated in these tests.
  staticVoiceUrl: (_line: string, personaId?: string) =>
    personaId === "maya" ? "/voice/maya.mp3" : null,
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

  it("opens on Daniel and starts his preview once his model is ready", () => {
    render(<TeacherStep selected={null} onSelect={() => undefined} onContinue={() => undefined} />);

    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-url", "/avatars/daniel.glb");
    act(() => mocks.avatarProps?.onModelReady?.("/avatars/daniel.glb"));

    expect(mocks.speak).toHaveBeenCalledWith(expect.any(String), "daniel");
  });

  it("preloads only neighbouring greetings that exist as static files", () => {
    mocks.preloadVoiceLine.mockClear();
    render(
      <TeacherStep selected="pooja" onSelect={() => undefined} onContinue={() => undefined} />
    );

    // Pooja's neighbours are Daniel and Maya; only Maya has a pre-generated file.
    expect(mocks.preloadVoiceLine).toHaveBeenCalledTimes(1);
    expect(mocks.preloadVoiceLine).toHaveBeenCalledWith(expect.any(String), "maya");
  });

  it("shows a loader instead of moving the card while the requested teacher loads", () => {
    render(
      <TeacherStep selected="daniel" onSelect={() => undefined} onContinue={() => undefined} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next teacher" }));

    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-url", "/avatars/pooja.glb");
    expect(screen.getByText("LOADING POOJA...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next teacher" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with pooja/i })).toBeDisabled();
    expect(mocks.speak).not.toHaveBeenCalled();

    act(() => mocks.avatarProps?.onModelReady?.("/avatars/pooja.glb"));

    expect(screen.queryByText("LOADING POOJA...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next teacher" })).toBeEnabled();
    expect(mocks.speak).toHaveBeenCalledWith(expect.any(String), "pooja");
  });

  it("restores the previous teacher if the requested model fails", () => {
    render(
      <TeacherStep selected="daniel" onSelect={() => undefined} onContinue={() => undefined} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next teacher" }));
    act(() => mocks.avatarProps?.onModelError?.("/avatars/pooja.glb"));

    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-url", "/avatars/daniel.glb");
    expect(screen.getByText("Pooja couldn't load. Try again.")).toBeInTheDocument();
    expect(mocks.speak).not.toHaveBeenCalled();
  });
});
