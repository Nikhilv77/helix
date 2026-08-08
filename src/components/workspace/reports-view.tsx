import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  FileText,
  Gauge,
  Layers,
  MessageSquareQuote,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import {
  formatDuration,
  formatShortDate,
  levelLabel,
  roleInitials,
  roleLabel,
  roundLabel,
  roundShortLabel
} from "@/lib/labels";
import type {
  ReportCompetencyRow,
  ReportGap,
  ReportMatrix,
  ReportRoundRow,
  ReportRoundTypeRow,
  ReportTrendPoint,
  ReportsOverview
} from "@/lib/reports";
import type { InterviewHistoryStatus } from "@/lib/types";

const MINT = "#8be6bd";
const SKY = "#9fc7ff";
const GOLD = "#f4c65a";
const CORAL = "#f0a3a3";

/**
 * Reports: what every round together says about you.
 *
 * A single report lives at /sessions/[id] and answers "how did that round go?".
 * This page answers the question one round cannot: is the evidence getting
 * stronger, and which competency keeps costing you the same points?
 */
export function ReportsView({
  overview,
  quota,
  firstName
}: {
  overview: ReportsOverview;
  quota: { used: number; limit: number };
  firstName: string;
}) {
  const remaining = Math.max(0, quota.limit - quota.used);

  if (overview.totalRounds === 0) {
    return (
      <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10">
        <DocumentTitle title="Reports" />
        <NoReports firstName={firstName} exhausted={remaining === 0} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10">
      <DocumentTitle title="Reports" />

      <Hero overview={overview} firstName={firstName} remaining={remaining} quota={quota} />

      {overview.scoredRounds > 0 ? (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
            <Panel
              title="Evidence over time"
              subtitle="Every scored round, oldest to newest."
              aside={deltaLabel(overview.scoreDelta)}
            >
              <TrendChart points={overview.trend} />
            </Panel>

            <Panel
              title="Round mix"
              subtitle="Which formats you have practised, and how each scores."
              aside={`${overview.scoredRounds} scored`}
            >
              <RoundTypes rows={overview.roundTypes} pressure={overview.pressure} />
            </Panel>
          </div>

          <div className="mt-4">
            <Panel
              title="Competency matrix"
              subtitle="Each competency down the side, each round across the top. Gaps in a row are competencies that round never asked about."
              aside={`${overview.competencies.length} tracked`}
            >
              <Matrix matrix={overview.matrix} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Panel
              title="Competency trend"
              subtitle="Average score per competency, and how far it has moved."
            >
              <CompetencyRows rows={overview.competencies} />
            </Panel>

            <Panel
              title="Recurring gaps"
              subtitle="The same points, lost round after round."
              aside={overview.recurringGaps.length ? "Weakest first" : undefined}
            >
              <Gaps gaps={overview.recurringGaps} />
            </Panel>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <Panel
            title="No scored rounds yet"
            subtitle="Your rounds are here, but none of them captured an answer."
          >
            <EmptyNote>
              Scores, trends and the competency matrix appear once a round has at least one answer.
              Resume an open round or start a new one.
            </EmptyNote>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel
          title="All reports"
          subtitle="Every round you have run, newest first."
          aside={`${overview.totalRounds} ${overview.totalRounds === 1 ? "round" : "rounds"}`}
        >
          <RoundList rounds={overview.rounds} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({
  overview,
  firstName,
  remaining,
  quota
}: {
  overview: ReportsOverview;
  firstName: string;
  remaining: number;
  quota: { used: number; limit: number };
}) {
  const { latest, best } = overview;

  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)] lg:items-stretch">
        <div className="flex min-w-0 flex-col rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#8be6bd]/14 px-2.5 py-1 text-[11.5px] font-semibold text-[#a9f0d0]">
            <FileText size={12} aria-hidden="true" />
            {overview.totalRounds} {overview.totalRounds === 1 ? "report" : "reports"}
          </span>

          <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-semibold leading-10 tracking-tight text-cream sm:text-[2.4rem] sm:leading-[3rem]">
            {headline(overview, firstName)}
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-cream/70">
            {subheadline(overview)}
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link
              href={latest ? latest.href : "/interviews"}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {latest?.status === "in_progress" ? (
                <Play size={15} aria-hidden="true" fill="currentColor" />
              ) : (
                <FileText size={15} aria-hidden="true" />
              )}
              {latest?.status === "in_progress" ? "Resume open round" : "Open latest report"}
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/interviews"
              aria-disabled={remaining === 0}
              className={[
                "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream/[0.07] px-5 text-[14px] font-semibold text-cream/75 transition",
                remaining === 0
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-cream/[0.13] hover:text-cream"
              ].join(" ")}
            >
              <Mic size={15} aria-hidden="true" />
              {remaining === 0 ? "Daily limit reached" : "Run a new round"}
            </Link>
          </div>

          <dl className="mt-auto grid grid-cols-2 gap-3 pt-7 sm:grid-cols-4">
            <HeroStat
              icon={Gauge}
              label="Readiness"
              value={overview.readinessScore === null ? "—" : String(overview.readinessScore)}
              hint={
                overview.readinessScore === null
                  ? "after a scored round"
                  : `last ${Math.min(overview.scoredRounds, 5)} rounds`
              }
            />
            <HeroStat
              icon={TrendingUp}
              label="Best round"
              value={overview.bestScore === null ? "—" : String(overview.bestScore)}
              hint={best ? formatShortDate(best.startedAt) : "no scores yet"}
            />
            <HeroStat
              icon={MessageSquareQuote}
              label="Answered"
              value={`${overview.questionsAnswered}`}
              hint={`of ${overview.questionsAsked} asked`}
            />
            <HeroStat
              icon={Clock3}
              label="In the room"
              value={`${overview.totalMinutes}m`}
              hint={`${remaining} of ${quota.limit} left today`}
            />
          </dl>
        </div>

        <LatestCard latest={latest} overview={overview} />
      </div>
    </section>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-[#24439b] p-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
        <Icon size={13} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2">
        <span className="block font-display text-[1.5rem] font-semibold tabular-nums tracking-tight text-cream">
          {value}
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-medium text-cream/45">{hint}</span>
      </dd>
    </div>
  );
}

/** The most recent round, expanded: its score, its verdict, its next step. */
function LatestCard({
  latest,
  overview
}: {
  latest: ReportRoundRow | null;
  overview: ReportsOverview;
}) {
  if (!latest) {
    return (
      <div className="flex flex-col justify-center rounded-2xl bg-[#2a4aa0] p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-cream/[0.08] text-cream/60">
          <Mic size={19} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-cream">No scored round yet</p>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-cream/45">
          Answer at least one question and the round gets a report with scores and a targeted retry.
        </p>
      </div>
    );
  }

  const score = latest.evidenceScore ?? 0;
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="flex flex-col rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
          Latest round
        </p>
        <StatusBadge status={latest.status} />
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[6.5rem] w-[6.5rem] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img">
            <title>{`Evidence score ${score} out of 100`}</title>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1e3c88" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={scoreColor(score)}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / 100)}
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="font-display text-[1.7rem] font-semibold leading-none tabular-nums text-cream">
              {latest.evidenceScore ?? "—"}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-6 text-cream">
            {roleLabel(latest.role)} · {roundShortLabel(latest.roundType)}
          </p>
          <p className="mt-1 text-[12.5px] font-medium text-cream/45">
            {formatShortDate(latest.startedAt)} · {formatDuration(latest.durationMs)} ·{" "}
            {latest.questionsCovered}/{latest.questionCount} covered
          </p>
          {overview.scoreDelta !== null ? (
            <p
              className={`mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold ${overview.scoreDelta >= 0 ? "text-[#a9f0d0]" : "text-[#f0a3a3]"}`}
            >
              {overview.scoreDelta >= 0 ? (
                <TrendingUp size={13} aria-hidden="true" />
              ) : (
                <TrendingDown size={13} aria-hidden="true" />
              )}
              {overview.scoreDelta > 0 ? "+" : ""}
              {overview.scoreDelta} since your first round
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid gap-2">
        <SummaryLine label="Strongest" value={latest.strongest ?? "—"} tone="mint" />
        <SummaryLine label="Focus" value={latest.recommendedFocus ?? "—"} tone="gold" />
      </dl>

      <p className="mt-4 rounded-xl bg-[#24439b] p-3.5 text-[13px] leading-6 text-cream/60">
        <span className="font-semibold text-cream/85">Next: </span>
        {latest.nextStep}
      </p>

      <Link
        href={latest.href}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cream/[0.07] text-[14px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] hover:text-cream"
      >
        Open full report <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "mint" | "gold";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone === "mint" ? MINT : GOLD }}
      />
      <dt className="shrink-0 text-[12.5px] font-medium text-cream/45">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-cream">
        {value}
      </dd>
    </div>
  );
}

/* ----------------------------------------------------------- trend chart */

/**
 * An area chart over the scored rounds. Drawn in a 0–100 viewBox so the SVG
 * scales with the panel, with a dot per round the user can hover for detail.
 */
function TrendChart({ points }: { points: ReportTrendPoint[] }) {
  if (!points.length) return <EmptyNote>No scored rounds yet.</EmptyNote>;

  const width = 100;
  const height = 46;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const x = (index: number) => (points.length > 1 ? index * step : width / 2);
  const y = (score: number) => height - (score / 100) * height;

  const line = points.map((point, index) => `${x(index)},${y(point.score)}`).join(" ");
  const area = `0,${height} ${line} ${x(points.length - 1)},${height}`;
  const average = points.reduce((total, point) => total + point.score, 0) / points.length;

  return (
    <div>
      <div className="relative">
        {/* Gridlines at 25/50/75, so a score reads against a scale. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[100, 75, 50, 25, 0].map((mark) => (
            <span key={mark} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-[10px] font-medium tabular-nums text-cream/25">
                {mark}
              </span>
              <span className="h-px flex-1 bg-cream/[0.07]" />
            </span>
          ))}
        </div>

        <div className="relative ml-8 h-40">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
          >
            <title>Evidence score per round</title>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MINT} stopOpacity="0.42" />
                <stop offset="100%" stopColor={MINT} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {points.length > 1 ? (
              <>
                <polygon points={area} fill="url(#trend-fill)" />
                <polyline
                  points={line}
                  fill="none"
                  stroke={MINT}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
            <line
              x1="0"
              x2={width}
              y1={y(average)}
              y2={y(average)}
              stroke="rgba(239,232,214,0.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Dots sit in an overlay rather than the stretched SVG, so a
              non-uniform viewBox cannot turn them into ellipses. */}
          <div className="pointer-events-none absolute inset-0">
            {points.map((point, index) => (
              <Link
                key={point.sessionId}
                href={point.href}
                title={`Round ${point.index} · ${roundShortLabel(point.roundType)} · ${point.score}/100 · ${point.label}`}
                className="pointer-events-auto absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
                style={{
                  left: `${points.length > 1 ? (index / (points.length - 1)) * 100 : 50}%`,
                  top: `${100 - point.score}%`
                }}
              >
                <span
                  className="block h-2.5 w-2.5 rounded-full ring-2 ring-[#2a4aa0] transition hover:scale-125"
                  style={{ backgroundColor: scoreColor(point.score) }}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-8 mt-2 flex text-[10px] font-medium text-cream/35">
        {points.map((point, index) => (
          <span
            key={point.sessionId}
            className="flex-1 truncate"
            style={{
              textAlign: index === 0 ? "left" : index === points.length - 1 ? "right" : "center"
            }}
          >
            {points.length <= 8 || index === 0 || index === points.length - 1 ? point.label : ""}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <MiniStat label="First" value={String(points[0]?.score ?? 0)} />
        <MiniStat label="Average" value={average.toFixed(0)} />
        <MiniStat label="Latest" value={String(points.at(-1)?.score ?? 0)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ round mix */

function RoundTypes({
  rows,
  pressure
}: {
  rows: ReportRoundTypeRow[];
  pressure: ReportsOverview["pressure"];
}) {
  return (
    <div>
      {rows.length ? (
        <div className="grid gap-2.5">
          {rows.map((row) => (
            <div key={row.roundType} className="rounded-xl bg-[#24439b] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13.5px] font-semibold text-cream">{row.label}</p>
                <p className="text-[12.5px] font-medium tabular-nums text-cream/50">
                  {row.rounds} {row.rounds === 1 ? "round" : "rounds"}
                </p>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#1e3c88]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(row.averageScore, 3)}%`,
                    backgroundColor: scoreColor(row.averageScore)
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] font-medium text-cream/40">
                {row.averageScore} average evidence
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyNote>No scored rounds yet.</EmptyNote>
      )}

      <div className="mt-4 border-t border-cream/[0.09] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
          Interviewer pressure
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2.5">
          <MiniStat label="Probes" value={String(pressure.probes)} />
          <MiniStat label="Challenges" value={String(pressure.challenges)} />
          <MiniStat label="Clarifications" value={String(pressure.clarifications)} />
          <MiniStat label="Interruptions" value={String(pressure.interruptions)} />
        </dl>
        <p className="mt-3 text-[12px] leading-5 text-cream/40">
          {pressure.perRound} follow-ups per round.{" "}
          {pressure.perRound >= 6
            ? "Maya is working hard for your evidence — front-load the specifics."
            : pressure.perRound > 0
              ? "Answers are landing without much chasing."
              : "Not enough rounds to read a pattern yet."}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- matrix */

function Matrix({ matrix }: { matrix: ReportMatrix }) {
  if (!matrix.rows.length) return <EmptyNote>No scored competencies yet.</EmptyNote>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-y-1.5 text-left">
          <caption className="sr-only">Competency evidence score by round</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[12rem] pb-1 pr-3 text-left align-bottom">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/40">
                  Competency
                </span>
              </th>
              {matrix.rounds.map((round, index) => (
                <th key={round.sessionId} scope="col" className="pb-1 align-bottom">
                  <Link
                    href={round.href}
                    title={`${roundLabel(round.roundType)} · ${round.label}`}
                    className="block text-center text-[10.5px] font-semibold text-cream/40 transition hover:text-cream"
                  >
                    <span className="block tabular-nums">R{index + 1}</span>
                    <span className="mt-0.5 block truncate text-[9.5px] font-medium text-cream/28">
                      {round.label}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="pr-3 text-left align-middle">
                  <span className="block truncate text-[13px] font-semibold text-cream">
                    {row.label}
                  </span>
                </th>
                {row.cells.map((cell, index) => (
                  <td key={`${row.label}-${index}`} className="px-0.5 align-middle">
                    <span
                      title={
                        cell.score === null
                          ? `${row.label}: not asked in round ${index + 1}`
                          : `${row.label}: ${cell.score}/100 in round ${index + 1}`
                      }
                      className="mx-auto grid h-9 w-full min-w-[2.25rem] max-w-[3.5rem] place-items-center rounded-lg text-[12.5px] font-semibold tabular-nums"
                      style={
                        cell.score === null
                          ? { backgroundColor: "#1e3c88", color: "rgba(239,232,214,0.22)" }
                          : {
                              backgroundColor: cellBackground(cell.score),
                              color: cell.score >= 60 ? "#12306f" : "#efe8d6"
                            }
                      }
                    >
                      {cell.score ?? "·"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-cream/40">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: cellBackground(85) }} />
          Strong (75+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: cellBackground(58) }} />
          Developing (45–74)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: cellBackground(30) }} />
          Thin (under 45)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-[#1e3c88]" />
          Not asked
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- competencies */

function CompetencyRows({ rows }: { rows: ReportCompetencyRow[] }) {
  if (!rows.length) return <EmptyNote>No competency evidence yet.</EmptyNote>;

  return (
    <div className="grid gap-2.5">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl bg-[#24439b] p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-[13.5px] font-semibold text-cream">{row.label}</p>
            <p className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tabular-nums text-cream">
              {row.averageScore}
              {row.delta !== 0 ? (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11.5px] ${row.delta > 0 ? "text-[#a9f0d0]" : "text-[#f0a3a3]"}`}
                >
                  {row.delta > 0 ? (
                    <TrendingUp size={11} aria-hidden="true" />
                  ) : (
                    <TrendingDown size={11} aria-hidden="true" />
                  )}
                  {Math.abs(row.delta)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#1e3c88]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(row.averageScore, 2)}%`,
                backgroundColor: scoreColor(row.averageScore)
              }}
            />
          </div>

          <p className="mt-2 text-[11.5px] font-medium text-cream/40">
            {row.rounds} {row.rounds === 1 ? "round" : "rounds"} · {row.answered} answered
            {row.unanswered > 0 ? ` · ${row.unanswered} skipped` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function Gaps({ gaps }: { gaps: ReportGap[] }) {
  if (!gaps.length) {
    return (
      <div className="rounded-xl bg-[#24439b] p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#8be6bd]/16 text-[#a9f0d0]">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <p className="mt-3.5 text-[14px] font-semibold text-cream">No recurring weak spot</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-5 text-cream/45">
          Every competency you have answered is scoring at or above strong. Raise the intensity or
          try a harder round type.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {gaps.map((gap) => (
        <article key={gap.label} className="rounded-xl bg-[#24439b] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-cream">{gap.label}</p>
              <p className="mt-0.5 text-[11.5px] font-medium text-cream/40">
                {gap.averageScore} average across {gap.occurrences}{" "}
                {gap.occurrences === 1 ? "round" : "rounds"}
              </p>
            </div>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums"
              style={{
                backgroundColor: `${scoreColor(gap.averageScore)}22`,
                color: scoreColor(gap.averageScore)
              }}
            >
              {gap.averageScore}
            </span>
          </div>

          <p className="mt-2.5 text-[12.5px] leading-5 text-cream/55">{gap.nextStep}</p>

          <Link
            href={gap.practiceHref}
            className="group mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-cream/[0.08] px-3 text-[12.5px] font-semibold text-cream/75 transition hover:bg-cream/[0.14] hover:text-cream"
          >
            <Target size={13} aria-hidden="true" />
            Practice this gap
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </article>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- round list */

function RoundList({ rounds }: { rounds: ReportRoundRow[] }) {
  if (!rounds.length) return <EmptyNote>No rounds yet.</EmptyNote>;

  return (
    <ol className="grid gap-2.5">
      {rounds.map((round) => (
        <li key={round.sessionId}>
          <Link
            href={round.href}
            className="group grid gap-4 rounded-xl bg-[#24439b] p-4 transition hover:bg-[#27479f] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg font-display text-[15px] font-semibold tabular-nums"
                style={
                  round.evidenceScore === null
                    ? { backgroundColor: "rgba(239,232,214,0.07)", color: "rgba(239,232,214,0.4)" }
                    : {
                        backgroundColor: `${scoreColor(round.evidenceScore)}22`,
                        color: scoreColor(round.evidenceScore)
                      }
                }
              >
                {round.evidenceScore ?? "—"}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[14.5px] font-semibold text-cream">
                    {roleLabel(round.role)} · {roundLabel(round.roundType)}
                  </h3>
                  <StatusBadge status={round.status} />
                  {round.templateTitle ? (
                    <span className="rounded-md bg-cream/[0.07] px-2 py-0.5 text-[11px] font-medium text-cream/50">
                      {round.templateTitle}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 truncate text-[13px] text-cream/45">{round.context}</p>

                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-medium text-cream/36">
                  <span className="font-mono">{roleInitials(round.role)}</span>
                  <span>{levelLabel(round.level)}</span>
                  <span className="capitalize">{round.intensity}</span>
                  <span>
                    {round.questionsCovered}/{round.questionCount} covered
                  </span>
                  <span>
                    {round.evidencedCount}/{round.competencyCount} evidenced
                  </span>
                  <span>{formatDuration(round.durationMs)}</span>
                  <time dateTime={new Date(round.startedAt).toISOString()}>
                    {formatShortDate(round.startedAt)}
                  </time>
                </div>

                {round.recommendedFocus ? (
                  <p className="mt-2 text-[12px] text-cream/42">
                    <span className="font-semibold text-cream/62">Focus:</span>{" "}
                    {round.recommendedFocus}
                  </p>
                ) : null}
              </div>
            </div>

            <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-cream/[0.07] px-4 text-[13.5px] font-semibold text-cream/70 transition group-hover:bg-cream/[0.13] group-hover:text-cream">
              {round.status === "in_progress" ? (
                <>
                  <Play size={14} aria-hidden="true" /> Resume
                </>
              ) : (
                <>
                  <FileText size={14} aria-hidden="true" /> Open report
                </>
              )}
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ empty page */

function NoReports({ firstName, exhausted }: { firstName: string; exhausted: boolean }) {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
      <div className="rounded-2xl bg-[#2a4aa0] p-8 text-center sm:p-14">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream text-[#254294]">
          <FileText size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-display text-[2rem] font-semibold tracking-tight text-cream sm:text-[2.4rem]">
          {firstName ? `No reports yet, ${firstName}.` : "No reports yet."}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-7 text-cream/60">
          Run a round with Maya and you get a report: what each answer evidenced, where the evidence
          thinned out, and the one retry worth doing next. Run a few and this page starts comparing
          them.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link
            href="/interviews"
            aria-disabled={exhausted}
            className={[
              "group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#1d3a86] transition",
              exhausted ? "pointer-events-none opacity-40" : "hover:from-white hover:to-[#efe8d6]"
            ].join(" ")}
          >
            <Mic size={15} aria-hidden="true" />
            {exhausted ? "Daily limit reached" : "Run your first round"}
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/progress"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream/[0.07] px-5 text-[14px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] hover:text-cream"
          >
            <Sparkles size={15} aria-hidden="true" /> See practice progress
          </Link>
        </div>

        <dl className="mx-auto mt-10 grid max-w-2xl gap-2.5 text-left sm:grid-cols-3">
          <Promise
            icon={ShieldCheck}
            title="Scored evidence"
            body="Each answer rated on ownership, specifics, rationale and outcome."
          />
          <Promise
            icon={Layers}
            title="Cross-round trend"
            body="Watch a competency move across rounds instead of guessing."
          />
          <Promise
            icon={Target}
            title="One clear retry"
            body="The single gap worth practising before your next round."
          />
        </dl>
      </div>
    </section>
  );
}

function Promise({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-[#24439b] p-4">
      <dt className="flex items-center gap-2 text-[13.5px] font-semibold text-cream">
        <Icon size={15} aria-hidden="true" className="text-[#a9f0d0]" />
        {title}
      </dt>
      <dd className="mt-1.5 text-[12.5px] leading-5 text-cream/45">{body}</dd>
    </div>
  );
}

/* ----------------------------------------------------------------- shared */

function Panel({
  title,
  subtitle,
  aside,
  children
}: {
  title: string;
  subtitle: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-cream/[0.09] pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-[1.35rem] font-semibold tracking-tight text-cream">
            {title}
          </h2>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-cream/45">{subtitle}</p>
        </div>
        {aside ? (
          <p className="hidden shrink-0 text-[12.5px] font-medium text-cream/40 sm:block">
            {aside}
          </p>
        ) : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#24439b] p-3">
      <p className="text-[11px] font-medium text-cream/40">{label}</p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums text-cream">{value}</p>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-[#24439b] p-4 text-[13.5px] leading-6 text-cream/50">{children}</p>
  );
}

function StatusBadge({ status }: { status: InterviewHistoryStatus }) {
  const label =
    status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Ended";
  return (
    <span
      className={[
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        status === "completed"
          ? "bg-[#8be6bd]/14 text-[#a9f0d0]"
          : status === "in_progress"
            ? "bg-cream/[0.12] text-cream/78"
            : "bg-cream/[0.06] text-cream/45"
      ].join(" ")}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ copy */

function headline(overview: ReportsOverview, firstName: string): string {
  if (overview.scoredRounds === 0) return "Your rounds, waiting on a first answer.";
  if (overview.scoredRounds === 1) {
    return firstName ? `One round on the board, ${firstName}.` : "One round on the board.";
  }
  if (overview.scoreDelta !== null && overview.scoreDelta >= 8) {
    return "Your evidence is getting stronger.";
  }
  if (overview.scoreDelta !== null && overview.scoreDelta <= -8) {
    return "Your evidence slipped since round one.";
  }
  return `${overview.scoredRounds} rounds, side by side.`;
}

function subheadline(overview: ReportsOverview): string {
  if (overview.scoredRounds === 0) {
    return "Answer at least one question in a round and it gets scored here, with the competencies it evidenced.";
  }

  const movement =
    overview.scoreDelta === null
      ? `Your first round scored ${overview.latestScore}.`
      : overview.scoreDelta > 0
        ? `You are up ${overview.scoreDelta} points since your first round.`
        : overview.scoreDelta < 0
          ? `You are down ${Math.abs(overview.scoreDelta)} points since your first round.`
          : "Your score is flat across rounds.";

  const gap = overview.recurringGaps[0];
  const gapLine = gap
    ? ` ${gap.label} is the one that keeps costing you, at ${gap.averageScore} across ${gap.occurrences} ${gap.occurrences === 1 ? "round" : "rounds"}.`
    : " Nothing is scoring below strong right now.";

  return `${movement}${gapLine}`;
}

function deltaLabel(delta: number | null): string | undefined {
  if (delta === null) return undefined;
  if (delta === 0) return "Flat since round one";
  return delta > 0 ? `+${delta} since round one` : `${delta} since round one`;
}

/* ----------------------------------------------------------------- utils */

function scoreColor(score: number): string {
  if (score >= 75) return MINT;
  if (score >= 45) return SKY;
  if (score > 0) return CORAL;
  return "rgba(239,232,214,0.3)";
}

/** Matrix cells read as a scale, so intensity tracks the score inside a band. */
function cellBackground(score: number): string {
  if (score >= 75) return `rgba(139,230,189,${(0.55 + (score - 75) / 100).toFixed(2)})`;
  if (score >= 45) return `rgba(159,199,255,${(0.32 + (score - 45) / 120).toFixed(2)})`;
  return `rgba(240,163,163,${(0.24 + score / 200).toFixed(2)})`;
}
