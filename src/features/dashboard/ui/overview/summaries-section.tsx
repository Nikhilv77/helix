import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowRight, FileText, HandHelping } from "lucide-react";
import type {
  DashboardExplore,
  DashboardProgressSummary,
  DashboardReportsSummary,
  DashboardTrailmateSummary
} from "@/features/dashboard/contracts/dashboard-overview";

export function SummariesSection({ data }: { data: DashboardExplore }) {
  return (
    <section
      aria-label="Progress and community"
      className="dashboard-deferred-row dashboard-deferred-row-summary mt-5 grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5"
    >
      <ProgressSummaryCard progress={data.progress} />
      <ReportsSummaryCard reports={data.reports} />
      <TrailmateSummaryCard trailmate={data.trailmate} />
    </section>
  );
}

function ProgressSummaryCard({ progress }: { progress: DashboardProgressSummary }) {
  const status =
    progress.state === "active"
      ? progress.streakDays > 0
        ? `${progress.streakDays}-day rhythm`
        : "Path in motion"
      : progress.state === "empty"
        ? "Ready to begin"
        : "Unavailable";
  const activeDays = progress.recentActivity.filter((value) => value > 0).length;
  const progressPercent = Math.min(100, Math.max(0, progress.progressPercent));

  return (
    <article
      aria-label="Progress summary"
      className="flex min-h-[13.25rem] min-w-0 flex-col rounded-[1.5rem] bg-[#17181b] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <CardLabel icon={<Activity size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Progress
        </CardLabel>
        <StatusPill>{status}</StatusPill>
      </div>

      <h2 className="mt-4 text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
        {progress.title}
      </h2>
      <p className="mt-2 max-w-[29rem] text-[14px] leading-6 text-cream/55">{progress.detail}</p>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12px] text-cream/45">Practice path</span>
          <span className="text-[14px] font-semibold tabular-nums text-cream/80">
            {progress.state === "unavailable" ? "—" : `${progressPercent}%`}
          </span>
        </div>
        <div className="dashboard-progress-track mt-2 h-1.5 overflow-hidden rounded-full bg-cream/[0.06]">
          <span
            className="block h-full rounded-full bg-[var(--workspace-accent)]"
            style={{ width: `${progress.state === "unavailable" ? 0 : progressPercent}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-4">
          <ActivityDots values={progress.recentActivity} activeDays={activeDays} />
          <SummaryAction href={progress.actionHref} label="View progress" />
        </div>
      </div>
    </article>
  );
}

function ReportsSummaryCard({ reports }: { reports: DashboardReportsSummary }) {
  return (
    <article
      aria-label="Reports summary"
      className="flex min-h-[13.25rem] min-w-0 flex-col rounded-[1.5rem] bg-[#17181b] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <CardLabel icon={<FileText size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Reports
        </CardLabel>
        <StatusPill>
          {reports.state === "available"
            ? "Report ready"
            : reports.state === "empty"
              ? "Awaiting evidence"
              : "Unavailable"}
        </StatusPill>
      </div>

      <h2 className="mt-4 text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
        {reports.title}
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-cream/55">{reports.detail}</p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-4">
        <div className="flex min-w-0 items-end gap-8">
          <Metric
            label="Latest signal"
            value={reports.latestScore === null ? "Waiting" : `${reports.latestScore}%`}
          />
          <Metric
            label="Scored rounds"
            value={reports.completedRounds > 0 ? String(reports.completedRounds) : "None yet"}
          />
        </div>
        <SummaryAction href={reports.actionHref} label="View reports" />
      </div>
    </article>
  );
}

function TrailmateSummaryCard({ trailmate }: { trailmate: DashboardTrailmateSummary }) {
  return (
    <article
      aria-label="Trailmate summary"
      className="flex min-h-[13.25rem] min-w-0 flex-col rounded-[1.5rem] bg-[#17181b] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <CardLabel icon={<HandHelping size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Trailmate
        </CardLabel>
        {trailmate.state === "active" ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--workspace-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Active
          </span>
        ) : (
          <StatusPill>
            {trailmate.state === "new"
              ? "Community ready"
              : trailmate.state === "unavailable"
                ? "Unavailable"
                : "Your circle"}
          </StatusPill>
        )}
      </div>

      <h2 className="mt-4 text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
        {trailmate.title}
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-cream/55">{trailmate.detail}</p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-4">
        <div className="flex min-w-0 items-end gap-8">
          {trailmate.peopleHelped > 0 || trailmate.helpReceived > 0 ? (
            <>
              <Metric label="Helped" value={String(trailmate.peopleHelped)} />
              <Metric label="Supported by" value={String(trailmate.helpReceived)} />
            </>
          ) : (
            <Metric label="Peer support" value="Ready when you are" />
          )}
        </div>
        <SummaryAction href={trailmate.actionHref} label={trailmate.actionLabel} />
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

function StatusPill({ children }: { children: string }) {
  return <span className="shrink-0 text-right text-[12px] text-cream/40">{children}</span>;
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

function ActivityDots({ values, activeDays }: { values: number[]; activeDays: number }) {
  const opacity = ["bg-cream/[0.06]", "bg-cream/20", "bg-cream/30", "bg-cream/40", "bg-cream/55"];

  return (
    <div
      role="img"
      aria-label="Activity over the last seven days"
      className="flex min-w-0 items-center gap-2"
    >
      <span className="shrink-0 text-[12px] text-cream/42">
        {activeDays > 0
          ? `${activeDays} active ${activeDays === 1 ? "day" : "days"}`
          : "No activity yet"}
      </span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {values.slice(-7).map((value, index) => {
          const level = Math.min(4, Math.max(0, value));
          return <span key={index} className={`h-1.5 w-1.5 rounded-full ${opacity[level]}`} />;
        })}
      </span>
    </div>
  );
}

function SummaryAction({ href, label }: { href: string; label: string }) {
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
