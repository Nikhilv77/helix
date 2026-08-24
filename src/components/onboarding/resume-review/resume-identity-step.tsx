"use client";

import { BadgeCheck, Blocks, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { BackButton } from "../shared/onboarding-ui";
import type { ResumeExtractionResponse } from "@/lib/shared/types";
import {
  AUTO_SCROLL_IDLE_MS,
  IDENTITY_CONTINUE_MS,
  IDENTITY_DETAIL_WAVE,
  IDENTITY_FINAL_MS,
  IDENTITY_PROGRESS_DELAY_MS,
  IDENTITY_PROGRESS_DURATION_MS,
  IDENTITY_SUMMARY_MS
} from "./shared";

export function ResumeIdentityStep({
  result,
  onReplace,
  onContinue
}: {
  result: ResumeExtractionResponse;
  onReplace: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const displayName = extraction.fullName || "there";
  const resumeThings = [
    {
      label: "Work",
      value: `${extraction.experience.length || 0} ${
        extraction.experience.length === 1 ? "role" : "roles"
      }`,
      icon: BriefcaseBusiness
    },
    {
      label: "Projects",
      value: `${extraction.projects.length || 0} ${
        extraction.projects.length === 1 ? "project" : "projects"
      }`,
      icon: Blocks
    },
    {
      label: "Education",
      value: `${extraction.education.length || 0} ${
        extraction.education.length === 1 ? "entry" : "entries"
      }`,
      icon: GraduationCap
    }
  ];

  useEffect(() => {
    setPhase(0);
    const summaryTimer = window.setTimeout(() => setPhase(1), IDENTITY_SUMMARY_MS);
    const finalTimer = window.setTimeout(() => setPhase(2), IDENTITY_FINAL_MS);
    const continueTimer = window.setTimeout(onContinue, IDENTITY_CONTINUE_MS);

    return () => {
      window.clearTimeout(summaryTimer);
      window.clearTimeout(finalTimer);
      window.clearTimeout(continueTimer);
    };
  }, [displayName, extraction.headline, onContinue]);

  useEffect(() => {
    if (phase !== 2) return;

    let cancelled = false;
    function cancelScroll() {
      cancelled = true;
    }

    window.addEventListener("wheel", cancelScroll, { passive: true });
    window.addEventListener("touchstart", cancelScroll, { passive: true });
    window.addEventListener("keydown", cancelScroll);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = document.scrollingElement ?? document.documentElement;
      window.scrollTo({ top: root.scrollHeight - root.clientHeight, behavior: "smooth" });
    }, AUTO_SCROLL_IDLE_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", cancelScroll);
      window.removeEventListener("touchstart", cancelScroll);
      window.removeEventListener("keydown", cancelScroll);
    };
  }, [phase]);

  return (
    <div className="relative w-full">
      <div className="absolute left-0 top-0 z-10">
        <BackButton onClick={onReplace} />
      </div>

      <div className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-5xl flex-col items-center justify-center pb-10 pt-14 text-center sm:mt-10 sm:min-h-[31rem] sm:py-0">
        {phase === 0 ? (
          <section key="hello" className="identity-stage-in w-full">
            <BadgeCheck
              size={58}
              strokeWidth={1.35}
              className="mx-auto mb-7 text-cream/76"
              aria-hidden="true"
            />
            <p className="thinking-shimmer blueprint-label text-cream/45">Resume received</p>
            <h1
              className="thinking-shimmer identity-text-shine display-heading mx-auto mt-5 max-w-4xl text-cream"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.8rem)" }}
            >
              Hi {displayName}
            </h1>
          </section>
        ) : null}

        {phase === 1 ? (
          <section key="summary" className="identity-stage-in w-full">
            <p className="thinking-shimmer blueprint-label text-cream/45">Maya read your profile</p>
            <p
              className="mx-auto mt-5 max-w-3xl text-2xl font-semibold leading-snug text-cream sm:text-[2.7rem] sm:leading-tight"
            >
              {extraction.headline}
            </p>
            <p className="thinking-shimmer mx-auto mt-6 max-w-xl text-base leading-7 text-cream/58 sm:text-lg">
              We will use this to shape questions around what you can actually defend.
            </p>
          </section>
        ) : null}

        {phase === 2 ? (
          <section key="things" className="identity-stage-in w-full">
            <p className="blueprint-label text-cream/45">Great, your resume contains</p>
            <h1
              className="identity-text-shine display-heading mx-auto mt-5 max-w-3xl text-cream"
              style={{ fontSize: "clamp(2.2rem, 4.5vw, 4rem)" }}
            >
              Three useful starting points.
            </h1>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              {resumeThings.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="onboarding-card-reveal rounded-[1.35rem] border border-cream/32 bg-cream/[0.038] px-5 py-7 text-center text-cream transition duration-300 hover:-translate-y-1 hover:border-cream/52 hover:bg-cream/[0.055] sm:backdrop-blur-sm"
                    style={
                      {
                        "--card-delay": `${240 + index * 150}ms`
                      } as CSSProperties
                    }
                  >
                    <Icon
                      size={42}
                      strokeWidth={1.45}
                      className="mx-auto text-cream/74"
                      aria-hidden="true"
                    />
                    <p className="mt-5 text-2xl font-bold leading-none">{item.label}</p>
                    <p className="blueprint-label mt-3 text-cream/48">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div
              className="step-in mx-auto mt-8 w-full max-w-xl"
              style={
                {
                  "--step-delay": `${IDENTITY_PROGRESS_DELAY_MS}ms`
                } as CSSProperties
              }
            >
              <div
                className="mx-auto mb-4 flex h-7 items-center justify-center gap-1.5"
                aria-hidden="true"
              >
                {IDENTITY_DETAIL_WAVE.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="wave-bar w-1 rounded-full bg-cream/80"
                    style={{ height: `${height}%`, animationDelay: `${index * 68}ms` }}
                  />
                ))}
              </div>
              <p className="thinking-shimmer blueprint-label text-cream/45">
                Moving to resume details
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-cream/16">
                <span
                  className="identity-progress-line block h-full rounded-full bg-cream/78"
                  style={
                    {
                      "--identity-progress-delay": `${IDENTITY_PROGRESS_DELAY_MS}ms`,
                      "--identity-progress-duration": `${IDENTITY_PROGRESS_DURATION_MS}ms`
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
