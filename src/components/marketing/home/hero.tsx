"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, useScrollProgress } from "../reveal";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { LiveBars } from "../product-frames";
import { MarketingAvatar } from "../marketing-avatar";
import { PrimaryAction } from "./primary-action";

/**
 * The parallax has already faded the hero out by the time `--p` reaches 0.74,
 * and the section is sticky, so past this point the avatar is rendering behind
 * an opaque page nobody can see through. A little margin above the fade-out
 * keeps the resume invisible on the way back up.
 */
const AVATAR_CUTOFF = 0.85;

export function Hero() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [avatarActive, setAvatarActive] = useState(true);

  // Shares the parallax's rAF tick rather than adding a listener of its own,
  // and only re-renders on the two frames where the threshold is crossed.
  useScrollProgress(parallaxRef, (progress) => {
    const active = progress < AVATAR_CUTOFF;
    setAvatarActive((current) => (current === active ? current : active));
  });

  return (
    <section className="sticky top-0 z-0 h-[100svh] min-h-[40rem] overflow-hidden px-5 pb-10 pt-24 sm:px-10">
      <div
        ref={parallaxRef}
        className="hero-parallax relative z-10 mx-auto flex h-full w-full max-w-[46rem] flex-col items-center justify-center text-center"
      >
        <div className="relative max-h-[36rem] min-h-[15rem] w-full max-w-[31rem] flex-1 sm:max-h-[30rem] sm:max-w-[28rem]">
          <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[23rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-35 sm:h-[26rem] sm:w-[34rem] sm:opacity-50" />
          <MarketingAvatar
            priority
            active={avatarActive}
            framing="marketing"
            className="pointer-events-none absolute inset-y-0 -inset-x-10 z-10 -translate-x-10 scale-[1.18] sm:inset-0 sm:translate-x-0 sm:scale-100 sm:drop-shadow-[0_24px_30px_rgba(4,12,35,0.5)]"
          />
          <div className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-48 -translate-x-1/2 bg-cream/25 shadow-[0_0_24px_rgba(241,234,216,0.35)] sm:w-64" />
        </div>

        <div className="flex w-full shrink-0 flex-col items-center">
          <Reveal>
            <span className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
              <span className="blueprint-label whitespace-nowrap text-cream/80">
                Learn it, then say it
              </span>
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-6">
              <span
                className="wordmark block text-cream"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)", letterSpacing: "-0.03em" }}
              >
                Let&rsquo;s begin.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={170}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cream/78 sm:text-xl">
              Upload your resume, get a focused prep path, and practice with Maya until every answer
              can hold up in a real interview.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <LiveBars count={18} className="mt-7 hidden h-8 opacity-60 sm:flex" />
          </Reveal>

          <Reveal delay={300}>
            <PrimaryAction className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-lg border-none bg-cream px-7 text-sm font-semibold text-[#13234f] shadow-[0_16px_34px_-22px_rgba(241,234,216,0.95)] transition hover:bg-cream-soft sm:text-base">
              Start free
              <ArrowRight size={18} aria-hidden="true" />
            </PrimaryAction>
          </Reveal>

          <Reveal delay={360}>
            <p className="blueprint-label mt-5 text-cream/40">
              Free to start &middot; No card required
            </p>
          </Reveal>
        </div>
      </div>

      <div className="blueprint-label absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-cream/40 lg:block">
        Scroll
      </div>
    </section>
  );
}
