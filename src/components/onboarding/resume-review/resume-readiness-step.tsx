"use client";

import { ArrowRight, Tags, Target } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PRIMARY_BUTTON } from "../flow/onboarding-data";
import { BackButton } from "../shared/onboarding-ui";
import type { ResumeExtractionResponse } from "@/lib/shared/types";
import {
  FINAL_AUTO_SCROLL_DELAY_MS,
  TRAIL_FOCUS_STAGGER_MS,
  TRAIL_SKILL_STAGGER_MS,
  useWordReveal,
  WordRevealLine
} from "./shared";

export function ResumeReadinessStep({
  result,
  onBack,
  onContinue,
  continuing = false,
  error = null
}: {
  result: ResumeExtractionResponse;
  replacingResume: boolean;
  onBack: () => void;
  onContinue: () => void;
  continuing?: boolean;
  error?: string | null;
}) {
  const { extraction } = result;
  const visibleSkills = extraction.skills.slice(0, 14);
  const visibleFocusAreas = extraction.focusAreas.slice(0, 6);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const userStoppedAutoScrollRef = useRef(false);
  const finalAutoScrollRanRef = useRef(false);
  const [visibleSkillCount, setVisibleSkillCount] = useState(0);
  const [visibleFocusCount, setVisibleFocusCount] = useState(0);
  const skillsTitle = useWordReveal("Good, your skills are in great shape.", true, 180);
  const showRouteTitle =
    skillsTitle.done && visibleSkillCount >= Math.max(visibleSkills.length, 1);
  const routeTitle = useWordReveal("We have prepared a trail for you.", showRouteTitle, 360);
  const showCta =
    routeTitle.done && visibleFocusCount >= Math.max(visibleFocusAreas.length, 1);

  useEffect(() => {
    setVisibleSkillCount(0);
    if (!skillsTitle.done) return;

    if (!visibleSkills.length) {
      const emptyTimer = window.setTimeout(() => setVisibleSkillCount(1), 450);
      return () => window.clearTimeout(emptyTimer);
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleSkillCount(Math.min(index, visibleSkills.length));
      if (index >= visibleSkills.length) window.clearInterval(timer);
    }, TRAIL_SKILL_STAGGER_MS);

    return () => window.clearInterval(timer);
  }, [skillsTitle.done, visibleSkills.length]);

  useEffect(() => {
    setVisibleFocusCount(0);
    if (!routeTitle.done) return;

    if (!visibleFocusAreas.length) {
      const emptyTimer = window.setTimeout(() => setVisibleFocusCount(1), 500);
      return () => window.clearTimeout(emptyTimer);
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleFocusCount(Math.min(index, visibleFocusAreas.length));
      if (index >= visibleFocusAreas.length) window.clearInterval(timer);
    }, TRAIL_FOCUS_STAGGER_MS);

    return () => window.clearInterval(timer);
  }, [routeTitle.done, visibleFocusAreas.length]);

  useEffect(() => {
    function stopAutoScroll() {
      userStoppedAutoScrollRef.current = true;
    }

    window.addEventListener("wheel", stopAutoScroll, { passive: true });
    window.addEventListener("touchstart", stopAutoScroll, { passive: true });
    window.addEventListener("keydown", stopAutoScroll);

    return () => {
      window.removeEventListener("wheel", stopAutoScroll);
      window.removeEventListener("touchstart", stopAutoScroll);
      window.removeEventListener("keydown", stopAutoScroll);
    };
  }, []);

  useEffect(() => {
    if (!showCta || finalAutoScrollRanRef.current) return;
    if (userStoppedAutoScrollRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    finalAutoScrollRanRef.current = true;
    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const root = document.scrollingElement ?? document.documentElement;
          window.scrollTo({
            top: root.scrollHeight - root.clientHeight,
            behavior: "smooth"
          });
        });
      });
    }, FINAL_AUTO_SCROLL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [showCta]);

  return (
    <div className="relative w-full">
      <div className="absolute left-0 top-0 z-10">
        <BackButton onClick={onBack} />
      </div>

      <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-4xl flex-col items-center justify-center pb-28 pt-16 text-center sm:mt-8 sm:min-h-[32rem] sm:py-0">
        <div className="identity-stage-in flex w-full flex-col items-center">
          <Tags size={58} strokeWidth={1.25} className="text-cream/78" aria-hidden="true" />
          <h1 className="mt-7 min-h-[3.5rem] text-balance text-[2.25rem] font-bold leading-tight tracking-tight text-cream sm:min-h-[4.5rem] sm:text-[3.35rem]">
            <WordRevealLine
              words={skillsTitle.words}
              visibleCount={skillsTitle.visibleCount}
              className="inline-block"
            />
          </h1>

          <div className="mx-auto mt-6 flex min-h-[7.5rem] max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:min-h-[6.5rem]">
            {visibleSkills.length ? (
              visibleSkills.slice(0, visibleSkillCount).map((skill, index) => (
                <span
                  key={skill}
                  className="step-in rounded-lg border border-white/25 px-3 py-1.5 text-[15px] font-semibold leading-7 text-cream/72 sm:text-base"
                  style={
                      {
                      "--step-delay": `${index * 24}ms`
                    } as CSSProperties
                  }
                >
                  {skill}
                </span>
              ))
            ) : visibleSkillCount ? (
              <span className="step-in text-[15px] leading-7 text-cream/58">
                No explicit skills found yet.
              </span>
            ) : null}
          </div>
        </div>

        {showRouteTitle ? (
          <div className="step-in mt-12 flex w-full flex-col items-center">
            <Target size={54} strokeWidth={1.25} className="text-cream/76" aria-hidden="true" />
            <h2 className="mt-7 min-h-[3rem] text-balance text-[2rem] font-bold leading-tight tracking-tight text-cream sm:min-h-[3.75rem] sm:text-[2.8rem]">
              <WordRevealLine
                words={routeTitle.words}
                visibleCount={routeTitle.visibleCount}
                className="inline-block"
              />
            </h2>

            <ol className="mx-auto mt-7 grid w-full max-w-2xl gap-3 text-left">
              {visibleFocusAreas.length ? (
                visibleFocusAreas.slice(0, visibleFocusCount).map((area, index) => (
                  <li
                    key={area}
                    className="step-in flex items-center gap-4 rounded-lg bg-cream/[0.035] px-4 py-3 text-cream/76"
                    style={
                      {
                        "--step-delay": `${index * 35}ms`
                      } as CSSProperties
                    }
                  >
                    <span className="font-mono text-[12px] font-semibold tabular-nums text-cream/42">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] font-semibold sm:text-base">{area}</span>
                  </li>
                ))
              ) : visibleFocusCount ? (
                <li className="step-in text-center text-[15px] leading-7 text-cream/58">
                  Maya will start with a broad baseline.
                </li>
              ) : null}
            </ol>
          </div>
        ) : null}

        <div ref={bottomRef} className="mt-9 flex min-h-12 scroll-mb-24 justify-center">
          {showCta ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onContinue}
                disabled={continuing}
                className={`browse-nudge ${PRIMARY_BUTTON} disabled:pointer-events-none disabled:opacity-70`}
              >
                {continuing ? "Entering..." : "Enter"} <ArrowRight size={15} />
              </button>
              {error ? (
                <p className="max-w-sm text-center text-sm font-semibold leading-6 text-cream/68">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
