import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Crosshair } from "lucide-react";
import { PracticeWeeklyActivityChart } from "@/components/workspace/shared/practice-weekly-activity-chart";
import type {
  DashboardDirection,
  DashboardNextFocus,
  DashboardWeeklyRhythm
} from "@/features/dashboard/contracts/dashboard-overview";

export function WeeklyDirectionSection({ data }: { data: DashboardDirection }) {
  return (
    <section
      aria-label="Weekly direction"
      className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)] lg:gap-5"
    >
      <WeeklyRhythmCard rhythm={data.rhythm} />
      <NextFocusCard focus={data.focus} />
    </section>
  );
}

function WeeklyRhythmCard({ rhythm }: { rhythm: DashboardWeeklyRhythm }) {
  const unavailable = rhythm.state === "unavailable";

  return (
    <article
      aria-label="Weekly practice rhythm"
      className="grid min-h-[14rem] min-w-0 overflow-hidden rounded-[1.65rem] bg-[#17181b] md:grid-cols-[minmax(16rem,0.88fr)_minmax(24rem,1.12fr)]"
    >
      <div className="flex min-w-0 flex-col p-5">
        <CardLabel icon={<CalendarDays size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Weekly rhythm
        </CardLabel>

        <h2 className="mt-4 max-w-[28rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          {rhythm.title}
        </h2>
        <p className="mt-2 max-w-[31rem] text-[14px] leading-6 text-cream/55">{rhythm.detail}</p>

        <div className="mt-5 flex items-end gap-8">
          <Metric label="Solved" value={unavailable ? "—" : String(rhythm.solved)} />
          <Metric label="Attempts" value={unavailable ? "—" : String(rhythm.attempts)} />
          <Metric label="Active days" value={unavailable ? "—" : `${rhythm.activeDays}/7`} />
        </div>

        <div className="mt-auto pt-4">
          <TextAction href={rhythm.actionHref} label="View full progress" />
        </div>
      </div>

      <div className="flex min-w-0 items-center px-5 pb-5 md:py-5 md:pl-2">
        <PracticeWeeklyActivityChart
          activity={rhythm.days}
          ariaLabel={
            unavailable
              ? "Seven-day practice activity unavailable"
              : `Seven-day practice activity: ${rhythm.solved} solved across ${rhythm.activeDays} active days`
          }
        />
      </div>
    </article>
  );
}

function NextFocusCard({ focus }: { focus: DashboardNextFocus }) {
  return (
    <article
      aria-label="Recommended next focus"
      className="flex min-h-[14rem] min-w-0 flex-col rounded-[1.65rem] bg-[#17181b] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <CardLabel icon={<Crosshair size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Next focus
        </CardLabel>
        <span className="text-right text-[12px] text-cream/40">{focus.sourceLabel}</span>
      </div>

      <h2 className="mt-4 text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
        {focus.title}
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-cream/55">{focus.detail}</p>

      {focus.itemLabel ? (
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] text-cream/42">Next question</p>
            <p className="mt-1 truncate text-[13.5px] font-semibold text-cream/76">
              {focus.itemLabel}
            </p>
          </div>
          {focus.supportingLabel ? (
            <p className="shrink-0 text-[12px] text-cream/42">{focus.supportingLabel}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
        {!focus.itemLabel && focus.supportingLabel ? (
          <p className="text-[12px] text-cream/42">{focus.supportingLabel}</p>
        ) : null}
        <PrimaryAction href={focus.actionHref} label={focus.actionLabel} />
      </div>
    </article>
  );
}

function CardLabel({ children, icon }: { children: string; icon: ReactNode }) {
  // A plain icon and a sentence-case name: no tile behind it, no caps.
  return (
    <div className="flex items-center gap-2 text-cream/50">
      {icon}
      <p className="text-[13px] font-medium text-cream/55">{children}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-cream/42">{label}</p>
      <p className="mt-0.5 truncate text-[1.15rem] font-semibold tabular-nums tracking-[-0.01em] text-cream/85">
        {value}
      </p>
    </div>
  );
}

function TextAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-cream/68 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
    >
      {label}
      <ArrowRight
        size={13}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function PrimaryAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group ml-auto inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-cream px-3.5 text-[13px] font-semibold text-[#191a1d] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181b]"
    >
      {label}
      <ArrowRight
        size={14}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
