import { Coins, Cpu, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { peopleByOwnerId } from "@/features/admin/server/admin-directory";
import { DailyColumns } from "@/features/admin/ui/admin-charts";
import { formatUsd } from "@/features/admin/ui/admin-format";
import {
  AdminCard,
  AdminPage,
  BarList,
  EmptyNote,
  RangeTabs,
  StatGrid,
  StatTile,
  formatDay,
  formatNumber,
  formatPercent
} from "@/features/admin/ui/admin-ui";
import { ownerIdToUserId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Cost · Admin", "What Trailgrad spends on AI, voice, and code runs.");

const WINDOWS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" }
] as const;

const KIND_LABELS: Record<string, string> = { text: "AI text", speech: "Voice", code: "Code runs" };
const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  groq: "Groq",
  deepgram: "Deepgram",
  judge0: "Judge0",
  "vercel-sandbox": "Vercel Sandbox"
};

type PageProps = { searchParams: Promise<{ days?: string | string[] }> };

export default async function AdminCostPage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const raw = (await searchParams).days;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const days = WINDOWS.some((window) => window.value === requested) ? requested : 30;
  const cost = await app.adminUsageService.cost(days);
  const people = await peopleByOwnerId(cost.topUsers.map((user) => user.ownerId));
  const change = cost.previousCost ? (cost.totalCost - cost.previousCost) / cost.previousCost : null;
  const recordedDays = cost.recordedSince
    ? Math.max(1, Math.min(days, Math.ceil((Date.now() - Date.parse(cost.recordedSince)) / 86_400_000)))
    : 0;
  const monthly = recordedDays ? (cost.totalCost / recordedDays) * 30 : 0;

  return (
    <AdminPage
      title="Cost"
      description="Estimated spend on AI, voice, and code runs, priced at each provider's list rate. Free-tier calls are counted as if paid."
      actions={<RangeTabs options={WINDOWS} current={days} href={(value) => `/admin/cost?days=${value}`} />}
    >
      {!cost.recordedSince ? (
        <AdminCard>
          <EmptyNote>
            Nothing recorded yet. Usage is logged from the first AI call, voice line, or code run after this version is deployed.
          </EmptyNote>
        </AdminCard>
      ) : null}

      <StatGrid>
        <StatTile
          label={`Spend, last ${days} days`}
          icon={Coins}
          value={formatUsd(cost.totalCost)}
          hint={
            !cost.recordedSince
              ? undefined
              : change === null
                ? `Recorded since ${formatDay(cost.recordedSince)}`
              : `${change >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(change))} on the ${days} days before`
          }
        />
        <StatTile
          label="Monthly run rate"
          icon={TrendingUp}
          value={formatUsd(monthly)}
          hint={recordedDays ? `From the average of ${recordedDays} recorded ${recordedDays === 1 ? "day" : "days"}` : undefined}
        />
        <StatTile
          label="Per active learner"
          icon={UserRound}
          value={cost.activeUsers ? formatUsd(cost.totalCost / cost.activeUsers) : "—"}
          hint={`${formatNumber(cost.activeUsers)} people were active in the window`}
        />
        <StatTile
          label="AI calls"
          icon={Cpu}
          value={formatNumber(cost.textCalls)}
          hint={`${compact(cost.tokens.input)} tokens in, ${compact(cost.tokens.output)} out`}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <AdminCard title="Daily spend" description="Estimated cost of everything recorded that day.">
          <DailyColumns points={cost.dailyCost} unit="" valueFormat="usd" />
        </AdminCard>
        <AdminCard title="Where it goes" description="Spend by kind of service.">
          <BarList items={cost.byKind} format={formatUsd} />
        </AdminCard>
      </div>

      <AdminCard title="Models and services" description="Every provider and model that was called, most expensive first.">
        {cost.models.length ? (
          <div className="thin-scroll -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[50rem] text-[14px]">
              <thead>
                <tr className="admin-rule text-left text-[13px] text-cream/45">
                  <th className="pb-3 pr-4 font-medium">Service</th>
                  <th className="pb-3 pr-4 text-right font-medium">Calls</th>
                  <th className="pb-3 pr-4 text-right font-medium">Failed</th>
                  <th className="pb-3 pr-4 text-right font-medium">Usage</th>
                  <th className="pb-3 pr-4 text-right font-medium">Average time</th>
                  <th className="pb-3 text-right font-medium">Estimated cost</th>
                </tr>
              </thead>
              <tbody>
                {cost.models.map((row) => (
                  <tr key={`${row.kind}:${row.provider}:${row.model}`} className="admin-row admin-rule">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-cream">
                        {PROVIDER_LABELS[row.provider] ?? row.provider}
                        <span className="font-normal text-cream/45"> · {KIND_LABELS[row.kind] ?? row.kind}</span>
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-cream/45">{row.model}</p>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-cream">{formatNumber(row.calls)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-cream/72">
                      {row.failures ? formatPercent(row.failures / row.calls, 1) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-cream/72">{usageLabel(row)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-cream/72">{seconds(row.durationMs / row.calls)}</td>
                    <td className="py-3 text-right font-medium tabular-nums text-cream">{formatUsd(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote>No calls in this window.</EmptyNote>
        )}
      </AdminCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AdminCard
          title="Most expensive AI tasks"
          description="Each task is one kind of request, such as grading an answer or planning a round."
        >
          {cost.operations.length ? (
            <ul>
              {cost.operations.map((operation) => (
                <li key={operation.operation} className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] text-cream">{operation.operation}</p>
                    <p className="mt-0.5 text-[13px] text-cream/45">
                      {formatNumber(operation.calls)} calls · {compact(operation.inputTokens / operation.calls)} in,{" "}
                      {compact(operation.outputTokens / operation.calls)} out per call
                      {operation.p95Ms ? ` · slowest 5% ${seconds(operation.p95Ms)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-cream">{formatUsd(operation.cost)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No AI calls in this window.</EmptyNote>
          )}
        </AdminCard>
        <AdminCard
          title="Heaviest users"
          description="Voice and code runs only. AI text calls are not tied to a person."
        >
          {cost.topUsers.length ? (
            <ul>
              {cost.topUsers.map((user) => {
                const person = people.get(user.ownerId);
                const userId = ownerIdToUserId(user.ownerId) ?? user.ownerId;
                return (
                  <li key={user.ownerId} className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0">
                    <Link href={`/admin/users/${encodeURIComponent(userId)}`} className="min-w-0 rounded-md outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]">
                      <p className="truncate text-[14px] font-medium text-cream">{person?.name ?? person?.email ?? userId}</p>
                      <p className="mt-0.5 text-[13px] text-cream/45">
                        {compact(user.speechCharacters)} characters spoken · {formatNumber(user.codeRuns)} code runs
                      </p>
                    </Link>
                    <span className="shrink-0 text-[14px] font-medium tabular-nums text-cream">{formatUsd(user.cost)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyNote>No voice or code usage in this window.</EmptyNote>
          )}
        </AdminCard>
      </div>

      <p className="text-[13px] leading-5 text-cream/45">
        Prices live in src/features/admin/domain/provider-pricing.ts. Update them when a provider bill disagrees.
      </p>
    </AdminPage>
  );
}

function usageLabel(row: { kind: string; provider: string; inputTokens: number; outputTokens: number; units: number; durationMs: number }) {
  if (row.kind === "text") return `${compact(row.inputTokens + row.outputTokens)} tokens`;
  if (row.kind === "speech") return `${compact(row.units)} characters`;
  if (row.provider === "vercel-sandbox") return `${formatNumber(row.units)} runs, ${seconds(row.durationMs)} up`;
  return `${formatNumber(row.units)} runs`;
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function seconds(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 120_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)} min`;
}
