import { CircleCheck, FileWarning, Flame, Hourglass, Inbox } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { peopleByOwnerId } from "@/features/admin/server/admin-directory";
import { RetryGradingButton } from "@/features/admin/ui/retry-grading-button";
import {
  AdminCard,
  AdminPage,
  EmptyNote,
  RangeTabs,
  StatGrid,
  StatTile,
  formatDateTime,
  formatNumber,
  formatPercent
} from "@/features/admin/ui/admin-ui";
import { ownerIdToUserId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";

import { retryCheckpointGrading } from "./actions";

export const dynamic = "force-dynamic";
/** A retry grades a whole checkpoint, which can take a minute or more. */
export const maxDuration = 300;
export const metadata = privatePageMetadata(
  "Reliability · Admin",
  "Failing providers, stuck grading, and broken reports."
);

const WINDOWS = [
  { value: 1, label: "24 hours" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" }
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  groq: "Groq",
  deepgram: "Deepgram",
  judge0: "Judge0",
  "vercel-sandbox": "Vercel Sandbox"
};
const KIND_LABELS: Record<string, string> = { text: "AI text", speech: "Voice", code: "Code runs" };

type PageProps = { searchParams: Promise<{ days?: string | string[] }> };

export default async function AdminReliabilityPage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const raw = (await searchParams).days;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const days = WINDOWS.some((window) => window.value === requested) ? requested : 7;
  const reliability = await app.adminUsageService.reliability(days);
  const people = await peopleByOwnerId([
    ...new Set(reliability.stuckCheckpoints.map((row) => row.ownerId))
  ]);
  const calls = reliability.providers.reduce((total, row) => total + row.calls, 0);
  const failures = reliability.providers.reduce((total, row) => total + row.failures, 0);
  const { gradingQueue, roasts } = reliability;

  return (
    <AdminPage
      title="Reliability"
      description="What is failing, what is stuck, and what you can fix from here."
      actions={
        <RangeTabs options={WINDOWS} current={days} href={(value) => `/admin/reliability?days=${value}`} />
      }
    >
      <StatGrid>
        <StatTile
          label="Provider calls that worked"
          icon={CircleCheck}
          value={calls ? formatPercent((calls - failures) / calls, 1) : "—"}
          hint={calls ? `${formatNumber(failures)} of ${formatNumber(calls)} failed, retries included` : "Nothing recorded yet"}
        />
        <StatTile
          label="Stuck checkpoints"
          icon={Hourglass}
          value={formatNumber(reliability.stuckCheckpoints.length)}
          hint="Rooms that ended over 10 minutes ago with no result"
        />
        <StatTile
          label="Answer grading"
          icon={Inbox}
          value={formatNumber(gradingQueue.waiting)}
          hint={
            gradingQueue.oldestMinutes === null
              ? `Nothing waiting. ${formatNumber(gradingQueue.deadLetter)} gave up in the window`
              : `Waiting, oldest ${gradingQueue.oldestMinutes} min. ${formatNumber(gradingQueue.deadLetter)} gave up in the window`
          }
        />
        <StatTile
          label="Missing interview reports"
          icon={FileWarning}
          value={formatNumber(reliability.reportsMissing)}
          hint="Finished rounds with no report after 10 minutes"
        />
      </StatGrid>

      <AdminCard
        title="Stuck checkpoints"
        description="Retry runs the same steps as ending the room: grade queued answers, then write the checkpoint result."
      >
        {reliability.stuckCheckpoints.length ? (
          <ul>
            {reliability.stuckCheckpoints.map((row) => {
              const person = people.get(row.ownerId);
              const userId = ownerIdToUserId(row.ownerId) ?? row.ownerId;
              return (
                <li
                  key={row.sessionId}
                  className="admin-rule flex flex-col gap-3 py-3.5 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-cream">
                      {row.track}
                      <span className="font-normal text-cream/45">
                        {" "}
                        · {row.status === "FINALIZING" ? "grading started, never finished" : "never sent for grading"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-cream/45">
                      <Link
                        href={`/admin/users/${encodeURIComponent(userId)}`}
                        className="rounded-sm outline-none hover:text-cream hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
                      >
                        {person?.name ?? person?.email ?? userId}
                      </Link>{" "}
                      · room ended {formatDateTime(row.finishedAt)} UTC
                    </p>
                  </div>
                  <RetryGradingButton sessionId={row.sessionId} action={retryCheckpointGrading} />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyNote>No stuck checkpoints. Every finished room has a result.</EmptyNote>
        )}
      </AdminCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Providers" description="Failure rate and response time for successful calls.">
          {reliability.providers.length ? (
            <div className="thin-scroll -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[30rem] text-[14px]">
                <thead>
                  <tr className="admin-rule text-left text-[13px] text-cream/45">
                    <th className="pb-3 pr-4 font-medium">Service</th>
                    <th className="pb-3 pr-4 text-right font-medium">Calls</th>
                    <th className="pb-3 pr-4 text-right font-medium">Failed</th>
                    <th className="pb-3 pr-4 text-right font-medium">Typical</th>
                    <th className="pb-3 text-right font-medium">Slowest 5%</th>
                  </tr>
                </thead>
                <tbody>
                  {reliability.providers.map((row) => (
                    <tr key={`${row.kind}:${row.provider}`} className="admin-row admin-rule">
                      <td className="py-3 pr-4 font-medium text-cream">
                        {PROVIDER_LABELS[row.provider] ?? row.provider}
                        <span className="font-normal text-cream/45"> · {KIND_LABELS[row.kind] ?? row.kind}</span>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream">{formatNumber(row.calls)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream">
                        {row.failures ? formatPercent(row.failures / row.calls, 1) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream/72">{seconds(row.p50Ms)}</td>
                      <td className="py-3 text-right tabular-nums text-cream/72">{seconds(row.p95Ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyNote>No provider calls recorded in this window.</EmptyNote>
          )}
        </AdminCard>

        <AdminCard title="Failing tasks" description="The requests that fail most, with their most common error.">
          {reliability.failingOperations.length ? (
            <ul>
              {reliability.failingOperations.map((row) => (
                <li
                  key={`${row.provider}:${row.operation}`}
                  className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] text-cream">{row.operation}</p>
                    <p className="mt-0.5 text-[13px] text-cream/45">
                      {PROVIDER_LABELS[row.provider] ?? row.provider}
                      {row.topError ? ` · mostly ${row.topError}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-cream/72">
                    {formatNumber(row.failures)} of {formatNumber(row.calls)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No failures in this window.</EmptyNote>
          )}
        </AdminCard>
      </div>

      <AdminCard>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-[var(--workspace-accent)]">
            <Flame size={17} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="text-[14px] text-cream/72">
            Resume roasts: {formatNumber(roasts.failed)} failed and {formatNumber(roasts.stuck)} stuck generating, out of{" "}
            {formatNumber(roasts.total)} in the window.
          </p>
        </div>
      </AdminCard>
    </AdminPage>
  );
}

function seconds(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}
