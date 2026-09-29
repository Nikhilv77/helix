"use client";

import { useEffect, useId, useRef } from "react";

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

/**
 * Which file this device should play, or null to stay on the poster. Phones
 * and small screens get the 720p30 encode, which every phone decodes in
 * hardware; data saver, 2G/3G-class connections, and devices reporting 2 GB
 * of memory or less skip the video. `connection` and `deviceMemory` are
 * Chromium-only, so other browsers simply fall through to the size check.
 */
export function pickFilmSource(src: string, mobileSrc: string): string | null {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    deviceMemory?: number;
  };
  const connection = nav.connection;
  if (connection?.saveData) return null;
  if (connection?.effectiveType && /^(slow-2g|2g|3g)$/.test(connection.effectiveType)) return null;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return null;
  const small = window.matchMedia(
    "(max-width: 767px), (hover: none) and (pointer: coarse)"
  ).matches;
  return small ? mobileSrc : src;
}

/**
 * A silent product film, played like part of the page rather than a player:
 * no controls, no frame. It loads only once visible, loops while on screen,
 * pauses off-screen or in a hidden tab, and stays on its poster for visitors
 * who prefer reduced motion. The Remotion sources live in `video/`.
 */
export function ProductFilm({
  src,
  mobileSrc,
  poster,
  label,
  description,
  coveredAfterScroll
}: {
  /** 1080p60 master for desktops. */
  src: string;
  /** 720p30 encode for phones, tablets, and small screens. */
  mobileSrc: string;
  poster: string;
  label: string;
  description: string;
  /**
   * For a film in the sticky hero: once the page has scrolled this many
   * viewports, the next section covers it, so it pauses even though it is
   * still technically on screen.
   */
  coveredAfterScroll?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let covered = false;
    let loaded = false;
    // Chosen once, on first view: undefined until then, null for poster only.
    let source: string | null | undefined;
    function syncPlayback() {
      if (!video) return;
      if (!visible || covered || document.hidden || motion.matches) {
        video.pause();
        return;
      }
      if (source === undefined) source = pickFilmSource(src, mobileSrc);
      if (source === null) return;
      // Keep the video request out of the page's initial load: no src is
      // rendered, so nothing downloads until the film is first seen.
      if (!loaded) {
        video.preload = "auto";
        video.src = source;
        loaded = true;
      }
      // Muted autoplay; if a browser still blocks it, the poster stays up.
      void video.play().catch(() => undefined);
    }
    function onScroll() {
      if (coveredAfterScroll === undefined) return;
      const next = window.scrollY > window.innerHeight * coveredAfterScroll;
      if (next === covered) return;
      covered = next;
      syncPlayback();
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.3);
        syncPlayback();
      },
      { threshold: 0.3 }
    );
    observer.observe(video);
    motion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("scroll", onScroll);
      video.pause();
    };
  }, [coveredAfterScroll, mobileSrc, src]);

  return (
    <figure className="product-film mx-auto">
      <video
        ref={videoRef}
        poster={poster}
        width={1920}
        height={1080}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        aria-describedby={descriptionId}
        className="block aspect-video h-auto w-full bg-white"
      />
      <p id={descriptionId} className="sr-only">
        {description}
      </p>
    </figure>
  );
}
