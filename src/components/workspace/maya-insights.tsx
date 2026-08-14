import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Flame,
  Lightbulb,
  Target,
  Waypoints
} from "lucide-react";
import type { FrontendRoadmapInsight } from "@/lib/roadmap";

/**
 * Maya's read on the path, loaded from persisted user-specific roadmap
 * insights. Step 7 will make the same rows adapt after each question attempt.
 */
export function MayaInsights({ insights }: { insights: FrontendRoadmapInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="identity-stage-in relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-b from-[#fff8e8] to-[#e5dcc3] p-4 text-[#171a16] sm:p-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-44 w-44 rounded-full bg-[#3657b4]/[0.06] blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-8 h-44 w-44 rounded-full bg-white/40 blur-3xl"
      />

      <header className="relative z-10 mb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[1.14rem] font-medium leading-tight tracking-tight text-[#171a16]">
            Maya&apos;s insights
          </p>
          <p className="mt-1 text-[0.92rem] font-normal leading-5 text-[#6f716a]">
            Tuned to your roadmap progress
          </p>
        </div>
      </header>

      <div className="relative z-10 grid min-w-0 gap-3">
        {insights.map((insight, index) => {
          const visual = insightVisual(insight.kind);
          return <InsightCard key={insight.id} insight={insight} visual={visual} index={index} />;
        })}
      </div>
    </section>
  );
}

function insightVisual(kind: FrontendRoadmapInsight["kind"]): {
  Icon: LucideIcon;
  accent: string;
  glow: string;
} {
  if (kind === "NEXT_PRIORITY") {
    return {
      Icon: Target,
      accent: "text-[#171a16]/76",
      glow: "bg-[#8be6bd]/16"
    };
  }

  if (kind === "COMMON_TRAP") {
    return {
      Icon: AlertTriangle,
      accent: "text-[#171a16]/76",
      glow: "bg-[#8be6bd]/16"
    };
  }

  if (kind === "STRONG_SIGNAL") {
    return {
      Icon: BadgeCheck,
      accent: "text-[#171a16]/76",
      glow: "bg-[#8be6bd]/16"
    };
  }

  if (kind === "RECOMMENDED_ACTION") {
    return {
      Icon: Lightbulb,
      accent: "text-[#171a16]/76",
      glow: "bg-[#8be6bd]/16"
    };
  }

  return {
    Icon: Flame,
    accent: "text-[#171a16]/76",
    glow: "bg-[#8be6bd]/16"
  };
}

function InsightCard({
  insight,
  visual,
  index
}: {
  insight: FrontendRoadmapInsight;
  visual: ReturnType<typeof insightVisual>;
  index: number;
}) {
  const Icon = visual.Icon;

  return (
    <article
      className="onboarding-card-reveal group relative min-h-[6.75rem] overflow-hidden rounded-[1rem] border border-[#171a16]/[0.07] bg-[#dcefd7]/72 p-3.5 transition-[border-color,transform,filter] duration-300 hover:-translate-y-0.5 hover:border-[#171a16]/[0.13] hover:brightness-[1.02]"
      style={{
        "--card-delay": `${index * 85}ms`
      } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-14 -top-14 h-28 w-28 rounded-full ${visual.glow} blur-2xl`}
      />
      <div className="relative z-10 flex h-full min-w-0 gap-3">
        <Icon
          size={23}
          strokeWidth={1.65}
          className={`mt-0.5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 ${visual.accent}`}
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0 pr-2">
            <p className="text-[0.82rem] font-medium leading-4 text-[#171a16]/82 transition-transform duration-300 group-hover:translate-x-0.5">
              {insight.title}
            </p>
            <p className="mt-1 text-[0.82rem] font-normal leading-[1.35] tracking-normal text-[#6f716a] transition-transform duration-300 group-hover:translate-x-0.5">
              {insight.body}
            </p>
          </div>

          <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-3">
            {insight.evidenceLabel ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#171a16]/[0.055] px-2.5 py-1 text-[11px] font-normal text-[#6f716a]">
                <Waypoints size={10} aria-hidden="true" className="shrink-0 text-[#171a16]/58" />
                <span className="truncate">{insight.evidenceLabel}</span>
              </span>
            ) : null}

            {insight.ctaHref ? (
              <Link
                href={insight.ctaHref}
                className="browse-nudge group/link ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#171a16]/[0.055] px-2.5 py-1 text-[11px] font-normal text-[#171a16]/70 transition hover:bg-[#171a16] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171a16]/25"
              >
                <span>{insight.ctaLabel ?? "Start practice"}</span>
                <ArrowRight
                  size={11}
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover/link:translate-x-0.5"
                />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
