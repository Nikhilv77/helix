import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FileText,
  Mic,
  ListChecks,
  Map,
  Play,
  Target,
  TrendingUp
} from "lucide-react";
import { InterviewTemplateGrid } from "@/components/workspace/interview-templates";
import { MayaStage } from "@/components/workspace/maya-stage";
import { MayaWelcome } from "@/components/workspace/maya-welcome";
import type {
  CandidateProfile,
  InterviewHistoryItem,
  Role,
  WorkspaceCompetency,
  WorkspaceInsights
} from "@/lib/types";

interface DashboardProps {
  quota: { used: number; limit: number };
  sessions: InterviewHistoryItem[];
  profile: CandidateProfile;
  insights: WorkspaceInsights;
  historyAvailable?: boolean;
  showMayaWelcome?: boolean;
}

export function Dashboard({
  quota,
  sessions,
  profile,
  insights,
  historyAvailable = true,
  showMayaWelcome = false
}: DashboardProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const active = sessions.find((session) => session.status === "in_progress");
  const targetRole = profile.targetRole ?? sessions[0]?.setup.role ?? null;
  const targetLevel = profile.level ?? sessions[0]?.setup.level ?? null;
  const focus = insights.recommendedFocus?.label ?? profile.focusAreas[0] ?? null;
  const practiceHref = buildPracticeHref(targetRole, targetLevel, focus);

  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="pb-4">
      {showMayaWelcome ? <MayaWelcome profile={profile} practiceHref={practiceHref} /> : null}

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

      <div className="mx-auto w-full max-w-[86rem] px-5 sm:px-8">
        <InterviewTemplateGrid role={targetRole} level={targetLevel} locked={exhausted} />

        {profile.resume?.roadmap.length || profile.resume?.practiceQuestions.length ? (
          <PreparationPlan profile={profile} practiceHref={practiceHref} />
        ) : null}

        <section
          id="progress"
          className="mt-10 scroll-mt-20 lg:scroll-mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
        >
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="blueprint-label text-cream/35">Progress</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
                  Competency evidence
                </h2>
              </div>
              {insights.strongest ? (
                <p className="hidden text-xs text-cream/38 sm:block">
                  Strongest: {insights.strongest.label}
                </p>
              ) : null}
            </div>

            {insights.competencyMap.length ? (
              <div className="mt-5 divide-y divide-cream/10 overflow-hidden rounded-2xl border border-cream/14 bg-blueprint-deep/65">
                {insights.competencyMap.map((competency) => (
                  <CompetencyRow key={competency.label} competency={competency} />
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-cream/20 bg-white/[0.025] px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cream/18 text-cream">
                  <TrendingUp size={18} />
                </span>
                <h3 className="mt-5 font-semibold text-cream">
                  Your evidence map starts after one round
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-cream/42">
                  Helix scores what your answers actually demonstrate: ownership, decisions,
                  specifics, and outcomes.
                </p>
              </div>
            )}
          </div>

          <div className="grid content-start gap-4">
            <ReadinessPanel
              score={insights.readinessScore}
              completed={insights.completedSessions}
            />
            <div className="grid gap-px overflow-hidden rounded-2xl border border-cream/14 bg-cream/14 sm:grid-cols-3 lg:grid-cols-1">
              <CompactStat
                label="This week"
                value={String(insights.sessionsThisWeek)}
                icon={TrendingUp}
                hint="Rounds in the last seven days"
              />
              <CompactStat
                label="Answers reviewed"
                value={String(insights.answeredQuestions)}
                icon={CheckCircle2}
                hint="Evidence captured across rounds"
              />
              <CompactStat
                label="Available today"
                value={String(remaining)}
                icon={Clock3}
                hint={`${quota.used} of ${quota.limit} sessions used`}
              />
            </div>
            <PreparationPanel profile={profile} targetRole={targetRole} />
          </div>
        </section>

        <section id="sessions" className="mt-11 scroll-mt-20 lg:scroll-mt-8 pb-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="blueprint-label text-cream/35">History</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
                Recent interviews
              </h2>
            </div>
            {sessions.length > 0 ? (
              <p className="hidden text-sm text-cream/35 sm:block">Newest first</p>
            ) : null}
          </div>

          {!historyAvailable ? (
            <div className="mt-5 rounded-2xl border border-[#ff9898]/25 bg-[#ff9898]/[0.06] p-5 text-sm text-[#ffc2c2]">
              Session history is temporarily unavailable. You can still start a new interview.
            </div>
          ) : sessions.length === 0 ? (
            <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-cream/20 bg-white/[0.025] px-6 text-center">
              <div>
                <h3 className="text-lg font-semibold text-cream">No interview evidence yet</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-cream/42">
                  Run a baseline round. Its report will appear here with strengths, gaps, transcript
                  evidence, and a targeted retry.
                </p>
                <Link
                  href={practiceHref}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cream bg-cream px-5 text-sm font-semibold text-blueprint"
                >
                  Start baseline <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-cream/14 bg-cream/10">
              {sessions.slice(0, 8).map((session) => (
                <SessionRow key={session.sessionId} session={session} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Maya opens the workspace: she is the product's face in the interview room, so
 * the home page starts with her rather than with a page title.
 */
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
    <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#7ea0ff]/12 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-[86rem] gap-8 px-5 pb-9 pt-8 sm:px-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-center lg:gap-12 lg:pt-10">
        <div className="relative mx-auto h-56 w-full max-w-[18rem] overflow-hidden rounded-3xl border border-white/12 bg-[#102764] shadow-[0_24px_70px_rgba(7,18,58,0.4)] sm:h-64 lg:h-72 lg:max-w-none">
          <MayaStage />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#102764] to-transparent" />
          <div className="absolute inset-x-4 bottom-3.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-cream">Maya</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9be8c1]/25 bg-[#71d6a5]/10 px-2 py-1 text-[10px] text-[#b5efd2]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#71d6a5]" /> Ready
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="blueprint-label text-cream/38">Your interview room</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-cream sm:text-4xl">
            {firstName ? `Ready when you are, ${firstName}.` : "Ready when you are."}
          </h1>
          <p className="mt-3.5 max-w-2xl text-sm leading-6 text-cream/50 sm:text-base sm:leading-7">
            {active
              ? `You have a round in progress — ${active.questionsCovered} of ${active.questionCount} questions covered. I will pick up with the same context.`
              : focus
                ? `Pick a round below and I will press on your real evidence. Your weakest signal so far is ${focus.toLowerCase()}.`
                : "Pick a round below. I only ask what your own experience can answer, then score what you actually showed."}
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {active ? (
              <Link
                href={`/interview/voice?session=${active.sessionId}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_14px_34px_rgba(7,18,58,0.32)] transition hover:bg-white"
              >
                <Play size={15} fill="currentColor" /> Resume interview
              </Link>
            ) : (
              <Link
                href={practiceHref}
                aria-disabled={exhausted}
                className={[
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_14px_34px_rgba(7,18,58,0.32)] transition",
                  exhausted ? "pointer-events-none opacity-40" : "hover:bg-white"
                ].join(" ")}
              >
                <Mic size={15} /> {exhausted ? "Daily limit reached" : "Start an interview"}
              </Link>
            )}
            <Link
              href="#templates"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/[0.04] px-5 text-sm font-semibold text-cream transition hover:border-white/32 hover:bg-white/[0.09]"
            >
              Browse rounds <ArrowRight size={15} />
            </Link>
          </div>

          <dl className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/[0.08] pt-5">
            <HeroPill
              label="Readiness"
              value={insights.readinessScore === null ? "—" : `${insights.readinessScore}`}
              hint={insights.readinessScore === null ? "after your first round" : "out of 100"}
            />
            <HeroPill
              label="Rounds today"
              value={`${remaining}`}
              hint={`of ${quota.limit} remaining`}
            />
            <HeroPill
              label="Completed"
              value={String(insights.completedSessions)}
              hint="scored interviews"
            />
          </dl>
        </div>
      </div>
    </header>
  );
}

function HeroPill({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-cream/32">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-cream">{value}</span>
        <span className="text-[11px] text-cream/35">{hint}</span>
      </dd>
    </div>
  );
}

function PreparationPlan({
  profile,
  practiceHref
}: {
  profile: CandidateProfile;
  practiceHref: string;
}) {
  const roadmap = profile.resume?.roadmap ?? [];
  const questions = profile.resume?.practiceQuestions ?? [];

  return (
    <section id="plan" className="mt-10 scroll-mt-20 lg:scroll-mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="blueprint-label text-cream/35">Prepared by Maya</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-cream">
            Your interview roadmap
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/42">
            Built from verified resume evidence and your target role.
          </p>
        </div>
        <Link
          href={practiceHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cream/22 px-4 text-sm font-semibold text-cream transition hover:bg-cream/[0.07]"
        >
          <Mic size={15} /> Start mock interview
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <div className="grid gap-px overflow-hidden rounded-lg border border-cream/14 bg-cream/14 sm:grid-cols-3">
          {roadmap.slice(0, 3).map((item, index) => (
            <article key={item.id} className="bg-blueprint-deep/82 p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cream/16 font-mono text-[10px] text-cream/52">
                  0{index + 1}
                </span>
                {index === 0 ? (
                  <span className="rounded-full border border-[#71d6a5]/25 bg-[#71d6a5]/10 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#9be8c1]">
                    Start here
                  </span>
                ) : null}
              </div>
              <h3 className="mt-5 font-semibold text-cream">{item.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-cream/40">{item.rationale}</p>
              {item.actions[0] ? (
                <p className="mt-4 border-t border-cream/10 pt-3 text-xs leading-5 text-cream/58">
                  {item.actions[0]}
                </p>
              ) : null}
            </article>
          ))}
          {!roadmap.length ? (
            <div className="bg-blueprint-deep/82 p-5 text-sm text-cream/42 sm:col-span-3">
              Complete another profile analysis to generate your roadmap.
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-cream/14 bg-cream/[0.04] p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream/16 text-cream/65">
              <ListChecks size={16} />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/30">
              {questions.length} prepared
            </span>
          </div>
          <h3 className="mt-5 font-semibold text-cream">Practice question queue</h3>
          <div className="mt-4 space-y-4">
            {questions.slice(0, 2).map((question, index) => (
              <div key={question.id} className="flex gap-3">
                <span className="font-mono text-[9px] text-cream/28">0{index + 1}</span>
                <div>
                  <p className="line-clamp-2 text-xs leading-5 text-cream/62">{question.prompt}</p>
                  <p className="mt-1 font-mono text-[9px] text-cream/30">
                    {question.evidenceAnchor}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-cream/10 pt-4 text-xs text-cream/38">
            <Map size={14} /> Questions adapt after each report.
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReadinessPanel({ score, completed }: { score: number | null; completed: number }) {
  const safeScore = score ?? 0;
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-cream/14 bg-blueprint-deep/75 p-5 sm:p-6 lg:flex-col lg:items-start">
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
            stroke="rgba(239,232,214,.12)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#efe8d6"
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
        <p className="blueprint-label text-cream/35">Evidence readiness</p>
        <h2 className="mt-2 text-lg font-semibold text-cream">
          {score === null
            ? "Awaiting baseline"
            : score >= 75
              ? "Strong signal"
              : score >= 55
                ? "Building signal"
                : "Needs more evidence"}
        </h2>
        <p className="mt-2 text-xs leading-5 text-cream/40">
          Based on {completed} completed {completed === 1 ? "round" : "rounds"}, not a hiring
          prediction.
        </p>
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  icon: Icon,
  hint
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
  hint: string;
}) {
  return (
    <div className="bg-blueprint-deep/78 p-5">
      <div className="flex items-center justify-between">
        <p className="blueprint-label text-cream/35">{label}</p>
        <Icon size={15} className="text-cream/35" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-cream">{value}</p>
      <p className="mt-1 text-xs text-cream/32">{hint}</p>
    </div>
  );
}

function CompetencyRow({ competency }: { competency: WorkspaceCompetency }) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_3.5rem] sm:items-center">
      <div>
        <p className="text-sm font-medium text-cream">{competency.label}</p>
        <p className="mt-1 text-[11px] text-cream/32">
          {competency.attempts} {competency.attempts === 1 ? "answer" : "answers"}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-blueprint-dark/60">
        <div
          className="h-full rounded-full bg-cream transition-[width]"
          style={{ width: `${competency.score}%` }}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5 font-mono text-xs text-cream/62">
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
    <aside className="rounded-2xl border border-cream/14 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cream/18 text-cream">
          <Target size={17} />
        </span>
        <span className="font-mono text-xs text-cream/45">{profile.completeness}% complete</span>
      </div>
      <p className="blueprint-label mt-6 text-cream/35">Preparation target</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-cream">
        {targetRole ? `${roleLabel(targetRole)} interview` : "Set your target role"}
      </h2>
      {profile.targetCompany ? (
        <p className="mt-1 text-sm text-cream/50">{profile.targetCompany}</p>
      ) : null}
      <div className="mt-6 space-y-3 border-y border-cream/10 py-5">
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
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cream/22 text-sm font-semibold text-cream transition hover:bg-cream/8"
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
    <div className="flex items-start gap-3">
      <Icon size={15} className="mt-0.5 text-cream/32" />
      <div className="min-w-0">
        <p className="text-xs text-cream/32">{label}</p>
        <p className="mt-0.5 truncate text-sm text-cream/68">{value}</p>
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
    <article className="group grid gap-5 border-b border-blueprint-deep/70 bg-blueprint-deep/80 p-5 transition last:border-b-0 hover:bg-blueprint-light/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cream/16 bg-cream/[0.04] font-mono text-[11px] text-cream/65">
          {roleInitials(session.setup.role)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-semibold text-cream">
              {roleLabel(session.setup.role)} · {roundLabel(session.setup.roundType)}
            </h3>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 truncate text-sm text-cream/42">{session.setup.context}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-cream/30">
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
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cream/20 px-4 text-sm font-semibold text-cream/72 transition group-hover:border-cream/35 group-hover:text-cream"
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
        "rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em]",
        status === "completed"
          ? "border-[#71d6a5]/30 bg-[#71d6a5]/10 text-[#9be8c1]"
          : status === "in_progress"
            ? "border-cream/25 bg-cream/8 text-cream/70"
            : "border-cream/14 text-cream/35"
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
function roleLabel(role: Role): string {
  return {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full-stack",
    data: "Data",
    "ai-ml": "AI / ML",
    pm: "Product"
  }[role];
}
function roleInitials(role: Role): string {
  return { backend: "BE", frontend: "FE", fullstack: "FS", data: "DA", "ai-ml": "AI", pm: "PM" }[
    role
  ];
}
function roundLabel(round: InterviewHistoryItem["setup"]["roundType"]): string {
  return round === "technical"
    ? "Technical deep-dive"
    : round === "hiring-manager"
      ? "Hiring manager"
      : "Behavioral";
}
function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    value
  );
}
function formatDuration(value: number): string {
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
