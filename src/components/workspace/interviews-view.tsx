import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleUserRound,
  FileText,
  Mic,
  Play,
  Target
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { InterviewsMaya } from "@/components/workspace/interviews-maya";
import { formatDate, formatDuration, roleInitials, roleLabel, roundLabel } from "@/lib/labels";
import type {
  CandidateProfile,
  InterviewHistoryItem,
  Role,
  WorkspaceCompetency,
  WorkspaceInsights
} from "@/lib/types";

interface InterviewsViewProps {
  quota: { used: number; limit: number };
  sessions: InterviewHistoryItem[];
  profile: CandidateProfile;
  insights: WorkspaceInsights;
  historyAvailable?: boolean;
}

/**
 * Everything interview-shaped, on its own page: starting a round, the evidence
 * your answers have produced, and the history those reports hang off.
 *
 * This used to sit on Home underneath the plan. Home is now the plan alone, so
 * these surfaces moved here rather than being deleted.
 */
export function InterviewsView({
  quota,
  sessions,
  profile,
  insights,
  historyAvailable = true
}: InterviewsViewProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const active = sessions.find((session) => session.status === "in_progress");
  const targetRole = profile.targetRole ?? sessions[0]?.setup.role ?? null;
  const targetLevel = profile.level ?? sessions[0]?.setup.level ?? null;
  const focus = insights.recommendedFocus?.label ?? profile.focusAreas[0] ?? null;
  const practiceHref = buildPracticeHref(targetRole, targetLevel, focus);
  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10">
      <DocumentTitle title="Interviews" />

      <MayaHero
        firstName={firstName}
        active={active}
        focus={focus}
        practiceHref={practiceHref}
        exhausted={exhausted}
        remaining={remaining}
        quota={quota}
        insights={insights}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <Panel
            id="progress"
            title="Competency evidence"
            subtitle="Signals from your completed interview answers."
            aside={insights.strongest ? `Strongest: ${insights.strongest.label}` : null}
          >
            {insights.competencyMap.length ? (
              <div className="grid gap-2.5">
                {insights.competencyMap.map((competency) => (
                  <CompetencyRow key={competency.label} competency={competency} />
                ))}
              </div>
            ) : (
              <EmptyNote>Competency signals appear after your first completed interview.</EmptyNote>
            )}
          </Panel>

          <Panel
            id="sessions"
            title="Interview history"
            subtitle="Every round you have run, with its report."
          >
            {!historyAvailable || !sessions.length ? (
              <div className="rounded-xl bg-[#24439b] p-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-cream text-[#254294]">
                  <Mic size={19} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-[1.35rem] font-semibold tracking-tight text-cream">
                  No interview evidence yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-cream/50">
                  Run a baseline round. Its report will appear here with strengths, gaps, transcript
                  evidence, and a targeted retry.
                </p>
                <Link
                  href={practiceHref}
                  className="group mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-5 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6]"
                >
                  Start baseline
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {sessions.slice(0, 8).map((session) => (
                  <SessionRow key={session.sessionId} session={session} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <ReadinessPanel
            score={insights.readinessScore}
            completed={insights.completedSessions}
            sessionsThisWeek={insights.sessionsThisWeek}
            answeredQuestions={insights.answeredQuestions}
          />
          <PreparationPanel profile={profile} targetRole={targetRole} />
        </div>
      </div>
    </div>
  );
}

/** Section card, so content sits on a surface instead of the shell's base. */
function Panel({
  id,
  title,
  subtitle,
  aside,
  children
}: {
  id?: string;
  title: string;
  subtitle: string;
  aside?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl bg-[#2a4aa0] p-5 sm:p-6 lg:scroll-mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-cream/[0.09] pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-[1.5rem] font-semibold tracking-tight text-cream">
            {title}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-6 text-cream/45">{subtitle}</p>
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

function MayaHero({
  firstName,
  active,
  focus,
  practiceHref,
  exhausted,
  remaining,
  quota,
  insights
}: {
  firstName: string;
  active: InterviewHistoryItem | undefined;
  focus: string | null;
  practiceHref: string;
  exhausted: boolean;
  remaining: number;
  quota: { used: number; limit: number };
  insights: WorkspaceInsights;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-stretch">
        <div className="flex min-w-0 flex-col rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#8be6bd]/14 px-2.5 py-1 text-[11.5px] font-semibold text-[#a9f0d0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8be6bd]" />
            Maya is ready
          </span>

          <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-semibold leading-10 tracking-tight text-cream sm:text-[2.4rem] sm:leading-[3rem]">
            {firstName ? `Ready when you are, ${firstName}.` : "Ready when you are."}
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-cream/70">
            {active
              ? `You have a round in progress: ${active.questionsCovered} of ${active.questionCount} questions covered. I will pick up with the same context.`
              : focus
                ? `Pick a round and I will press on your real evidence. Current focus: ${focus}.`
                : "Pick a round. I ask from your actual experience, then score the evidence in your answers."}
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {active ? (
              <Link
                href={`/interview/voice?session=${active.sessionId}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Play size={15} aria-hidden="true" fill="currentColor" /> Resume interview
              </Link>
            ) : (
              <Link
                href={practiceHref}
                aria-disabled={exhausted}
                className={[
                  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#1d3a86] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  exhausted
                    ? "pointer-events-none opacity-40"
                    : "hover:from-white hover:to-[#efe8d6]"
                ].join(" ")}
              >
                <Mic size={15} aria-hidden="true" />
                {exhausted ? "Daily limit reached" : "Start an interview"}
              </Link>
            )}
            <Link
              href="#sessions"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream/[0.07] px-5 text-[14px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] hover:text-cream"
            >
              View history <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <dl className="mt-auto grid grid-cols-1 gap-3 pt-7 sm:grid-cols-3">
            <HeroPill
              label="Readiness"
              value={insights.readinessScore === null ? "\u2014" : `${insights.readinessScore}`}
              hint={insights.readinessScore === null ? "After first round" : "Out of 100"}
            />
            <HeroPill label="Rounds today" value={`${remaining}`} hint={`Of ${quota.limit} left`} />
            <HeroPill
              label="Completed"
              value={String(insights.completedSessions)}
              hint="Scored interviews"
            />
          </dl>
        </div>

        <InterviewsMaya
          firstName={firstName}
          focus={focus}
          remaining={remaining}
          completedSessions={insights.completedSessions}
          hasActiveRound={Boolean(active)}
        />
      </div>
    </section>
  );
}

function HeroPill({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-[#24439b] p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">
        {label}
      </dt>
      <dd className="mt-2">
        <span className="block font-display text-[1.6rem] font-semibold tracking-tight text-cream">
          {value}
        </span>
        <span className="mt-1 block text-[12.5px] font-medium text-cream/45">{hint}</span>
      </dd>
    </div>
  );
}

function ReadinessPanel({
  score,
  completed,
  sessionsThisWeek,
  answeredQuestions
}: {
  score: number | null;
  completed: number;
  sessionsThisWeek: number;
  answeredQuestions: number;
}) {
  const safeScore = score ?? 0;
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="flex items-center gap-5 rounded-xl bg-[#24439b] p-5 sm:p-6 lg:flex-col lg:items-start">
      <div className="relative h-28 w-28 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          aria-label={
            score === null ? "Readiness awaiting baseline" : `Evidence readiness ${score}%`
          }
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#9be8c1"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - safeScore / 100)}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span className="text-2xl font-semibold text-cream">{score ?? "—"}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-cream/45">Evidence readiness</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
          {score === null
            ? "Awaiting baseline"
            : score >= 75
              ? "Strong signal"
              : score >= 55
                ? "Building signal"
                : "Needs more evidence"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-cream/46">
          Based on {completed} completed {completed === 1 ? "round" : "rounds"}, not a hiring
          prediction.
        </p>
        <dl className="mt-4 flex gap-3 lg:mt-5">
          <div>
            <dt className="text-xs text-cream/38">This week</dt>
            <dd className="mt-1 text-sm font-semibold text-cream">
              {sessionsThisWeek} {sessionsThisWeek === 1 ? "round" : "rounds"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-cream/38">Answers</dt>
            <dd className="mt-1 text-sm font-semibold text-cream">{answeredQuestions} reviewed</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function CompetencyRow({ competency }: { competency: WorkspaceCompetency }) {
  return (
    <div className="grid gap-4 rounded-xl bg-[#24439b] p-4 sm:grid-cols-[12rem_minmax(0,1fr)_4rem] sm:items-center">
      <div>
        <p className="text-base font-semibold text-cream">{competency.label}</p>
        <p className="mt-1 text-sm text-cream/38">
          {competency.attempts} {competency.attempts === 1 ? "answer" : "answers"}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#1e3c88]">
        <div
          className="h-full rounded-full bg-[#9be8c1] transition-[width]"
          style={{ width: `${competency.score}%` }}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5 text-lg font-semibold text-cream">
        <span>{competency.score}</span>
        {competency.trend !== 0 ? (
          <span className={competency.trend > 0 ? "text-[#9be8c1]" : "text-[#ffc2c2]"}>
            {competency.trend > 0 ? "+" : ""}
            {competency.trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PreparationPanel({
  profile,
  targetRole
}: {
  profile: CandidateProfile;
  targetRole: Role | null;
}) {
  const days = daysUntil(profile.targetDate);
  return (
    <aside className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-[#254294]">
          <Target size={17} />
        </span>
        <span className="rounded-md bg-cream/[0.07] px-2.5 py-1 text-[11.5px] font-semibold text-cream/50">
          {profile.completeness}% complete
        </span>
      </div>
      <p className="mt-6 text-sm font-semibold text-cream/45">Preparation target</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
        {targetRole ? `${roleLabel(targetRole)} interview` : "Set your target role"}
      </h2>
      {profile.targetCompany ? (
        <p className="mt-1 text-sm text-cream/50">{profile.targetCompany}</p>
      ) : null}
      <div className="mt-6 grid gap-3">
        <InfoLine
          icon={CalendarDays}
          label="Interview date"
          value={days === null ? "Not set" : days <= 0 ? "Today" : `${days} days`}
        />
        <InfoLine
          icon={CircleUserRound}
          label="Story bank"
          value={`${profile.stories.length} ${profile.stories.length === 1 ? "story" : "stories"}`}
        />
        <InfoLine
          icon={Target}
          label="Focus areas"
          value={profile.focusAreas.length ? profile.focusAreas.slice(0, 2).join(", ") : "Not set"}
        />
      </div>
      <Link
        href="/profile"
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cream/[0.07] text-[14px] font-semibold text-cream/75 transition hover:bg-cream/[0.13] hover:text-cream"
      >
        Edit interview memory <ArrowRight size={14} />
      </Link>
    </aside>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[#24439b] p-3.5">
      <Icon size={16} className="mt-0.5 text-cream/42" />
      <div className="min-w-0">
        <p className="text-xs text-cream/38">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-cream/72">{value}</p>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: InterviewHistoryItem }) {
  const href =
    session.status === "in_progress"
      ? `/interview/voice?session=${session.sessionId}`
      : `/sessions/${session.sessionId}`;
  return (
    <article className="group grid gap-5 rounded-xl bg-[#24439b] p-4 transition hover:bg-[#27479f] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream/[0.07] font-mono text-[11px] font-semibold text-cream/65">
          {roleInitials(session.setup.role)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-semibold text-cream">
              {roleLabel(session.setup.role)} · {roundLabel(session.setup.roundType)}
            </h3>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1.5 truncate text-sm text-cream/46">{session.setup.context}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cream/36">
            <span>
              {session.questionsCovered}/{session.questionCount} questions
            </span>
            <span>{formatDuration(session.durationMs)}</span>
            <time dateTime={new Date(session.startedAt).toISOString()}>
              {formatDate(session.startedAt)}
            </time>
          </div>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cream/[0.07] px-4 text-[13.5px] font-semibold text-cream/70 transition group-hover:bg-cream/[0.13] group-hover:text-cream"
      >
        {session.status === "in_progress" ? <Play size={14} /> : <FileText size={14} />}{" "}
        {session.status === "in_progress" ? "Resume" : "Open report"}
      </Link>
    </article>
  );
}

function StatusBadge({ status }: { status: InterviewHistoryItem["status"] }) {
  const label =
    status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Ended";
  return (
    <span
      className={[
        "rounded-full px-3 py-1 text-xs font-semibold",
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
function buildPracticeHref(
  role: Role | null,
  level: CandidateProfile["level"],
  focus: string | null
): string {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (level) params.set("level", level);
  if (focus) params.set("focus", focus);
  const query = params.toString();
  return query ? `/interview?${query}` : "/interview";
}
function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}
