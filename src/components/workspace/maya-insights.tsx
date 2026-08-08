import Link from "next/link";
import { AlertTriangle, ArrowRight, Flame, Sparkles, Target, Waypoints } from "lucide-react";
import type { FrontendRoadmapInsight } from "@/lib/roadmap";

/**
 * Maya's read on the path, loaded from persisted user-specific roadmap
 * insights. Step 7 will make the same rows adapt after each question attempt.
 */
export function MayaInsights({ insights }: { insights: FrontendRoadmapInsight[] }) {
  if (insights.length === 0) return null;

  const primaryCta =
    insights.find((insight) => insight.ctaHref && insight.ctaLabel) ??
    insights.find((insight) => insight.ctaHref);

  return (
    <aside className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-[#2a4aa0] p-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#8be6bd]/[0.07] blur-3xl"
      />

      <header className="relative flex items-center gap-3 border-b border-cream/[0.09] pb-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream text-[#254294]">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-cream">
            Maya&apos;s insights
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-cream/45">
            Tuned to your roadmap progress
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#8be6bd]/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a9f0d0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8be6bd]" />
          Live
        </span>
      </header>

      <div className="relative mt-4 grid gap-2.5">
        {insights.map((insight) => {
          const visual = insightVisual(insight.kind);
          return (
            <InsightRow
              key={insight.id}
              icon={visual.icon}
              accent={visual.accent}
              label={insight.title}
            >
              <p className="text-[14px] font-medium leading-[1.45] text-cream/80">{insight.body}</p>
              {insight.evidenceLabel ? (
                <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-cream/[0.07] px-2 py-1 text-[12px] font-medium text-cream/50">
                  <Waypoints size={11} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{insight.evidenceLabel}</span>
                </span>
              ) : null}
            </InsightRow>
          );
        })}
      </div>

      {primaryCta?.ctaHref ? (
        <div className="relative mt-auto pt-5">
          <Link
            href={primaryCta.ctaHref}
            className="group flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-4 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="min-w-0 truncate">{primaryCta.ctaLabel ?? "Start practice"}</span>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      ) : null}
    </aside>
  );
}

function insightVisual(kind: FrontendRoadmapInsight["kind"]): {
  icon: React.ReactNode;
  accent: string;
} {
  if (kind === "NEXT_PRIORITY") {
    return {
      icon: <Target size={15} aria-hidden="true" />,
      accent: "bg-[#a9d5ff]/14 text-[#a9d5ff]"
    };
  }

  if (kind === "COMMON_TRAP") {
    return {
      icon: <AlertTriangle size={15} aria-hidden="true" />,
      accent: "bg-[#f4d58b]/14 text-[#f4d58b]"
    };
  }

  if (kind === "STRONG_SIGNAL" || kind === "RECOMMENDED_ACTION") {
    return {
      icon: <Sparkles size={15} aria-hidden="true" />,
      accent: "bg-[#8be6bd]/14 text-[#8be6bd]"
    };
  }

  return {
    icon: <Flame size={15} aria-hidden="true" />,
    accent: "bg-cream/[0.08] text-cream/45"
  };
}

function InsightRow({
  icon,
  accent,
  label,
  children
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-[#24439b] p-3.5 transition hover:bg-[#27479f]">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${accent}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/42">
          {label}
        </p>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}
