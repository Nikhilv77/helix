import { auth } from "@clerk/nextjs/server";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  Layers3,
  LockKeyhole,
  Radio,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TimerReset,
  Workflow
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import type { InterviewOperationsDashboard } from "@/features/interviews/server/interview-operations";
import { canViewInterviewOperations } from "@/features/interviews/server/interview-operations-access";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interview Operations",
  "Aggregate reliability, latency, recovery, and retention signals for interviews."
);

const WINDOWS = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" }
] as const;

const NAVIGATION = [
  { label: "Overview", href: "#overview", icon: BarChart3 },
  { label: "Session health", href: "#sessions", icon: Radio },
  { label: "Decision engine", href: "#decisions", icon: Gauge },
  { label: "Evaluations", href: "#evaluations", icon: Workflow },
  { label: "Data controls", href: "#retention", icon: Database }
] as const;

type PageProps = {
  searchParams: Promise<{ hours?: string | string[] }>;
};

export default async function InterviewOperationsPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  const app = getAppContainer();
  const ownerId = userId ? authenticatedOwnerId(userId) : null;
  if (!canViewInterviewOperations(app.config, ownerId)) notFound();

  const requestedHours = Number((await searchParams).hours);
  const hours = WINDOWS.some((window) => window.hours === requestedHours) ? requestedHours : 24;
  const dashboard = await app.interviewOperationsService.dashboard(hours);
  const status = operationalStatus(dashboard);

  return (
    <div className="min-h-screen bg-[#090b0f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px]">
        <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0c0f14] px-4 py-5 lg:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-orange-500 text-white shadow-[0_8px_28px_rgba(249,115,22,0.24)]">
              <Activity className="size-4" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400">
                Trailgrad
              </p>
              <p className="text-sm font-semibold text-white">Operations console</p>
            </div>
          </div>

          <div className="mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Interview engine
          </div>
          <nav className="mt-3 space-y-1" aria-label="Dashboard sections">
            {NAVIGATION.map(({ label, href, icon: Icon }, index) => (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  index === 0
                    ? "bg-white/[0.07] font-medium text-white"
                    : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
                }`}
              >
                <Icon className={`size-4 ${index === 0 ? "text-orange-400" : "text-slate-500"}`} />
                <span>{label}</span>
                <ChevronRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="size-4" />
                Private admin surface
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                Protected by a Clerk session and one exact admin user ID. No candidate content is
                exposed here.
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 transition-colors hover:text-slate-200"
            >
              Back to Trailgrad
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-white/[0.07] bg-[#0b0e13]/90 px-4 py-3 backdrop-blur-xl sm:px-7 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="grid size-8 place-items-center rounded-lg bg-orange-500 text-white">
                  <Activity className="size-4" />
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-400">
                    Trailgrad
                  </p>
                  <p className="text-xs font-semibold">Operations</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
                <ServerCog className="size-3.5" />
                Production / Interview engine
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  Updated {formatTime(dashboard.generatedAt)}
                </span>
                <Link
                  href={`/operations/interviews?hours=${hours}`}
                  aria-label="Refresh dashboard"
                  className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
                >
                  <RefreshCw className="size-3.5" />
                </Link>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[11px] font-medium text-slate-300">
                  <LockKeyhole className="size-3 text-emerald-400" />
                  Admin only
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
            <header id="overview" className="scroll-mt-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${status.dotClass}`} />
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.15em] ${status.textClass}`}
                    >
                      {status.label}
                    </p>
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                    Interview operations
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    A live, aggregate view of session throughput, model latency, fallback behavior,
                    evaluation recovery, and retention policy.
                  </p>
                </div>
                <div className="inline-flex w-fit rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
                  {WINDOWS.map((window) => (
                    <Link
                      key={window.hours}
                      href={`/operations/interviews?hours=${window.hours}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                        window.hours === hours
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      {window.label}
                    </Link>
                  ))}
                </div>
              </div>
            </header>

            <Alerts dashboard={dashboard} />

            <section
              className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Key metrics"
            >
              <MetricCard
                icon={<Layers3 className="size-4" />}
                label="Total sessions"
                value={formatNumber(dashboard.sessions.total)}
                detail={`${formatNumber(completedSessions(dashboard))} completed`}
                tone="blue"
              />
              <MetricCard
                icon={<CheckCircle2 className="size-4" />}
                label="Completion rate"
                value={percent(dashboard.sessions.completedRate)}
                detail={`${formatNumber(dashboard.sessions.total - completedSessions(dashboard))} active or exited`}
                tone="emerald"
              />
              <MetricCard
                icon={<Gauge className="size-4" />}
                label="Decision p95"
                value={milliseconds(dashboard.decisions.latencyMs.p95)}
                detail={`${formatNumber(dashboard.decisions.observed)} agent decisions`}
                tone={isDecisionBreached(dashboard) ? "rose" : "violet"}
              />
              <MetricCard
                icon={<TimerReset className="size-4" />}
                label="Evaluation p95"
                value={milliseconds(dashboard.evaluations.latencyMs.p95)}
                detail={`${formatNumber(dashboard.evaluations.observed)} evaluations`}
                tone="amber"
              />
            </section>

            <section id="sessions" className="mt-8 scroll-mt-6">
              <SectionHeading
                eyebrow="Traffic"
                title="Session health"
                description={`Sessions created in the ${windowLabel(hours)} window, grouped without identity or interview content.`}
              />
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <Panel title="Round mix" subtitle="Sessions by interview template">
                  <Distribution
                    values={dashboard.sessions.byRound}
                    total={dashboard.sessions.total}
                    empty="No sessions were created in this window."
                  />
                </Panel>
                <Panel title="Lifecycle" subtitle="Current phase of every sampled session">
                  <Distribution
                    values={dashboard.sessions.byPhase}
                    total={dashboard.sessions.total}
                    empty="No session phases to show."
                    compact
                  />
                </Panel>
              </div>
            </section>

            <section id="decisions" className="mt-8 scroll-mt-6">
              <SectionHeading
                eyebrow="Runtime"
                title="Decision engine"
                description="Response latency and degradation signals across observed agent turns."
              />
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <Panel title="Latency against budget" subtitle="Live-turn budget: 4,000 ms">
                  <LatencyBars
                    values={dashboard.decisions.latencyMs}
                    ceiling={Math.max(4_000, dashboard.decisions.latencyMs.max ?? 0)}
                    budget={4_000}
                  />
                </Panel>
                <Panel title="Decision quality signals" subtitle="Fallback and forced responses">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <CompactStat
                      label="Fallback rate"
                      value={percent(dashboard.decisions.fallbackRate)}
                      detail={`${formatNumber(dashboard.decisions.fallbackCount)} turns`}
                      warning={dashboard.decisions.fallbackRate > 0.1}
                    />
                    <CompactStat
                      label="Forced decisions"
                      value={formatNumber(dashboard.decisions.forcedCount)}
                      detail="Guardrail interventions"
                    />
                  </div>
                </Panel>
              </div>
            </section>

            <section id="evaluations" className="mt-8 scroll-mt-6">
              <SectionHeading
                eyebrow="Async pipeline"
                title="Evaluation & recovery"
                description="Queue pressure, retries, recovery outcomes, and evaluator latency."
              />
              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <Panel title="Queue status" subtitle="Outstanding and dead-letter jobs">
                  <QueueStatus dashboard={dashboard} />
                </Panel>
                <Panel title="Attempts by status" subtitle="Average processing attempts">
                  <KeyValueRows
                    values={dashboard.evaluations.queue.averageAttemptsByStatus}
                    suffix=" attempts"
                    empty="No queued evaluation attempts."
                  />
                </Panel>
                <Panel title="Recovery outcomes" subtitle="Evaluation resilience">
                  <div className="grid grid-cols-2 gap-3">
                    <CompactStat
                      label="Recovered"
                      value={formatNumber(dashboard.evaluations.recoveredCount)}
                      detail="Completed after retry"
                    />
                    <CompactStat
                      label="Unavailable"
                      value={formatNumber(dashboard.evaluations.unavailableCount)}
                      detail="Graceful degradation"
                      warning={dashboard.evaluations.unavailableCount > 0}
                    />
                  </div>
                  <div className="mt-5 border-t border-white/[0.07] pt-5">
                    <LatencyBars
                      values={dashboard.evaluations.latencyMs}
                      ceiling={dashboard.evaluations.latencyMs.max ?? 1}
                    />
                  </div>
                </Panel>
              </div>
            </section>

            <section id="retention" className="mt-8 scroll-mt-6 pb-8">
              <SectionHeading
                eyebrow="Governance"
                title="Data controls"
                description="Configured deletion windows and safety limits for privacy-sensitive interview data."
              />
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1218]">
                <div className="grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  <PolicyCard
                    icon={<ShieldCheck className="size-4" />}
                    label="Signed-in sessions"
                    value={`${dashboard.retention.authenticatedDays} days`}
                    detail="Transcript and report retention"
                  />
                  <PolicyCard
                    icon={<Archive className="size-4" />}
                    label="Anonymous sessions"
                    value={`${dashboard.retention.anonymousDays} days`}
                    detail="Shorter privacy window"
                  />
                  <PolicyCard
                    icon={<Database className="size-4" />}
                    label="Operation records"
                    value={`${dashboard.retention.operationalDays} days`}
                    detail="Terminal jobs and requests"
                  />
                  <PolicyCard
                    icon={<ServerCog className="size-4" />}
                    label="Deletion batch"
                    value={formatNumber(dashboard.retention.batchSize)}
                    detail="Maximum rows per sweep"
                  />
                </div>
                <div className="flex flex-col gap-2 border-t border-white/[0.07] px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Metrics sample limit: {formatNumber(dashboard.window.sampleLimit)} sessions
                  </span>
                  <span>
                    Window began {formatDateTime(dashboard.window.since)}
                    {dashboard.window.sampleTruncated
                      ? " · sample limit reached"
                      : " · complete sample"}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Alerts({ dashboard }: { dashboard: InterviewOperationsDashboard }) {
  if (dashboard.alerts.length === 0) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-4 py-3.5">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-emerald-200">
            All monitored thresholds are healthy
          </p>
          <p className="mt-0.5 text-xs text-emerald-200/55">
            No latency, fallback, queue, or sample-limit alerts in this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-2" aria-label="Operational alerts">
      {dashboard.alerts.map((alert) => (
        <div
          key={alert.code}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            alert.severity === "critical"
              ? "border-rose-400/20 bg-rose-400/[0.065]"
              : "border-amber-400/20 bg-amber-400/[0.06]"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 size-4 shrink-0 ${alert.severity === "critical" ? "text-rose-400" : "text-amber-400"}`}
          />
          <div>
            <p className="text-sm font-semibold text-slate-100">{humanize(alert.code)}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-400">{alert.message}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "emerald" | "violet" | "amber" | "rose";
}) {
  const colors = {
    blue: "bg-sky-400/10 text-sky-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    violet: "bg-violet-400/10 text-violet-300",
    amber: "bg-amber-400/10 text-amber-300",
    rose: "bg-rose-400/10 text-rose-300"
  };
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#0f1218] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${colors[tone]}`}>{icon}</span>
      </div>
      <p className="mt-5 font-mono text-[1.65rem] font-semibold tracking-[-0.045em] text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-400">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#0f1218] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function Distribution({
  values,
  total,
  empty,
  compact = false
}: {
  values: Record<string, number>;
  total: number;
  empty: string;
  compact?: boolean;
}) {
  const rows = Object.entries(values).sort((left, right) => right[1] - left[1]);
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className={compact ? "space-y-3.5" : "space-y-4"}>
      {rows.map(([label, value], index) => {
        const share = total ? value / total : 0;
        return (
          <div key={label}>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
              <span className="truncate font-medium capitalize text-slate-300">
                {humanize(label)}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">
                {formatNumber(value)} <span className="text-slate-700">/</span> {percent(share)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
              <div
                className={`h-full rounded-full ${index === 0 ? "bg-orange-400" : "bg-slate-500"}`}
                style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LatencyBars({
  values,
  ceiling,
  budget
}: {
  values: { p50: number | null; p95: number | null; max: number | null };
  ceiling: number;
  budget?: number;
}) {
  const rows = [
    ["p50", values.p50],
    ["p95", values.p95],
    ["max", values.max]
  ] as const;

  if (rows.every(([, value]) => value === null)) {
    return <EmptyState>No latency samples in this window.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {rows.map(([label, value]) => {
        const breached = Boolean(budget && value !== null && value > budget);
        const width =
          value === null ? 0 : Math.max(2, Math.min(100, (value / Math.max(ceiling, 1)) * 100));
        return (
          <div key={label} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-3">
            <span className="font-mono text-[11px] uppercase text-slate-500">{label}</span>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.055]">
              {budget ? (
                <span
                  className="absolute inset-y-0 z-10 w-px bg-white/40"
                  style={{ left: `${Math.min(100, (budget / Math.max(ceiling, 1)) * 100)}%` }}
                />
              ) : null}
              <span
                className={`block h-full rounded-full ${breached ? "bg-rose-400" : "bg-violet-400"}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span
              className={`text-right font-mono text-[11px] ${breached ? "text-rose-300" : "text-slate-300"}`}
            >
              {milliseconds(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CompactStat({
  label,
  value,
  detail,
  warning = false
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={`mt-2 font-mono text-xl font-semibold ${warning ? "text-amber-300" : "text-white"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

function QueueStatus({ dashboard }: { dashboard: InterviewOperationsDashboard }) {
  const { byStatus, oldestOutstandingAgeMinutes } = dashboard.evaluations.queue;
  const rows = Object.entries(byStatus).sort((left, right) => right[1] - left[1]);
  return (
    <div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-2 capitalize text-slate-400">
                <span
                  className={`size-1.5 rounded-full ${label === "DEAD_LETTER" ? "bg-rose-400" : label === "PROCESSING" ? "bg-sky-400" : "bg-amber-400"}`}
                />
                {humanize(label)}
              </span>
              <span className="font-mono font-medium text-slate-200">{formatNumber(value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="size-4" /> Queue is clear
        </div>
      )}
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs">
        <span className="flex items-center gap-2 text-slate-500">
          <Clock3 className="size-3.5" /> Oldest outstanding
        </span>
        <span className="font-mono text-slate-300">
          {oldestOutstandingAgeMinutes === null ? "None" : `${oldestOutstandingAgeMinutes} min`}
        </span>
      </div>
    </div>
  );
}

function KeyValueRows({
  values,
  suffix,
  empty
}: {
  values: Record<string, number>;
  suffix: string;
  empty: string;
}) {
  const rows = Object.entries(values).sort((left, right) => right[1] - left[1]);
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <dl className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 text-xs">
          <dt className="capitalize text-slate-500">{humanize(label)}</dt>
          <dd className="font-mono text-slate-300">
            {formatNumber(value)}
            {suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PolicyCard({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-[11px] font-medium">{label}</p>
      </div>
      <p className="mt-4 font-mono text-xl font-semibold text-white">{value}</p>
      <p className="mt-1.5 text-[10px] text-slate-600">{detail}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 text-center text-xs text-slate-600">
      {children}
    </div>
  );
}

function operationalStatus(dashboard: InterviewOperationsDashboard) {
  if (dashboard.alerts.some((alert) => alert.severity === "critical")) {
    return { label: "Action required", dotClass: "bg-rose-400", textClass: "text-rose-400" };
  }
  if (dashboard.alerts.length > 0) {
    return { label: "Degraded", dotClass: "bg-amber-400", textClass: "text-amber-400" };
  }
  return {
    label: "All systems nominal",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-400"
  };
}

function completedSessions(dashboard: InterviewOperationsDashboard): number {
  return (
    dashboard.sessions.byPhase.done ??
    Math.round(dashboard.sessions.total * dashboard.sessions.completedRate)
  );
}

function isDecisionBreached(dashboard: InterviewOperationsDashboard): boolean {
  return (dashboard.decisions.latencyMs.p95 ?? 0) > 4_000;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function milliseconds(value: number | null): string {
  if (value === null) return "No data";
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 1 : 2)} s`;
  return `${formatNumber(value)} ms`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
}

function windowLabel(hours: number): string {
  if (hours < 24) return `${hours}-hour`;
  return `${hours / 24}-day`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
