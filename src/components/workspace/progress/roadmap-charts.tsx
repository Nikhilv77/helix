"use client";

import type { ReactNode } from "react";
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
      className="relative hidden overflow-hidden rounded-[1.45rem] bg-[#3557b4] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(239,232,214,0.07),0_24px_58px_-44px_rgba(4,12,45,0.9)] xl:flex xl:self-start"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
        <span className="blueprint-grid absolute inset-0" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(22rem_14rem_at_72%_0%,rgba(143,188,255,0.2),transparent_70%),radial-gradient(18rem_12rem_at_18%_100%,rgba(139,230,189,0.12),transparent_72%)]"
      />

      <div className="relative z-10 grid w-full gap-3">
        <ChartBlock
          background={analyticsImages.mix}
          className="grid min-h-[14.75rem] place-items-center p-4"
        >
          <div className="relative grid h-36 w-36 place-items-center rounded-full bg-[#0e286c]/42 shadow-[0_20px_40px_-28px_rgba(4,12,45,0.9)]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from -90deg, #8be6bd 0deg ${progressDegrees}deg, #efe8d6 ${progressDegrees}deg 360deg)`
              }}
            />
            <div className="absolute inset-[0.72rem] rounded-full bg-[#254ca7] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_16px_26px_rgba(12,35,96,0.25)]" />
            <div className="absolute inset-[1.55rem] rounded-full bg-[#1f459b]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
            <span className="relative z-10 text-3xl font-semibold tabular-nums leading-none text-cream drop-shadow-[0_2px_14px_rgba(4,12,45,0.55)]">
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
            tone="sky"
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
            tone="blue"
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
      className={`relative overflow-hidden rounded-xl bg-[#2a4aa0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_38px_-28px_rgba(4,12,45,0.82)] ${className}`}
    >
      {background ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 z-0 bg-cover bg-center opacity-82 saturate-[0.62] brightness-[1.36]"
            style={{ backgroundImage: `url(${background})` }}
          />
          <span
            aria-hidden
            className="absolute inset-0 z-0 bg-[linear-gradient(115deg,rgba(50,91,185,0.52)_0%,rgba(126,169,235,0.42)_48%,rgba(25,62,150,0.56)_100%),radial-gradient(18rem_12rem_at_35%_35%,rgba(224,240,255,0.44),transparent_72%)]"
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
  tone: "mint" | "sky" | "gold" | "blue";
}) {
  const toneMap = {
    mint: {
      icon: "bg-[#8be6bd]/18 text-[#a9f0d0]",
      dot: "#8be6bd"
    },
    sky: {
      icon: "bg-[#9fc7ff]/18 text-[#cfe7ff]",
      dot: "#9fc7ff"
    },
    gold: {
      icon: "bg-[#f4c65a]/18 text-[#f8dda0]",
      dot: "#f4c65a"
    },
    blue: {
      icon: "bg-[#dcecff]/14 text-[#cfe7ff]",
      dot: "#9fc7ff"
    }
  }[tone];

  return (
    <div className="relative grid min-h-[10.5rem] overflow-hidden rounded-xl bg-[#456dca] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_34px_-28px_rgba(4,12,45,0.8)]">
      <span
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center opacity-100 saturate-[0.64] brightness-[1.48]"
        style={{ backgroundImage: `url(${background})` }}
      />
      <span
        aria-hidden
        className="absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(220,238,255,0.5)_0%,rgba(126,169,235,0.43)_43%,rgba(25,62,150,0.54)_100%)]"
      />
      <span
        aria-hidden
        className="absolute inset-0 z-0 bg-[radial-gradient(13rem_8rem_at_50%_38%,rgba(236,246,255,0.34),transparent_72%)]"
      />

      <div className="relative z-10 flex items-start justify-between">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${toneMap.icon}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_16px_rgba(191,226,255,0.58)]"
          style={{ backgroundColor: toneMap.dot }}
        />
      </div>

      <div className="relative z-10 self-center text-center">
        <p className="text-4xl font-semibold tabular-nums leading-none text-cream drop-shadow-[0_2px_14px_rgba(4,12,45,0.55)]">
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
