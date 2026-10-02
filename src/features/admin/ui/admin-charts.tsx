"use client";

import { useState } from "react";

import { formatUsd } from "./admin-format";

type Point = { date: string; value: number };

/**
 * One series per day, as thin accent columns on a single axis. Hovering (or
 * focusing) a day shows its exact value; the axis carries three quiet
 * gridlines and the first, middle, and last dates.
 */
export function DailyColumns({
  points,
  unit,
  height = 200,
  valueFormat = "number"
}: {
  points: Point[];
  unit: string;
  height?: number;
  /** "usd" shows values as dollars and drops the unit from the tooltip. */
  valueFormat?: "number" | "usd";
}) {
  const usd = valueFormat === "usd";
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(0, ...points.map((point) => point.value));
  const max = usd ? niceMaxDecimal(peak) : niceMax(peak);
  const ticks = usd ? [max, max / 2, 0] : [max, Math.round(max / 2), 0];
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  const hovered = active === null ? null : points[active];

  return (
    <div className="relative">
      <div className="flex gap-3">
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[12px] tabular-nums text-cream/40"
          style={{ height }}
        >
          {ticks.map((tick, index) => (
            <span key={index} className="-translate-y-1/2 leading-none last:translate-y-0">
              {usd ? formatUsd(tick) : formatCompact(tick)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" style={{ height }}>
            {ticks.map((_, index) => (
              <span key={index} className="admin-gridline block" />
            ))}
          </div>
          <div
            className="relative flex items-end"
            style={{ height, gap: points.length > 45 ? 2 : 4 }}
            onMouseLeave={() => setActive(null)}
          >
            {points.map((point, index) => (
              <button
                key={point.date}
                type="button"
                aria-label={`${formatDate(point.date)}: ${usd ? formatUsd(point.value) : `${point.value} ${unit}`}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
              >
                <span
                  className="admin-column block w-full max-w-[24px] rounded-t-[4px] bg-[var(--workspace-accent)] transition-opacity duration-150"
                  style={{
                    height: point.value > 0 ? `max(3px, ${(point.value / max) * 100}%)` : 0,
                    opacity: active === null || active === index ? 1 : 0.4,
                    animationDelay: `${Math.min(index * 8, 360)}ms`
                  }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex justify-between text-[12px] text-cream/40">
            {points.map((point, index) =>
              labelIndexes.has(index) ? <span key={point.date}>{formatDate(point.date)}</span> : null
            )}
          </div>
          {hovered && active !== null ? (
            <div
              role="status"
              className="admin-tooltip pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-lg px-3 py-2"
              style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            >
              <p className="text-[12px] text-cream/60">{formatDate(hovered.date)}</p>
              <p className="text-[14px] font-semibold tabular-nums text-cream">
                {usd ? formatUsd(hovered.value) : `${hovered.value.toLocaleString("en-US")} ${unit}`}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Weekly sign-up cohorts. Each cell is the share of that cohort active in a
 * later week, shaded on one accent hue from faint to full.
 */
export function CohortGrid({
  cohorts
}: {
  cohorts: Array<{ week: string; size: number; activeByWeek: number[] }>;
}) {
  const now = Date.now();
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-[13px]">
        <thead>
          <tr className="text-cream/45">
            <th className="px-2 pb-1 text-left font-medium">Signed up</th>
            <th className="px-2 pb-1 text-right font-medium">Users</th>
            {Array.from({ length: 8 }, (_, week) => (
              <th key={week} className="px-2 pb-1 text-center font-medium">
                Week {week}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => {
            const weeksElapsed = Math.floor((now - Date.parse(`${cohort.week}T00:00:00Z`)) / (7 * 86_400_000));
            return (
              <tr key={cohort.week}>
                <td className="whitespace-nowrap px-2 text-cream/72">Week of {formatDate(cohort.week)}</td>
                <td className="px-2 text-right tabular-nums text-cream">{cohort.size}</td>
                {cohort.activeByWeek.map((active, week) => {
                  if (week > weeksElapsed) return <td key={week} />;
                  const share = cohort.size ? active / cohort.size : 0;
                  return (
                    <td
                      key={week}
                      title={`${active} of ${cohort.size} active`}
                      className="h-9 rounded-md text-center tabular-nums text-cream"
                      style={{
                        background: `color-mix(in srgb, var(--workspace-accent) ${Math.round(8 + share * 72)}%, transparent)`
                      }}
                    >
                      {Math.round(share * 100)}%
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Like niceMax, but for small dollar amounts that never reach 4. */
function niceMaxDecimal(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
