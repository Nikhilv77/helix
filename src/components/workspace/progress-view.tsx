import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Flame,
  Layers,
  Lock,
  Mic,
  Play,
  SkipForward,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import type {
  ProgressAttemptRow,
  ProgressChapterRow,
  ProgressDay,
  ProgressDifficulty,
  ProgressOverview,
  ProgressPattern,
  ProgressSessionRow,
  ProgressWeek
} from "@/lib/progress";
import type { WorkspaceCompetency } from "@/lib/types";

const MINT = "#8be6bd";
const SKY = "#9fc7ff";
const GOLD = "#f4c65a";
const CORAL = "#f0a3a3";

/**
 * Progress: one page that answers "how far am I, and is it moving?"
 *
 * Everything is server-rendered from the user's own roadmap rows and attempt
 * history. Tooltips are native `title` attributes rather than JS popovers, so
 * the whole surface stays a server component.
 */
export function ProgressView({
  overview,
  firstName
}: {
  overview: ProgressOverview;
  firstName: string;
}) {
  const { totals, streak, interview } = overview;
  const started = totals.completedQuestions > 0 || totals.attemptedQuestions > 0;

  return (
    <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10">
      <DocumentTitle title="Progress" />

      <Hero overview={overview} firstName={firstName} />

      {overview.hasRoadmap && totals.totalQuestions > 0 ? (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
            <Panel
              title="Consistency"
              subtitle={`${sum(overview.activity, (day) => day.solved)} questions solved across the last ${Math.round(overview.activity.length / 7)} weeks.`}
              aside={
                streak.longestDays > 0 ? `Longest streak: ${streak.longestDays} days` : undefined
              }
            >
              <Heatmap days={overview.activity} />

              <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MiniStat
                  label="Days active"
                  value={String(streak.activeDays)}
                  icon={CalendarDays}
                />
                <MiniStat label="Current streak" value={`${streak.currentDays}d`} icon={Flame} />
                <MiniStat label="Longest" value={`${streak.longestDays}d`} icon={TrendingUp} />
                <MiniStat
                  label="Questions opened"
                  value={String(totals.totalAttempts)}
                  icon={Layers}
                />
              </dl>
            </Panel>

            <Panel
              title="Momentum"
              subtitle="Questions solved per week."
              aside={weekOverWeekLabel(totals.solvedThisWeek, totals.solvedLastWeek)}
            >
              <WeeklyChart weeks={overview.weekly.slice(-14)} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Panel
              title="By difficulty"
              subtitle="Where the completed work actually sits."
              aside={`${totals.completedQuestions} of ${totals.totalQuestions} done`}
            >
              <DifficultyBreakdown rows={overview.difficulty} />
            </Panel>

            <Panel
              title="Pattern coverage"
              subtitle="Each DSA family in your path, by how much of it you have closed out."
              aside={coverageAside(overview.patterns)}
            >
              <PatternGrid patterns={overview.patterns} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Panel title="Track" subtitle="Your six sessions, and how far each one has gone.">
              <SessionTrack sessions={overview.sessions} />
            </Panel>

            <Panel
              title="Recent activity"
              subtitle="The last questions you touched."
              aside={
                streak.lastActiveAt
                  ? relativeTime(streak.lastActiveAt, overview.generatedAt)
                  : undefined
              }
            >
              <RecentActivity rows={overview.recent} now={overview.generatedAt} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Panel
              title="Chapters"
              subtitle="Pattern-by-pattern, inside the DSA session."
              aside={`${totals.completedChapters}/${totals.totalChapters} complete`}
            >
              <ChapterGrid chapters={overview.chapters} />
            </Panel>

            <Panel
              title="Interview evidence"
              subtitle="Competency scores from your completed mock rounds."
              aside={interview.strongest ? `Strongest: ${interview.strongest.label}` : undefined}
            >
              <CompetencyList
                competencies={interview.competencies}
                readiness={interview.readinessScore}
                completedSessions={interview.completedSessions}
              />
            </Panel>
          </div>
        </>
      ) : (
        <NotStarted started={started} hasRoadmap={overview.hasRoadmap} interview={interview} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({ overview, firstName }: { overview: ProgressOverview; firstName: string }) {
  const { totals, streak, nextUp, interview } = overview;
  const hoursPracticed = Math.round(totals.minutesPracticed / 60);
  const hoursRemaining = Math.round(totals.minutesRemaining / 60);

  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)] lg:items-stretch">
        <div className="flex min-w-0 flex-col rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#8be6bd]/14 px-2.5 py-1 text-[11.5px] font-semibold text-[#a9f0d0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8be6bd]" />
            {streak.currentDays > 0
              ? `${streak.currentDays}-day streak`
              : totals.completedQuestions > 0
                ? "Progress tracked"
                : "Not started yet"}
          </span>

          <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-semibold leading-10 tracking-tight text-cream sm:text-[2.4rem] sm:leading-[3rem]">
            {headline(totals.completionPercent, totals.completedQuestions, firstName)}
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-cream/70">
            {subheadline(overview)}
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link
              href={nextUp?.href ?? "/practice"}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Play size={15} aria-hidden="true" fill="currentColor" />
              {totals.completedQuestions > 0
                ? "Continue where you left off"
                : "Start your first question"}
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/interviews"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream/[0.07] px-5 text-[14px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] hover:text-cream"
            >
              <Mic size={15} aria-hidden="true" /> Run a mock round
            </Link>
          </div>

          {nextUp ? (
            <Link
              href={nextUp.href}
              className="group mt-4 flex items-center gap-3 rounded-xl bg-[#24439b] p-3.5 transition hover:bg-[#27479f]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream/[0.08] text-cream/70">
                <CircleDot size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/40">
                  Next up{nextUp.chapterTitle ? ` · ${nextUp.chapterTitle}` : ""}
                </span>
                <span className="mt-1 block truncate text-[14.5px] font-semibold text-cream">
                  {nextUp.title}
                </span>
              </span>
              {nextUp.difficulty ? <DifficultyChip difficulty={nextUp.difficulty} /> : null}
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="shrink-0 text-cream/30 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ) : null}

          <dl className="mt-auto grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
            <HeroStat
              icon={Check}
              label="Solved"
              value={String(totals.completedQuestions)}
              hint={`of ${totals.totalQuestions}`}
            />
            <HeroStat
              icon={Flame}
              label="Streak"
              value={`${streak.currentDays}d`}
              hint={streak.longestDays > 0 ? `best ${streak.longestDays}d` : "no solves yet"}
            />
            <HeroStat
              icon={Timer}
              label="Practice"
              value={`~${hoursPracticed}h`}
              hint={hoursRemaining > 0 ? `~${hoursRemaining}h left` : "estimated"}
            />
            <HeroStat
              icon={Sparkles}
              label="Readiness"
              value={interview.readinessScore === null ? "—" : String(interview.readinessScore)}
              hint={interview.readinessScore === null ? "after a mock" : "out of 100"}
            />
          </dl>
        </div>

        <CompletionCard overview={overview} />
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

/** The completion ring, split by how each question ended rather than one bar. */
function CompletionCard({ overview }: { overview: ProgressOverview }) {
  const { totals } = overview;
  const inProgress = Math.max(0, totals.attemptedQuestions - totals.completedQuestions);
  const untouched = Math.max(
    0,
    totals.totalQuestions - totals.completedQuestions - inProgress - totals.skippedQuestions
  );
  const segments = [
    { label: "Solved", value: totals.completedQuestions, color: MINT },
    { label: "In progress", value: inProgress, color: SKY },
    { label: "Skipped", value: totals.skippedQuestions, color: GOLD },
    { label: "Not started", value: untouched, color: "rgba(239,232,214,0.16)" }
  ].filter((segment) => segment.value > 0);

  return (
    <div className="flex flex-col items-center rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
      <p className="self-start text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
        Roadmap completion
      </p>

      <DonutRing
        segments={segments}
        total={totals.totalQuestions}
        centerValue={`${totals.completionPercent}%`}
        centerHint={`${totals.completedQuestions}/${totals.totalQuestions}`}
      />

      <dl className="mt-5 grid w-full gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <dt className="min-w-0 flex-1 truncate text-[13px] font-medium text-cream/60">
              {segment.label}
            </dt>
            <dd className="text-[13px] font-semibold tabular-nums text-cream">{segment.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
        <MiniStat
          label="Sessions"
          value={`${totals.completedSessions}/${totals.totalSessions}`}
          icon={Layers}
        />
        <MiniStat
          label="Chapters"
          value={`${totals.completedChapters}/${totals.totalChapters}`}
          icon={CalendarDays}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl bg-[#24439b] p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-cream/40">
        <Icon size={12} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums text-cream">{value}</p>
    </div>
  );
}

function DonutRing({
  segments,
  total,
  centerValue,
  centerHint
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
  centerValue: string;
  centerHint: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative mt-4 h-44 w-44">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img">
        <title>{`${centerValue} of the roadmap complete`}</title>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e3c88" strokeWidth="11" />
        {segments.map((segment) => {
          const length = total > 0 ? (segment.value / total) * circumference : 0;
          const dash = `${Math.max(0, length - 1.5)} ${circumference}`;
          const element = (
            <circle
              key={segment.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return element;
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-[2.1rem] font-semibold leading-none tabular-nums text-cream">
          {centerValue}
        </span>
        <span className="mt-1.5 text-[12px] font-medium tabular-nums text-cream/45">
          {centerHint}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- heatmap */

/**
 * Weeks run left to right, weekdays top to bottom. The window always starts on
 * a Monday so the rows line up with the weekday labels.
 */
function Heatmap({ days }: { days: ProgressDay[] }) {
  const padded = padToWeeks(days);
  const weeks: ProgressDay[][] = [];
  for (let index = 0; index < padded.length; index += 7) {
    weeks.push(padded.slice(index, index + 7));
  }

  const peak = Math.max(1, ...days.map((day) => day.solved));

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[38rem]">
        <div className="flex gap-[3px] pl-8 text-[10px] font-medium text-cream/35">
          {weeks.map((week, index) => {
            const label = monthLabelFor(weeks, index);
            return (
              <span key={week[0]?.date ?? index} className="w-[13px] shrink-0">
                {label}
              </span>
            );
          })}
        </div>

        <div className="mt-1.5 flex gap-[3px]">
          <div className="flex w-[26px] shrink-0 flex-col gap-[3px] pr-1 text-right text-[10px] font-medium leading-[13px] text-cream/35">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => (
              <span key={index} className="h-[13px]">
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, weekIndex) => (
            <div key={week[0]?.date ?? weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day, dayIndex) =>
                day.date ? (
                  <span
                    key={day.date}
                    title={`${day.solved} solved · ${day.attempts} ${day.attempts === 1 ? "attempt" : "attempts"} · ${longDate(day.date)}`}
                    className="h-[13px] w-[13px] rounded-[3px]"
                    style={{ backgroundColor: cellColor(day, peak) }}
                  />
                ) : (
                  <span key={`pad-${weekIndex}-${dayIndex}`} className="h-[13px] w-[13px]" />
                )
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 pl-8 text-[11px] font-medium text-cream/40">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              className="h-[11px] w-[11px] rounded-[3px]"
              style={{
                backgroundColor: step === 0 ? "#1e3c88" : `rgba(139,230,189,${0.2 + step * 0.8})`
              }}
            />
          ))}
          <span>More</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-[11px] w-[11px] rounded-[3px] bg-cream/[0.13]" />
            Opened, not solved
          </span>
        </div>
      </div>
    </div>
  );
}

function cellColor(day: ProgressDay, peak: number): string {
  if (day.solved === 0) return day.attempts > 0 ? "rgba(239,232,214,0.13)" : "#1e3c88";
  const intensity = 0.28 + (Math.min(day.solved, peak) / peak) * 0.72;
  return `rgba(139,230,189,${intensity.toFixed(2)})`;
}

/* --------------------------------------------------------- weekly chart */

function WeeklyChart({ weeks }: { weeks: ProgressWeek[] }) {
  if (!weeks.length) return <EmptyNote>No practice recorded yet.</EmptyNote>;

  const peak = Math.max(1, ...weeks.map((week) => week.solved));
  const average = weeks.reduce((total, week) => total + week.solved, 0) / weeks.length;

  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5">
        {average > 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-cream/20"
            style={{ bottom: `${(average / peak) * 100}%` }}
          />
        ) : null}

        {weeks.map((week) => {
          const height = week.solved === 0 ? 2 : Math.max(6, (week.solved / peak) * 100);
          return (
            <div
              key={week.weekStart}
              title={`Week of ${week.label}: ${week.solved} solved, ${week.attempts} attempts`}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span
                className="w-full rounded-t-[4px] transition-[height]"
                style={{
                  height: `${height}%`,
                  background:
                    week.solved === 0
                      ? "rgba(239,232,214,0.13)"
                      : "linear-gradient(180deg,#bff3dc,#8be6bd)"
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 text-[10px] font-medium text-cream/35">
        {weeks.map((week, index) => (
          <span key={week.weekStart} className="flex-1 truncate text-center">
            {index % 3 === 0 || index === weeks.length - 1 ? week.label : ""}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MiniStat label="This week" value={String(weeks.at(-1)?.solved ?? 0)} icon={TrendingUp} />
        <MiniStat label="Weekly average" value={average.toFixed(1)} icon={CalendarDays} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ difficulty */

function DifficultyBreakdown({ rows }: { rows: ProgressDifficulty[] }) {
  if (!rows.length) return <EmptyNote>No questions in your path yet.</EmptyNote>;

  const color = { easy: MINT, medium: SKY, hard: CORAL } as const;

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <div key={row.difficulty}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-semibold capitalize text-cream">{row.difficulty}</p>
            <p className="text-[13px] font-medium tabular-nums text-cream/50">
              <span className="font-semibold text-cream">{row.completed}</span> / {row.total}
            </p>
          </div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[#1e3c88]">
            <span
              className="h-full"
              style={{
                width: `${(row.completed / row.total) * 100}%`,
                backgroundColor: color[row.difficulty]
              }}
            />
            <span
              className="h-full bg-cream/[0.16]"
              style={{ width: `${(row.attempted / row.total) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-cream/40">
            {row.percent}% complete
            {row.attempted > 0 ? ` · ${row.attempted} in progress` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- patterns */

function PatternGrid({ patterns }: { patterns: ProgressPattern[] }) {
  if (!patterns.length) {
    return <EmptyNote>Pattern coverage appears once your practice path is built.</EmptyNote>;
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {patterns.map((pattern) => (
        <div key={pattern.pattern} className="rounded-xl bg-[#24439b] p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-[13.5px] font-semibold text-cream">
              {pattern.label}
            </p>
            <p className="shrink-0 text-[12.5px] font-semibold tabular-nums text-cream/55">
              {pattern.completed}/{pattern.total}
            </p>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#1e3c88]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(pattern.percent, pattern.completed > 0 ? 4 : 0)}%`,
                background:
                  pattern.percent >= 100
                    ? MINT
                    : "linear-gradient(90deg,rgba(139,230,189,0.75),#8be6bd)"
              }}
            />
          </div>
          <p className="mt-2 text-[11.5px] font-medium text-cream/40">
            {pattern.percent === 100
              ? "Complete"
              : pattern.completed === 0 && pattern.attempted === 0
                ? "Not started"
                : `${pattern.percent}%${pattern.skipped > 0 ? ` · ${pattern.skipped} skipped` : ""}`}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- session track */

function SessionTrack({ sessions }: { sessions: ProgressSessionRow[] }) {
  if (!sessions.length) return <EmptyNote>Your session track has not been built yet.</EmptyNote>;

  return (
    <ol className="grid gap-2.5">
      {sessions.map((session) => {
        const locked = session.status === "LOCKED";
        const done = session.status === "COMPLETED";

        return (
          <li key={session.id}>
            <Link
              href={session.href}
              className="group grid gap-3 rounded-xl bg-[#24439b] p-4 transition hover:bg-[#27479f] sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <span
                  className={[
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[12px] font-semibold",
                    done
                      ? "bg-[#8be6bd]/16 text-[#a9f0d0]"
                      : locked
                        ? "bg-cream/[0.06] text-cream/35"
                        : "bg-cream/[0.1] text-cream/70"
                  ].join(" ")}
                >
                  {done ? (
                    <Check size={16} aria-hidden="true" />
                  ) : locked ? (
                    <Lock size={14} aria-hidden="true" />
                  ) : (
                    String(session.order).padStart(2, "0")
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-cream">{session.title}</p>
                  <p className="mt-0.5 text-[12.5px] font-medium text-cream/40">
                    {session.totalQuestions > 0
                      ? `${session.completedQuestions} of ${session.totalQuestions} questions`
                      : "Content coming with this session"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1e3c88]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#8be6bd] to-[#bff3dc]"
                    style={{ width: `${session.percent}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-cream/60">
                  {session.percent}%
                </span>
                <ChevronRight
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-cream/25 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- chapters */

function ChapterGrid({ chapters }: { chapters: ProgressChapterRow[] }) {
  if (!chapters.length) return <EmptyNote>No chapters in your path yet.</EmptyNote>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {chapters.map((chapter) => (
        <Link
          key={chapter.id}
          href={chapter.href}
          className="group flex items-center gap-3 rounded-xl bg-[#24439b] p-3 transition hover:bg-[#27479f]"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1e3c88" strokeWidth="4" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={chapter.percent >= 100 ? MINT : SKY}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 15}
                strokeDashoffset={2 * Math.PI * 15 * (1 - chapter.percent / 100)}
              />
            </svg>
            <span className="absolute text-[9.5px] font-semibold tabular-nums text-cream/70">
              {chapter.percent}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-cream">
              {chapter.title}
            </span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-cream/40">
              {chapter.completedQuestions}/{chapter.totalQuestions} questions
            </span>
          </span>
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="shrink-0 text-cream/25 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- activity */

function RecentActivity({ rows, now }: { rows: ProgressAttemptRow[]; now: number }) {
  if (!rows.length) {
    return <EmptyNote>Nothing yet. Open a question and it shows up here.</EmptyNote>;
  }

  const meta = {
    COMPLETED: { icon: Check, tone: "bg-[#8be6bd]/16 text-[#a9f0d0]", label: "Solved" },
    SKIPPED: { icon: SkipForward, tone: "bg-[#f4c65a]/14 text-[#f8dda0]", label: "Skipped" },
    SUBMITTED: { icon: ArrowUpRight, tone: "bg-cream/[0.1] text-cream/70", label: "Submitted" },
    STARTED: { icon: Circle, tone: "bg-cream/[0.07] text-cream/45", label: "Opened" }
  } as const;

  return (
    <ol className="grid gap-2">
      {rows.map((row) => {
        const { icon: Icon, tone, label } = meta[row.status] ?? meta.STARTED;
        const body = (
          <>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-cream">
                {row.title}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] font-medium text-cream/40">
                {label}
                {row.pattern ? ` · ${row.pattern.replace(/-/g, " ")}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-cream/35">
              {relativeTime(row.at, now)}
            </span>
          </>
        );

        return (
          <li key={row.id}>
            {row.href ? (
              <Link
                href={row.href}
                className="flex items-center gap-3 rounded-xl bg-[#24439b] p-3 transition hover:bg-[#27479f]"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-[#24439b] p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------ competency */

function CompetencyList({
  competencies,
  readiness,
  completedSessions
}: {
  competencies: WorkspaceCompetency[];
  readiness: number | null;
  completedSessions: number;
}) {
  if (!competencies.length) {
    return (
      <div className="rounded-xl bg-[#24439b] p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-cream/[0.08] text-cream/60">
          <Mic size={18} aria-hidden="true" />
        </span>
        <p className="mt-3.5 text-[14px] font-semibold text-cream">No interview evidence yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-5 text-cream/45">
          Practice proves you did the reps. A mock round proves you can explain them.
        </p>
        <Link
          href="/interviews"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-cream/[0.09] px-4 text-[13px] font-semibold text-cream/80 transition hover:bg-cream/[0.15] hover:text-cream"
        >
          Run a round <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-3 rounded-xl bg-[#24439b] p-3.5">
        <span className="font-display text-[1.6rem] font-semibold tabular-nums leading-none text-cream">
          {readiness ?? "—"}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-cream/75">Evidence readiness</span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-cream/40">
            Across {completedSessions} completed {completedSessions === 1 ? "round" : "rounds"}
          </span>
        </span>
      </div>

      {competencies.map((competency) => (
        <div key={competency.label} className="rounded-xl bg-[#24439b] p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-[13.5px] font-semibold text-cream">
              {competency.label}
            </p>
            <p className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold tabular-nums text-cream">
              {competency.score}
              {competency.trend !== 0 ? (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11.5px] ${competency.trend > 0 ? "text-[#a9f0d0]" : "text-[#f0a3a3]"}`}
                >
                  {competency.trend > 0 ? (
                    <TrendingUp size={11} aria-hidden="true" />
                  ) : (
                    <TrendingDown size={11} aria-hidden="true" />
                  )}
                  {Math.abs(competency.trend)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1e3c88]">
            <span
              className="block h-full rounded-full bg-[#9be8c1]"
              style={{ width: `${competency.score}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] font-medium text-cream/40">
            {competency.attempts} {competency.attempts === 1 ? "answer" : "answers"} scored
          </p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ empty state */

function NotStarted({
  started,
  hasRoadmap,
  interview
}: {
  started: boolean;
  hasRoadmap: boolean;
  interview: ProgressOverview["interview"];
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Panel
        title={hasRoadmap ? "Nothing measured yet" : "Your path is not built yet"}
        subtitle={
          hasRoadmap
            ? "Solve one question and this page fills in: streaks, pattern coverage, weekly momentum."
            : "Progress tracking follows your preparation path. Finish onboarding and pick a target role to build one."
        }
      >
        <div className="rounded-xl bg-[#24439b] p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-cream text-[#254294]">
            <Sparkles size={19} aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-display text-[1.35rem] font-semibold tracking-tight text-cream">
            {started ? "Almost there" : "Start with one question"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-cream/50">
            Everything on this page is measured from what you actually do — questions solved,
            patterns closed out, mock rounds scored. None of it is a guess.
          </p>
          <Link
            href={hasRoadmap ? "/practice" : "/"}
            className="group mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-5 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6]"
          >
            {hasRoadmap ? "Open practice" : "Go to your plan"}
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </Panel>

      <Panel title="Interview evidence" subtitle="Competency scores from your mock rounds.">
        <CompetencyList
          competencies={interview.competencies}
          readiness={interview.readinessScore}
          completedSessions={interview.completedSessions}
        />
      </Panel>
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
          <p className="mt-1.5 text-[13px] leading-6 text-cream/45">{subtitle}</p>
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

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-[#24439b] p-4 text-[13.5px] leading-6 text-cream/50">{children}</p>
  );
}

function DifficultyChip({ difficulty }: { difficulty: string }) {
  const tone =
    difficulty === "easy"
      ? "bg-[#8be6bd]/14 text-[#a9f0d0]"
      : difficulty === "hard"
        ? "bg-[#f0a3a3]/14 text-[#f5c4c4]"
        : "bg-[#9fc7ff]/14 text-[#cfe7ff]";
  return (
    <span
      className={`hidden shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold capitalize sm:inline ${tone}`}
    >
      {difficulty}
    </span>
  );
}

/* ------------------------------------------------------------------ copy */

function headline(percent: number, completed: number, firstName: string): string {
  if (completed === 0) {
    return firstName ? `Let's get you on the board, ${firstName}.` : "Let's get you on the board.";
  }
  if (percent >= 100) return "Roadmap complete. Now defend it in a mock.";
  if (percent >= 60) return `${percent}% through — the hard part is behind you.`;
  if (percent >= 25) return `${percent}% through your roadmap.`;
  return `${completed} down. The path is taking shape.`;
}

function subheadline(overview: ProgressOverview): string {
  const { totals, streak } = overview;

  if (totals.completedQuestions === 0) {
    return "Solve your first question and this page starts tracking streaks, pattern coverage and weekly momentum.";
  }

  const pace =
    totals.solvedThisWeek > totals.solvedLastWeek
      ? `You are ahead of last week's pace (${totals.solvedThisWeek} vs ${totals.solvedLastWeek}).`
      : totals.solvedThisWeek < totals.solvedLastWeek
        ? `Last week you solved ${totals.solvedLastWeek}; this week is at ${totals.solvedThisWeek}.`
        : `${totals.solvedThisWeek} solved this week, matching last week.`;

  const streakLine =
    streak.currentDays > 1
      ? ` ${streak.currentDays} days in a row so far.`
      : streak.currentDays === 0 && streak.lastSolvedAt
        ? ` Your last solve was ${relativeTime(streak.lastSolvedAt, overview.generatedAt)} — one today restarts the streak.`
        : "";

  return `${pace}${streakLine} About ${Math.round(totals.minutesRemaining / 60)} hours of practice left in the path.`;
}

function weekOverWeekLabel(thisWeek: number, lastWeek: number): string {
  const delta = thisWeek - lastWeek;
  if (delta === 0) return "Flat vs last week";
  return delta > 0 ? `+${delta} vs last week` : `${delta} vs last week`;
}

function coverageAside(patterns: ProgressPattern[]): string | undefined {
  if (!patterns.length) return undefined;
  const complete = patterns.filter((pattern) => pattern.percent >= 100).length;
  return `${complete}/${patterns.length} patterns closed`;
}

/* ----------------------------------------------------------------- utils */

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

/**
 * Pads the front of the window so the first column starts on a Monday and the
 * last column runs to Sunday. Padding entries carry an empty date and render
 * as blank space.
 */
function padToWeeks(days: ProgressDay[]): ProgressDay[] {
  if (!days.length) return [];

  const first = new Date(`${days[0]!.date}T00:00:00.000Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  const last = new Date(`${days.at(-1)!.date}T00:00:00.000Z`);
  const trailing = 6 - ((last.getUTCDay() + 6) % 7);
  const blank: ProgressDay = { date: "", solved: 0, attempts: 0 };

  return [
    ...Array.from({ length: leading }, () => blank),
    ...days,
    ...Array.from({ length: trailing }, () => blank)
  ];
}

/** A month name above the first column that starts a new month. */
function monthLabelFor(weeks: ProgressDay[][], index: number): string {
  const current = weeks[index]?.find((day) => day.date)?.date;
  if (!current) return "";

  const previous = weeks[index - 1]?.find((day) => day.date)?.date;
  const month = current.slice(0, 7);
  if (previous && previous.slice(0, 7) === month) return "";

  return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    new Date(`${current}T00:00:00.000Z`)
  );
}

function longDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function relativeTime(at: number, now: number): string {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(at);
}
