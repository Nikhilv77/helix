"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { InterviewSignal, TrailgradMark } from "@/components/brand/blueprint-art";
import { Counter, Reveal, useInView } from "./visuals/reveal";

const proofStats = [
  { value: 100, label: "Ready" },
  { value: 4, label: "Steps" },
  { value: 1, label: "Next move" }
];

const prepSteps = [
  {
    label: "Upload",
    detail: "Your resume becomes the source. Projects, tools, and key points come into view.",
    visual: "upload"
  },
  {
    label: "Map",
    detail: "Trailgrad orders the path around the interviews you are preparing for.",
    visual: "map"
  },
  {
    label: "Learn",
    detail: "Each card opens one pattern, one explanation, and one thing to practice.",
    visual: "learn"
  },
  {
    label: "Answer",
    detail: "When you are ready, Maya turns the prep into questions you can answer.",
    visual: "defend"
  }
] as const;

export function LearningPath() {
  return (
    <section
      id="learn"
      className="marketing-theme-learning relative z-10 min-h-screen overflow-hidden px-5 py-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-20 h-[26rem] w-[32rem] -translate-x-1/2 text-[color:var(--dm-accent-soft)] opacity-10 sm:h-[30rem] sm:w-[40rem]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060708]/80 to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute -right-20 bottom-20 h-80 w-80 rounded-full border border-cream/10" />
      <ProjectSidePatterns />

      <div className="relative mx-auto flex w-full max-w-[72rem] flex-col items-center">
        <Reveal>
          <span className="theme-accent-pill inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 backdrop-blur-sm">
            <TrailgradMark className="h-3.5 w-3.5 text-[color:var(--dm-accent-soft)]" />
            <span className="blueprint-label whitespace-nowrap text-cream/80">
              Built from your resume
            </span>
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h2
            className="display-heading mt-6 w-full max-w-4xl text-center text-cream"
            style={{ fontSize: "clamp(2.15rem, 4.8vw, 4.25rem)" }}
          >
            <span className="marketing-text-reveal">Prep that feels like practice.</span>
          </h2>
        </Reveal>

        <Reveal delay={170}>
          <p className="mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-cream/76 sm:text-xl">
            A simple path from resume to live interview. No clutter, no endless list of random
            prompts.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <SimplePrepPath />
        </Reveal>

        <Reveal delay={360}>
          <dl className="mt-14 grid w-full max-w-3xl grid-cols-3 gap-6 border-t border-cream/15 pt-8 text-center">
            {proofStats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Counter
                    value={stat.value}
                    className="wordmark block text-4xl text-cream sm:text-6xl"
                  />
                  <span className="blueprint-label mt-3 block text-cream/50">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function ProjectSidePatterns() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "0px 0px -10% 0px");
  const [desktop, setDesktop] = useState(false);
  const active = desktop && inView;
  const percent = useCountUp(100, active);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden sm:block"
    >
      <svg
        className="absolute left-4 top-[46%] h-28 w-28 text-cream opacity-45 sm:left-[8%] sm:h-36 sm:w-36 lg:top-[43%] xl:h-48 xl:w-48 xl:opacity-60"
        viewBox="0 0 160 160"
        fill="none"
      >
        <circle cx="80" cy="80" r="54" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle
          cx="80"
          cy="80"
          r="54"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
          className="origin-center -rotate-90 transition-[stroke-dashoffset] duration-75 ease-linear"
        />
        <circle cx="80" cy="80" r="64" stroke="currentColor" strokeOpacity="0.18" />
        <text
          x="80"
          y="88"
          textAnchor="middle"
          className="fill-current font-mono text-[26px] font-semibold"
        >
          {percent}%
        </text>
      </svg>

      <svg
        className="absolute right-3 top-[50%] h-28 w-36 text-cream opacity-38 sm:right-[8%] sm:h-36 sm:w-44 lg:top-[46%] xl:h-52 xl:w-64 xl:opacity-55"
        viewBox="0 0 240 180"
        fill="none"
      >
        <path d="M28 146H214" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
        <path d="M28 36V146" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
        {[62, 96, 130, 164, 198].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1="146"
            y2="142"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1.5"
          />
        ))}
        <path
          className={active ? "prep-j-curve" : ""}
          d="M32 136C72 138 95 130 116 111C138 91 146 60 168 52C189 44 202 32 218 18"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {active ? (
          <circle className="prep-j-dot" r="5" fill="currentColor">
            <animateMotion
              dur="7s"
              fill="freeze"
              repeatCount="1"
              path="M32 136C72 138 95 130 116 111C138 91 146 60 168 52C189 44 202 32 218 18"
            />
          </circle>
        ) : null}
      </svg>
    </div>
  );
}

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      setValue(target);
      return;
    }

    const duration = 9000;
    const start = window.performance.now();

    const timer = window.setInterval(() => {
      const elapsed = window.performance.now() - start;
      const linear = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - linear, 3);
      setValue(Math.round(target * eased));

      if (linear >= 1) {
        window.clearInterval(timer);
      }
    }, 90);

    return () => window.clearInterval(timer);
  }, [active, target]);

  return value;
}

