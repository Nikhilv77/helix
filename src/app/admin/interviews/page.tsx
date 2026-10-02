import { AlertTriangle, CircleCheck, Gauge, Mic, RefreshCw, Timer } from "lucide-react";

import { requireAdmin } from "@/features/admin/server/admin-access";
import {
  AdminCard,
  AdminPage,
  BarList,
  RangeTabs,
  StatGrid,
  StatTile,
  formatDateTime,
  formatNumber,
  formatPercent,
  readableLabel
} from "@/features/admin/ui/admin-ui";
import type { InterviewOperationsDashboard } from "@/features/interviews/server/interview-operations";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interviews · Admin",
  "Reliability, latency, and grading health for interview rounds."
);

const WINDOWS = [
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 72, label: "3d" },
  { value: 168, label: "7d" },
  { value: 720, label: "30d" }
] as const;

type PageProps = { searchParams: Promise<{ hours?: string | string[] }> };

export default async function AdminInterviewsPage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const raw = (await searchParams).hours;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const hours = WINDOWS.some((window) => window.value === requested) ? requested : 24;
  const dashboard = await app.interviewOperationsService.dashboard(hours);
  const { sessions, decisions, evaluations } = dashboard;
  const queue = evaluations.queue;
  const outstanding = Object.entries(queue.byStatus)
    .filter(([status]) => !["COMPLETED", "SUPERSEDED", "DEAD_LETTER"].includes(status))
    .reduce((total, [, count]) => total + count, 0);

  return (
    <AdminPage
      title="Interviews"
      description="Whether rounds finish, how fast the interviewer answers, and whether grading keeps up."
      actions={
        <RangeTabs options={WINDOWS} current={hours} href={(value) => `/admin/interviews?hours=${value}`} />
      }
    >
      <Health dashboard={dashboard} />

      <StatGrid>
        <StatTile
          label="Rounds started"
          icon={Mic}
          value={formatNumber(sessions.total)}
          hint={`${formatPercent(sessions.completedRate)} reached the end`}
        />
        <StatTile
          label="Interviewer reply time"
          icon={Timer}
          value={milliseconds(decisions.latencyMs.p95)}
          hint={`Slowest 5% of ${formatNumber(decisions.observed)} turns. Typical ${milliseconds(decisions.latencyMs.p50)}`}
        />
        <StatTile
          label="Fallback turns"
          icon={Gauge}
          value={formatPercent(decisions.fallbackRate, 1)}
          hint={`${formatNumber(decisions.fallbackCount)} turns used the backup path, ${formatNumber(decisions.forcedCount)} were forced`}
        />
        <StatTile
          label="Grading time"
          icon={RefreshCw}
          value={milliseconds(evaluations.latencyMs.p95)}
          hint={`Slowest 5% of ${formatNumber(evaluations.observed)} answers. ${formatNumber(evaluations.recoveredCount)} recovered later, ${formatNumber(evaluations.unavailableCount)} never graded`}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Rounds by type">
          <BarList
            items={sortedEntries(sessions.byRound).map(([label, value]) => ({ label: readableLabel(label), value }))}
            empty="No rounds in this window."
          />
        </AdminCard>
        <AdminCard title="Where rounds are now" description="The phase each round in the window last reached.">
          <BarList
            items={sortedEntries(sessions.byPhase).map(([label, value]) => ({ label: readableLabel(label), value }))}
            empty="No rounds in this window."
          />
        </AdminCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard
          title="Grading queue"
          description={
            queue.oldestOutstandingAgeMinutes === null
              ? "Nothing waiting."
              : `${formatNumber(outstanding)} waiting. The oldest has waited ${queue.oldestOutstandingAgeMinutes} minutes.`
          }
        >
          <BarList
            items={sortedEntries(queue.byStatus).map(([status, value]) => ({
              label: readableLabel(status.toLowerCase()),
              value,
              hint: queue.averageAttemptsByStatus[status]
                ? `${queue.averageAttemptsByStatus[status]!.toFixed(1)} tries`
                : undefined
            }))}
            empty="The grading queue is empty."
          />
        </AdminCard>
        <AdminCard title="Latency" description="Typical, slowest 5%, and slowest single value in the window.">
          <div aria-hidden="true" className="mb-3 grid grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)] gap-2 text-right text-[13px] text-cream/45">
            <span />
            <span>Typical</span>
            <span>Slowest 5%</span>
            <span>Slowest</span>
          </div>
          <dl className="space-y-4 text-[14px]">
            <LatencyRow label="Interviewer reply" latency={decisions.latencyMs} />
            <LatencyRow label="Answer grading" latency={evaluations.latencyMs} />
          </dl>
          <p className="mt-6 text-[13px] leading-5 text-cream/45">
            Kept for {dashboard.retention.authenticatedDays} days for signed-in rounds,{" "}
            {dashboard.retention.anonymousDays} for anonymous ones, and{" "}
            {dashboard.retention.operationalDays} for queue records.
            {dashboard.window.sampleTruncated
              ? ` Only the newest ${formatNumber(dashboard.window.sampleLimit)} rounds are counted.`
              : ""}
          </p>
        </AdminCard>
      </div>
    </AdminPage>
  );
}

function Health({ dashboard }: { dashboard: InterviewOperationsDashboard }) {
  if (!dashboard.alerts.length) {
    return (
      <AdminCard>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-[var(--workspace-accent)]">
            <CircleCheck size={17} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[15px] font-medium text-cream">Everything looks healthy</p>
            <p className="text-[13px] text-cream/50">
              No latency, fallback, queue, or sampling alerts. Checked {formatDateTime(dashboard.generatedAt)} UTC.
            </p>
          </div>
        </div>
      </AdminCard>
    );
  }
  return (
    <AdminCard
      title={dashboard.alerts.some((alert) => alert.severity === "critical") ? "Needs action" : "Running slow"}
      description={`Checked ${formatDateTime(dashboard.generatedAt)} UTC.`}
    >
      <ul className="space-y-3">
        {dashboard.alerts.map((alert) => (
          <li key={alert.code} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.1] text-[var(--workspace-accent)]">
              <AlertTriangle size={15} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-cream">
                {alert.severity === "critical" ? "Critical" : "Warning"}
              </p>
              <p className="text-[13px] leading-5 text-cream/55">{alert.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function LatencyRow({
  label,
  latency
}: {
  label: string;
  latency: { p50: number | null; p95: number | null; max: number | null };
}) {
  return (
    <div className="admin-rule grid grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)] items-baseline gap-2 pb-4 last:border-0 last:pb-0">
      <dt className="text-cream/72">{label}</dt>
      <dd className="text-right tabular-nums text-cream">{milliseconds(latency.p50)}</dd>
      <dd className="text-right tabular-nums text-cream">{milliseconds(latency.p95)}</dd>
      <dd className="text-right tabular-nums text-cream/62">{milliseconds(latency.max)}</dd>
    </div>
  );
}

function sortedEntries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

function milliseconds(value: number | null): string {
  if (value === null) return "—";
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)}s` : `${Math.round(value)}ms`;
}
