"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Boxes, ListChecks, Target, Timer } from "lucide-react";

const analyticsImages = {
  mix: "/images/analytics-cards/mix-dashboard.png",
  chapters: "/images/analytics-cards/chapters-map.png",
  questions: "/images/analytics-cards/questions-bank.png",
  practice: "/images/analytics-cards/practice-time.png",
  complete: "/images/analytics-cards/completion-progress.png"
};

export function RoadmapCharts({
  totalChapters,
  totalQuestions,
  totalHours,
  overallProgress,
  questionMix
}: {
  totalChapters: number;
  totalQuestions: number;
  totalHours: number;
  overallProgress: number;
  questionMix: { easy: number; medium: number; hard: number };
}) {
  const progressDegrees = Math.max(overallProgress, 2) * 3.6;

  return (
    <aside
      aria-label="Frontend practice charts"
      className="relative hidden overflow-hidden rounded-[1.45rem] bg-[#151619] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(239,232,214,0.07),0_24px_58px_-44px_rgba(0,0,0,0.82)] xl:flex xl:self-start"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
        <span className="blueprint-grid absolute inset-0" />
      </div>
      <div
        aria-hidden
        className="workspace-accent-progress-wash pointer-events-none absolute inset-0"
      />

      <div className="relative z-10 grid w-full gap-3">
        <ChartBlock
          background={analyticsImages.mix}
          className="grid min-h-[14.75rem] place-items-center p-4"
        >
          <div className="relative grid h-36 w-36 place-items-center rounded-full bg-[#17181b]/70 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.82)]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from -90deg, #8be6bd 0deg ${progressDegrees}deg, #efe8d6 ${progressDegrees}deg 360deg)`
              }}
            />
            <div className="absolute inset-[0.72rem] rounded-full bg-[#202124] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_16px_26px_rgba(0,0,0,0.25)]" />
            <div className="absolute inset-[1.55rem] rounded-full bg-[#17181b]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
            <span className="relative z-10 text-3xl font-semibold tabular-nums leading-none text-cream drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
              {overallProgress}%
            </span>
          </div>
        </ChartBlock>

        <div className="grid grid-cols-2 gap-3">
          <AnalyticsCard
            icon={Boxes}
            value={totalChapters}
            label="Chapters"
            detail="12-part track"
            background={analyticsImages.chapters}
            tone="mint"
          />
          <AnalyticsCard
            icon={ListChecks}
            value={totalQuestions}
            label="Questions"
            detail="curated bank"
            background={analyticsImages.questions}
            tone="orange"
          />
          <AnalyticsCard
            icon={Timer}
            value={`~${totalHours}h`}
            label="Practice"
            detail="guided reps"
            background={analyticsImages.practice}
            tone="gold"
          />
          <AnalyticsCard
            icon={Target}
            value={`${overallProgress}%`}
            label="Complete"
            detail={`${questionMix.easy}/${questionMix.medium}/${questionMix.hard}`}
            background={analyticsImages.complete}
            tone="cream"
          />
        </div>
      </div>
    </aside>
  );
}

function ChartBlock({
  children,
  className = "",
  background
}: {
  children: ReactNode;
  className?: string;
  background?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#1b1d20] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_38px_-28px_rgba(0,0,0,0.82)] ${className}`}
    >
      {background ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 z-0 bg-cover bg-center opacity-50 saturate-0 brightness-[1.1]"
            style={{ backgroundImage: `url(${background})` }}
          />
          <span
            aria-hidden
            className="workspace-accent-progress-overlay absolute inset-0 z-0"
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function AnalyticsCard({
  icon: Icon,
  value,
  label,
  detail,
  background,
  tone
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  detail: string;
  background: string;
  tone: "mint" | "orange" | "gold" | "cream";
}) {
  const toneMap = {
    mint: {
      icon: "bg-[#8be6bd]/18 text-[#a9f0d0]",
      dot: "#8be6bd"
    },
    orange: {
      icon: "bg-[#F26E01]/16 text-[#ffbd8f]",
      dot: "var(--workspace-accent)"
    },
    gold: {
      icon: "bg-[#f4c65a]/18 text-[#f8dda0]",
      dot: "#f4c65a"
    },
    cream: {
      icon: "bg-cream/[0.12] text-cream",
      dot: "#f1ead8"
    }
  }[tone];

  return (
    <div className="relative grid min-h-[10.5rem] overflow-hidden rounded-xl bg-[#202124] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_34px_-28px_rgba(0,0,0,0.8)]">
      <span
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center opacity-58 saturate-0 brightness-[1.16]"
        style={{ backgroundImage: `url(${background})` }}
      />
      <span
        aria-hidden
        className="workspace-accent-progress-card-overlay absolute inset-0 z-0"
      />
      <span
        aria-hidden
        className="absolute inset-0 z-0 bg-[radial-gradient(13rem_8rem_at_50%_38%,rgba(241,234,216,0.12),transparent_72%)]"
      />

      <div className="relative z-10 flex items-start justify-between">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${toneMap.icon}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span
          className="workspace-chart-dot h-2.5 w-2.5 rounded-full"
          style={{ "--chart-dot": toneMap.dot } as CSSProperties}
        />
      </div>

      <div className="relative z-10 self-center text-center">
        <p className="text-4xl font-semibold tabular-nums leading-none text-cream drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
          {value}
        </p>
        <p className="mt-2 text-base font-semibold text-cream">{label}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.11em] text-cream/50">
          {detail}
        </p>
      </div>
    </div>
  );
}
