import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowRight, FileText, HandHelping } from "lucide-react";
import type {
  DashboardExplore,
  DashboardProgressSummary,
  DashboardReportsSummary,
  DashboardTrailmateSummary
} from "@/lib/dashboard/dashboard-overview";

export function DashboardThirdRow({ data }: { data: DashboardExplore }) {
  return (
    <section
      aria-label="Progress and community"
      className="mt-5 grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5"
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
        <SummaryLabel icon={<Activity size={17} strokeWidth={1.8} aria-hidden="true" />}>
          Progress
        </SummaryLabel>
        <StatusPill>{status}</StatusPill>
      </div>

      <h2 className="mt-4 text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-cream">
        {progress.title}
      </h2>
      <p className="mt-2 max-w-[29rem] text-[12.5px] leading-5 text-cream/46">{progress.detail}</p>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10.5px] font-medium text-cream/38">Practice path</span>
          <span className="font-mono text-[11.5px] font-semibold text-cream/64">
            {progress.state === "unavailable" ? "—" : `${progressPercent}%`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/[0.06]">
          <span
            className="block h-full rounded-full bg-cream/45"
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
        <SummaryLabel icon={<FileText size={17} strokeWidth={1.8} aria-hidden="true" />}>
          Reports
        </SummaryLabel>
        <StatusPill>
          {reports.state === "available"
            ? "Report ready"
            : reports.state === "empty"
              ? "Awaiting evidence"
              : "Unavailable"}
        </StatusPill>
      </div>

      <h2 className="mt-4 text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-cream">
        {reports.title}
      </h2>
      <p className="mt-2 text-[12.5px] leading-5 text-cream/46">{reports.detail}</p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-4">
        <div className="flex min-w-0 items-end gap-6">
          <SummaryMetric
            label="Latest signal"
            value={reports.latestScore === null ? "Waiting" : `${reports.latestScore}%`}
          />
          <SummaryMetric
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
        <SummaryLabel icon={<HandHelping size={17} strokeWidth={1.8} aria-hidden="true" />}>
          Trailmate
        </SummaryLabel>
        {trailmate.state === "active" ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--workspace-accent)]">
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

      <h2 className="mt-4 text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-cream">
        {trailmate.title}
      </h2>
      <p className="mt-2 text-[12.5px] leading-5 text-cream/46">{trailmate.detail}</p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-4">
        <div className="flex min-w-0 items-end gap-6">
          {trailmate.peopleHelped > 0 || trailmate.helpReceived > 0 ? (
            <>
              <SummaryMetric label="Helped" value={String(trailmate.peopleHelped)} />
              <SummaryMetric label="Supported by" value={String(trailmate.helpReceived)} />
            </>
          ) : (
            <SummaryMetric label="Peer support" value="Ready when you are" />
          )}
        </div>
        <SummaryAction href={trailmate.actionHref} label={trailmate.actionLabel} />
      </div>
    </article>
  );
}

function SummaryLabel({ children, icon }: { children: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream/[0.055] text-cream/58">
        {icon}
      </span>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cream/40">
        {children}
      </p>
    </div>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-cream/30">
      {children}
    </span>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cream/28">{label}</p>
      <p className="mt-1 truncate text-[11.5px] font-semibold text-cream/68">{value}</p>
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
      <span className="shrink-0 text-[9.5px] font-medium text-cream/30">
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
      className="group inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-cream/62 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
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
