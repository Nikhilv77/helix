import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { HomeThemeArrival } from "./home-theme-arrival";

function renderHome() {
  render(
    <ThemeProvider defaultTheme="dark">
      <HomeThemeArrival>
        <span>Hero</span>
      </HomeThemeArrival>
    </ThemeProvider>
  );
  return screen.getByText("Hero").parentElement;
}

describe("HomeThemeArrival", () => {
  let reducedMotion = false;

  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion = false;
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce") ? reducedMotion : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = "";
    delete document.documentElement.dataset.theme;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens a first visit at night, then brightens into the light theme", () => {
    const wrapper = renderHome();
    expect(wrapper).toHaveAttribute("data-home-ambience", "night");
    expect(document.documentElement.dataset.theme).toBe("dark");

    // The night overlay goes up before the theme changes underneath it.
    act(() => vi.advanceTimersByTime(600));
    expect(wrapper).toHaveAttribute("data-home-ambience", "dusk");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => vi.advanceTimersByTime(50));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(wrapper).toHaveAttribute("data-home-ambience", "day");
  });

  it("shows light without saving it as the visitor's choice", () => {
    renderHome();
    act(() => vi.advanceTimersByTime(700));

    expect(localStorage.getItem("trailgrad-theme")).toBeNull();
  });

  it("keeps a theme the visitor picked, with no entrance", () => {
    localStorage.setItem("trailgrad-theme", "dark");

    const wrapper = renderHome();
    act(() => vi.advanceTimersByTime(700));

    expect(wrapper).toHaveAttribute("data-home-ambience", "settled");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("switches straight to light when motion is reduced", () => {
    reducedMotion = true;

    const wrapper = renderHome();
    act(() => vi.advanceTimersByTime(0));

    expect(wrapper).toHaveAttribute("data-home-ambience", "settled");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
