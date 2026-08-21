"use client";

import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  BriefcaseBusiness,
  GraduationCap,
  Tags,
  Target
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  PRIMARY_BUTTON,
  SECONDARY_BUTTON
} from "@/components/onboarding/onboarding-data";
import { BackButton } from "@/components/onboarding/onboarding-ui";
import type { ResumeExtractionResponse } from "@/lib/types";

const IDENTITY_SUMMARY_MS = 3200;
const IDENTITY_FINAL_MS = 7600;
const IDENTITY_PROGRESS_DELAY_MS = 1450;
const IDENTITY_PROGRESS_DURATION_MS = 4300;
const IDENTITY_CONTINUE_MS =
  IDENTITY_FINAL_MS + IDENTITY_PROGRESS_DELAY_MS + IDENTITY_PROGRESS_DURATION_MS + 300;
const TRAIL_WORD_STAGGER_MS = 180;
const TRAIL_SKILL_STAGGER_MS = 150;
const TRAIL_FOCUS_STAGGER_MS = 280;
const AUTO_SCROLL_IDLE_MS = 2000;
const FINAL_AUTO_SCROLL_DELAY_MS = 180;
const IDENTITY_DETAIL_WAVE = [34, 58, 82, 48, 92, 56, 78, 44, 64];

function useWordReveal(text: string, active: boolean, delay = 0, stagger = TRAIL_WORD_STAGGER_MS) {
  const words = text.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;

    let interval = 0;
    const timer = window.setTimeout(() => {
      let index = 0;
      interval = window.setInterval(() => {
        index += 1;
        setVisibleCount(Math.min(index, words.length));
        if (index >= words.length) window.clearInterval(interval);
      }, stagger);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [active, delay, stagger, words.length]);

  return {
    words,
    visibleCount,
    done: active && visibleCount >= words.length
  };
}

function WordRevealLine({
  words,
  visibleCount,
  className
}: {
  words: string[];
  visibleCount: number;
  className: string;
}) {
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={[
            "trail-word mr-[0.24em] last:mr-0",
            index < visibleCount ? "trail-word-visible" : ""
          ].join(" ")}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

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
                        "--card-delay": `${240 + index * 150}ms`,
                        "--card-tilt": `${[-0.55, 0.25, 0.55][index]}deg`
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

export function ResumeEvidenceStep({
  result,
  onBack,
  onReplace,
  onContinue
}: {
  result: ResumeExtractionResponse;
  onBack: () => void;
  onReplace: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  const firstRole = extraction.experience[0];
  const firstProject = extraction.projects[0];
  const firstEducation = extraction.education[0];
  const detailCards = [
    {
      label: "Work",
      count: `${extraction.experience.length} ${
        extraction.experience.length === 1 ? "role" : "roles"
      }`,
      title: firstRole?.role || "Work timeline",
      detail: firstRole?.organization
        ? `${firstRole.organization}${firstRole.period ? ` · ${firstRole.period}` : ""}`
        : "No role listed yet. Maya will lean more on projects.",
      note: firstRole?.summary || "Roles and responsibilities pulled from the resume.",
      icon: BriefcaseBusiness,
      tilt: "-0.55deg"
    },
    {
      label: "Projects",
      count: `${extraction.projects.length} ${
        extraction.projects.length === 1 ? "project" : "projects"
      }`,
      title: firstProject?.name || "Project details",
      detail: firstProject ? "Practical work Maya can ask about." : "No named projects found.",
      note:
        firstProject?.outcome ||
        firstProject?.summary ||
        "Project work gives the round concrete systems and decisions to explore.",
      icon: Blocks,
      tilt: "0.25deg"
    },
    {
      label: "Education",
      count: `${extraction.education.length} ${
        extraction.education.length === 1 ? "entry" : "entries"
      }`,
      title: firstEducation?.credential || "Education",
      detail: firstEducation?.institution || "No education entry found.",
      note: firstEducation?.period
        ? `Timeline noted: ${firstEducation.period}.`
        : "Schools, programs, and credentials from your resume.",
      icon: GraduationCap,
      tilt: "0.55deg"
    }
  ];

  useEffect(() => {
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
  }, []);

  return (
    <div className="relative w-full">
      <div className="absolute left-0 top-0 z-10">
        <BackButton onClick={onBack} />
      </div>

      <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-6xl flex-col items-center justify-center pb-10 pt-16 text-center sm:mt-8 sm:min-h-[34rem] sm:py-0">
        <div className="identity-stage-in w-full">
          <p className="blueprint-label text-cream/45">Maya found your anchors</p>
          <h1
            className="identity-text-shine display-heading mx-auto mt-5 max-w-4xl text-cream"
            style={{ fontSize: "clamp(2.35rem, 4.7vw, 4.35rem)" }}
          >
            Three resume anchors.
          </h1>
        </div>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
          {detailCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="onboarding-card-reveal group flex min-h-[17.5rem] flex-col rounded-[1.35rem] border border-cream/28 bg-cream/[0.035] p-5 text-left text-cream shadow-[inset_0_1px_0_rgba(241,234,216,0.08)] backdrop-blur-[2px] transition duration-300 hover:-translate-y-1 hover:border-cream/45 hover:bg-cream/[0.05] sm:p-6"
                style={
                  {
                    "--card-delay": `${260 + index * 170}ms`,
                    "--card-tilt": item.tilt
                  } as CSSProperties
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <Icon
                    size={38}
                    strokeWidth={1.35}
                    className="text-cream/72 transition duration-300 group-hover:text-cream/88"
                    aria-hidden="true"
                  />
                  <span className="blueprint-label rounded-full border border-cream/18 px-3 py-1 text-cream/44">
                    {item.count}
                  </span>
                </div>

                <p className="blueprint-label mt-8 text-cream/42">{item.label}</p>
                <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-cream sm:text-[1.7rem]">
                  {item.title}
                </h2>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-cream/66">
                  {item.detail}
                </p>
                <p className="mt-auto pt-7 text-[15px] leading-7 text-cream/54">
                  {item.note}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className={`browse-nudge ${PRIMARY_BUTTON}`}
          >
            Continue <ArrowRight size={15} />
          </button>
          <button type="button" onClick={onReplace} className={SECONDARY_BUTTON}>
            Choose a different resume
          </button>
        </div>
      </section>
    </div>
  );
}

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
                  className="step-in rounded-lg border border-cream/18 px-3 py-1.5 text-[15px] font-semibold leading-7 text-cream/72 sm:text-base"
                  style={
                    {
                      "--step-delay": `${index * 24}ms`,
                      transform: `rotate(${[-1.1, 0.7, -0.45, 1, -0.8][index % 5]}deg)`
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
