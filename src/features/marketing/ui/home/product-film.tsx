"use client";

import { useEffect, useId, useRef } from "react";

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

/** Phones get the 4:5 cut. Keep in sync with `.product-film` in globals.css. */
export const PHONE_FILM_QUERY = "(max-width: 767px)";

export type FilmSources = {
  /** 1080p60 16:9 master for desktops. */
  src: string;
  /** 1080p30 16:9 encode for tablets and other touch devices. */
  touchSrc: string;
  /** 1080×1350 30 fps 4:5 cut for phones. */
  portraitSrc: string;
};

/**
 * Which file this device should play, or null to stay on the poster. Phones
 * get the portrait cut, tablets and touch devices the 30 fps encode that
 * every mobile chip decodes in hardware, desktops the master. Data saver,
 * 2G/3G-class connections, and devices reporting 2 GB of memory or less skip
 * the video. `connection` and `deviceMemory` are Chromium-only, so other
 * browsers simply fall through to the size checks.
 */
export function pickFilmSource({ src, touchSrc, portraitSrc }: FilmSources): string | null {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    deviceMemory?: number;
  };
  const connection = nav.connection;
  if (connection?.saveData) return null;
  if (connection?.effectiveType && /^(slow-2g|2g|3g)$/.test(connection.effectiveType)) return null;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return null;
  if (window.matchMedia(PHONE_FILM_QUERY).matches) return portraitSrc;
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return touchSrc;
  return src;
}

/**
 * A silent product film, played like part of the page rather than a player:
 * no controls, no frame. It loads only once visible, loops while on screen,
 * pauses off-screen or in a hidden tab, and stays on its poster for visitors
 * who prefer reduced motion. The Remotion sources live in `video/`.
 */
export function ProductFilm({
  src,
  touchSrc,
  portraitSrc,
  poster,
  portraitPoster,
  label,
  description,
  coveredAfterScroll
}: FilmSources & {
  poster: string;
  portraitPoster: string;
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
      if (source === undefined) source = pickFilmSource({ src, touchSrc, portraitSrc });
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
  }, [coveredAfterScroll, portraitSrc, src, touchSrc]);

  return (
    <figure className="product-film mx-auto">
      {/* The still sits under the video, picked by the same breakpoint as the
          film, so phones show the portrait frame before anything loads. */}
      <picture>
        <source media={PHONE_FILM_QUERY} srcSet={portraitPoster} />
        <img src={poster} alt="" className="product-film-poster" decoding="async" />
      </picture>
      <video
        ref={videoRef}
        width={1920}
        height={1080}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        aria-describedby={descriptionId}
        className="product-film-video"
      />
      <p id={descriptionId} className="sr-only">
        {description}
      </p>
    </figure>
  );
}
