import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeThemeArrival } from "./home-theme-arrival";

describe("HomeThemeArrival", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.theme;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("moves the default dark landing from dawn to night", () => {
    render(
      <HomeThemeArrival>
        <span>Hero</span>
      </HomeThemeArrival>
    );

    const wrapper = screen.getByText("Hero").parentElement;
    expect(wrapper).toHaveAttribute("data-home-ambience", "dawn");

    act(() => vi.advanceTimersByTime(300));
    expect(wrapper).toHaveAttribute("data-home-ambience", "night");
  });

  it("does not override an explicit light theme", () => {
    document.documentElement.dataset.theme = "light";

    render(
      <HomeThemeArrival>
        <span>Hero</span>
      </HomeThemeArrival>
    );

    expect(screen.getByText("Hero").parentElement).toHaveAttribute(
      "data-home-ambience",
      "settled"
    );
  });
});
