"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Flips to true the first time the element scrolls into view and stays true.
 */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "0px 0px -12% 0px"
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.12 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

/**
 * Tracks whether an animated scene is close enough to the viewport to run.
 * Unlike `useInView`, this deliberately turns false again after the scene
 * leaves. Rotating marketing demos should not keep timers and React renders
 * alive while somebody is reading a different part of the page.
 */
export function useViewportPresence<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "20% 0px"
): boolean {
  const [present, setPresent] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let intersecting = false;

    const sync = () => {
      setPresent(intersecting && document.visibilityState === "visible");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = Boolean(entry?.isIntersecting);
        sync();
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref, rootMargin]);

  return present;
}

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/** Fades and lifts its children into place once they enter the viewport. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);

  return (
    <div
      ref={ref}
      className={["reveal", visible ? "is-visible" : "", className ?? ""].join(" ").trim()}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Writes scroll progress (0 at the top of the page, 1 after one viewport) onto
 * the element as `--p` so the transform stays on the compositor.
 *
 * Attach this to the element that *reads* `--p`, not an ancestor: the property
 * is registered `inherits: false` in globals.css, so a write here invalidates
 * one element's style rather than recomputing every node in the hero — canvas
 * and SVG included — on each scroll frame.
 *
 * `onProgress` runs inside the same rAF tick. Use it to derive coarse state
 * (is the hero still on screen?) without adding a second scroll listener.
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onProgress?: (progress: number) => void
) {
  const report = useRef(onProgress);
  report.current = onProgress;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Reduced motion pins the parallax with `transform: none !important`, so
    // the write is pointless — but callers still need the progress value, and
    // the work they gate on it (parking a WebGL loop) matters just as much.
    const parallax = !prefersReducedMotion();
    let frame = 0;
    let lastProgress = -1;

    function update() {
      frame = 0;
      const target = ref.current;
      if (!target) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      if (progress === lastProgress) return;
      lastProgress = progress;
      if (parallax) target.style.setProperty("--p", progress.toFixed(4));
      report.current?.(progress);
    }

    function onScroll() {
      const scrollY = window.scrollY;
      if (
        (lastProgress === 1 && scrollY >= window.innerHeight) ||
        (lastProgress === 0 && scrollY <= 0)
      ) {
        return;
      }
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/**
 * Drives a set of panels that fade in, hold, fade out, and hand over to the
 * next — the hero's pitches, the roadmap and the ask all run on this.
 *
 * There is deliberately no pause. Hover-to-pause was stalling the cascade
 * whenever a pointer crossed the section, and on touch it stranded outright:
 * `mouseenter` is emulated with no matching leave, so one tap stopped the
 * rotation for the rest of the session. Reduced motion still holds everything
 * on the first panel, which is the escape hatch that actually matters.
 */
export function useRotator({
  length,
  holdMs,
  exitMs,
  enabled = true
}: {
  length: number;
  holdMs: number;
  exitMs: number;
  /** Gate for panels below the fold: hold at the first until scrolled to. */
  enabled?: boolean;
}): { index: number; phase: "in" | "out" } {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [rotating, setRotating] = useState(false);

  // Off until the client confirms motion is welcome. Rotation is the one thing
  // here that cannot be honoured by simply shortening a duration.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const syncVisibility = () => setRotating(document.visibilityState === "visible");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (!rotating || !enabled) return;

    if (phase === "in") {
      const timer = window.setTimeout(() => setPhase("out"), holdMs);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % length);
      setPhase("in");
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [rotating, enabled, phase, index, length, holdMs, exitMs]);

  return { index, phase };
}