function SimplePrepPath() {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, "0px 0px -18% 0px");

  return (
    <div className="mt-12 w-full max-w-6xl">
      <div
        ref={stageRef}
        className="prep-stack-stage relative mx-auto grid gap-4 lg:flex lg:min-h-[24rem] lg:items-center lg:justify-center lg:gap-0"
      >
        {prepSteps.map((step, index) => {
          const revealed = inView;
          const entryX = [-26, 22, -18, 24][index];

          return (
            <article
              key={step.label}
              className={[
                "relative min-h-[18rem] w-[min(23rem,calc(100vw-3rem))] overflow-hidden rounded-[2rem] p-5 text-left transition-[transform,opacity,border-color,background-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:backdrop-blur-sm lg:w-64",
                "prep-stack-card",
                revealed
                  ? "border-cream/80 bg-cream/[0.055] opacity-100"
                  : "border-cream/34 bg-cream/[0.018] opacity-45"
              ].join(" ")}
              style={
                {
                  "--stack-margin-left": index === 0 ? "0rem" : revealed ? "1rem" : "-7.5rem",
                  "--stack-transform": revealed
                    ? "translateY(0) scale(1)"
                    : `translate(${entryX}px, ${index * 1.35}rem) scale(${0.94 - index * 0.012})`,
                  "--stack-mobile-transform": revealed
                    ? "translateY(0) scale(1)"
                    : `translate(${entryX}px, 1.2rem) scale(0.975)`,
                  zIndex: revealed ? prepSteps.length + index : prepSteps.length - index
                } as CSSProperties
              }
            >
              <span
                aria-hidden="true"
                className={[
                  "absolute inset-x-0 top-0 h-px origin-left bg-cream/70 transition-transform duration-1000 ease-out",
                  revealed ? "scale-x-100" : "scale-x-0"
                ].join(" ")}
              />
              <span
                aria-hidden="true"
                className={[
                  "absolute -right-10 -top-10 h-28 w-28 rounded-full border border-cream/10 transition-[opacity,transform] duration-700",
                  revealed ? "scale-100 opacity-100" : "scale-75 opacity-0"
                ].join(" ")}
              />
              <BackgroundVisual
                kind={step.visual}
                className={[
                  "pointer-events-none absolute right-5 top-5 h-24 w-28 text-cream transition-[opacity,transform] duration-700",
                  revealed ? "scale-100 opacity-[0.2]" : "scale-75 opacity-0"
                ].join(" ")}
              />

              <div
                className={[
                  "relative z-10 flex min-h-[14.5rem] flex-col items-start justify-center px-2 py-6 transition-[opacity,transform] duration-700",
                  revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-55"
                ].join(" ")}
              >
                <span className="blueprint-label mb-5 text-cream/42">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="display-heading min-h-[3.05rem] text-[2.7rem] text-cream sm:text-[3.05rem]">
                  <span className={revealed ? "marketing-text-reveal" : "opacity-0"}>
                    {step.label}
                  </span>
                </h3>
                <p
                  className={[
                    "mt-5 min-h-[6.25rem] w-full max-w-[14.75rem] text-[1.05rem] font-medium leading-7 text-cream/70 transition-[opacity,transform] duration-500 sm:text-[1.1rem]",
                    revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  ].join(" ")}
                >
                  <span
                    className={
                      revealed ? "marketing-text-reveal marketing-text-reveal-delayed" : ""
                    }
                  >
                    {step.detail}
                  </span>
                </p>
              </div>

              {!revealed ? (
                <span className="absolute left-1/2 top-5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-cream/18" />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BackgroundVisual({
  kind,
  className
}: {
  kind: (typeof prepSteps)[number]["visual"];
  className: string;
}) {
  if (kind === "upload") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 220 180" fill="none">
        <path
          d="M72 35h50l25 25v83H72V35Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
        <path d="M122 35v26h25" stroke="currentColor" strokeWidth="2" strokeOpacity="0.65" />
        {[78, 94, 110, 126].map((y, index) => (
          <path
            key={y}
            d={`M91 ${y}h${index === 1 ? 48 : 68}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.42"
          />
        ))}
        <path
          d="M38 88c22-18 49-17 73 0s51 18 73 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.34"
        />
        <circle cx="45" cy="82" r="4" fill="currentColor" fillOpacity="0.5" />
        <circle cx="177" cy="95" r="4" fill="currentColor" fillOpacity="0.5" />
      </svg>
    );
  }

  if (kind === "map") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 220 180" fill="none">
        <path
          d="M55 130C84 130 82 88 111 89c28 0 22-40 55-40"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeOpacity="0.48"
        />
        <path
          d="M55 130C84 130 82 88 111 89c28 0 22-40 55-40"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        {[55, 111, 166].map((x, index) => (
          <circle
            key={x}
            cx={x}
            cy={[130, 89, 49][index]}
            r="12"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeOpacity="0.75"
          />
        ))}
        <path
          d="M42 55c24-9 45-10 63-3m29 84c16-2 31-8 44-19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="5 8"
          strokeOpacity="0.36"
        />
      </svg>
    );
  }

  if (kind === "learn") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 220 180" fill="none">
        <rect
          x="55"
          y="54"
          width="88"
          height="78"
          rx="14"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.62"
          transform="rotate(-8 99 93)"
        />
        <rect
          x="82"
          y="43"
          width="88"
          height="78"
          rx="14"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.82"
          transform="rotate(7 126 82)"
        />
        <path
          d="M102 77h42M101 93h50M100 109h34"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.38"
        />
        <circle cx="75" cy="56" r="4" fill="currentColor" fillOpacity="0.5" />
        <circle cx="166" cy="123" r="3" fill="currentColor" fillOpacity="0.38" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 220 180" fill="none">
      <rect
        x="47"
        y="55"
        width="126"
        height="74"
        rx="28"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.78"
      />
      <path
        d="M78 92h4m13-16v32m17-46v60m17-38v16m17-26v36"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M40 92c10-23 23-36 40-41m100 41c-10-23-23-36-40-41M40 92c10 23 23 36 40 41m100-41c-10 23-23 36-40 41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
    </svg>
  );
}
