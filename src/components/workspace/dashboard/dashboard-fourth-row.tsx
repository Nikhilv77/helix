import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Crosshair } from "lucide-react";
import { PracticeWeeklyActivityChart } from "@/components/workspace/shared/practice-weekly-activity-chart";
import type {
  DashboardDirection,
  DashboardNextFocus,
  DashboardWeeklyRhythm
} from "@/lib/dashboard/dashboard-overview";

export function DashboardFourthRow({ data }: { data: DashboardDirection }) {
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
        <RowLabel icon={<CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />}>
          Weekly rhythm
        </RowLabel>

        <h2 className="mt-4 max-w-[28rem] text-[1.4rem] font-semibold leading-tight tracking-[-0.03em] text-cream">
          {rhythm.title}
        </h2>
        <p className="mt-1.5 max-w-[31rem] text-[13px] leading-[1.55] text-cream/52">
          {rhythm.detail}
        </p>

        <div className="mt-4 flex items-end gap-6">
          <RhythmMetric label="Solved" value={unavailable ? "—" : String(rhythm.solved)} />
          <RhythmMetric label="Attempts" value={unavailable ? "—" : String(rhythm.attempts)} />
          <RhythmMetric label="Active days" value={unavailable ? "—" : `${rhythm.activeDays}/7`} />
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
        <RowLabel icon={<Crosshair size={18} strokeWidth={1.8} aria-hidden="true" />}>
          Next focus
        </RowLabel>
        <span className="text-right text-[9px] font-semibold uppercase tracking-[0.12em] text-cream/28">
          {focus.sourceLabel}
        </span>
      </div>

      <h2 className="mt-4 text-[1.4rem] font-semibold leading-tight tracking-[-0.03em] text-cream">
        {focus.title}
      </h2>
      <p className="mt-2 text-[13px] leading-[1.55] text-cream/54">{focus.detail}</p>

      {focus.itemLabel ? (
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-cream/28">
              Next question
            </p>
            <p className="mt-1 truncate text-[13.5px] font-semibold text-cream/76">
              {focus.itemLabel}
            </p>
          </div>
          {focus.supportingLabel ? (
            <p className="shrink-0 text-[11px] font-medium text-cream/38">
              {focus.supportingLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
        {!focus.itemLabel && focus.supportingLabel ? (
          <p className="text-[11px] font-medium text-cream/38">{focus.supportingLabel}</p>
        ) : null}
        <PrimaryAction href={focus.actionHref} label={focus.actionLabel} />
      </div>
    </article>
  );
}

function RowLabel({ children, icon }: { children: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream/[0.055] text-cream/66">
        {icon}
      </span>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-cream/40">
        {children}
      </p>
    </div>
  );
}

function RhythmMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cream/26">{label}</p>
      <p className="mt-1 font-mono text-[14px] font-semibold text-cream/72">{value}</p>
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
