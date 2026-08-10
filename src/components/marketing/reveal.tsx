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

    function update() {
      frame = 0;
      const target = ref.current;
      if (!target) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      if (parallax) target.style.setProperty("--p", progress.toFixed(4));
      report.current?.(progress);
    }

    function onScroll() {
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

interface CounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

/** Counts up to `value` the first time it scrolls into view. */
export function Counter({ value, suffix = "", duration = 1600, className }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!visible) return;

    if (prefersReducedMotion()) {
      setCurrent(value);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const linear = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - linear, 3);
      setCurrent(Math.round(value * eased));

      if (linear < 1) {
        frame = window.requestAnimationFrame(step);
      }
    }

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value, visible]);

  return (
    <span ref={ref} className={className}>
      {current}
      {suffix}
    </span>
  );
}

/**
 * Types its text out, one character at a time, the first time it scrolls into
 * view.
 *
 * The full string is rendered on the server and carried on `aria-label`, so
 * crawlers and screen readers always get the complete sentence — only the
 * visible span is animated, and it is hidden from the accessibility tree so
 * nothing announces a half-typed word. Reduced-motion users get the text
 * immediately with no caret.
 */
export function TypeOut({
  text,
  className,
  speed = 14,
  delay = 0
}: {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, "0px 0px -8% 0px");
  // Starts complete so the server-rendered markup carries the whole sentence;
  // the effect below rewinds it on the client before anything is painted.
  const [shown, setShown] = useState(text.length);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setAnimate(true);
    setShown(0);
  }, []);

  useEffect(() => {
    if (!animate || !visible || shown >= text.length) return;
    const timer = window.setTimeout(
      () => setShown((count) => count + 1),
      shown === 0 ? delay : speed
    );
    return () => window.clearTimeout(timer);
  }, [animate, delay, visible, shown, text.length, speed]);

  const typing = animate && visible && shown < text.length;

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden="true">{animate ? text.slice(0, shown) : text}</span>
      {typing ? (
        <span
          aria-hidden="true"
          className="ml-px inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-current align-baseline"
        />
      ) : null}
    </span>
  );
}
