import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductFilm } from "./product-film";

const film = (
  <ProductFilm
    src="/videos/marketing/trailgrad-demo.mp4"
    mobileSrc="/videos/marketing/trailgrad-demo-mobile.mp4"
    poster="/videos/marketing/trailgrad-demo-poster.jpg"
    label="Trailgrad product film"
    description="A short silent film."
  />
);

describe("ProductFilm playback", () => {
  let onIntersection: IntersectionObserverCallback;
  let reducedMotion: boolean;
  let smallScreen: boolean;
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reducedMotion = false;
    smallScreen = false;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersection = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduced-motion") ? reducedMotion : smallScreen,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "connection");
  });

  async function visibility(ratio: number) {
    await act(async () => {
      onIntersection(
        [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
  }

  it("waits for visibility, plays muted, and pauses as it leaves view", async () => {
    render(film);
    const video = screen.getByLabelText("Trailgrad product film") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("preload", "none");
    expect(play).not.toHaveBeenCalled();
    await visibility(0.7);
    expect(play).toHaveBeenCalledOnce();
    await visibility(0.2);
    expect(pause).toHaveBeenCalled();
  });

  it("has no playback controls", () => {
    render(film);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("pauses once the next section has scrolled over the hero", async () => {
    render(
      <ProductFilm
        src="/videos/marketing/trailgrad-demo.mp4"
        mobileSrc="/videos/marketing/trailgrad-demo-mobile.mp4"
        poster="/videos/marketing/trailgrad-demo-poster.jpg"
        label="Trailgrad product film"
        description="A short silent film."
        coveredAfterScroll={0.75}
      />
    );
    await visibility(1);
    expect(play).toHaveBeenCalledOnce();
    await act(async () => {
      Object.defineProperty(window, "scrollY", { value: window.innerHeight, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(pause).toHaveBeenCalled();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("loads the desktop master only once it is first seen", async () => {
    render(film);
    const video = screen.getByLabelText("Trailgrad product film") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBeNull();
    await visibility(1);
    expect(video.getAttribute("src")).toBe("/videos/marketing/trailgrad-demo.mp4");
  });

  it("plays the 720p encode on phones", async () => {
    smallScreen = true;
    render(film);
    await visibility(1);
    const video = screen.getByLabelText("Trailgrad product film") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("/videos/marketing/trailgrad-demo-mobile.mp4");
    expect(play).toHaveBeenCalledOnce();
  });

  it("stays on the poster with data saver on", async () => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true
    });
    render(film);
    await visibility(1);
    const video = screen.getByLabelText("Trailgrad product film") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("stays on the poster for reduced motion", async () => {
    reducedMotion = true;
    render(film);
    await visibility(1);
    expect(play).not.toHaveBeenCalled();
  });
});
