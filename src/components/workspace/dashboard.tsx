import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleUserRound,
  FileText,
  Mic,
  ListChecks,
  Map,
  Play,
  Target,
  TrendingUp
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { MayaStage } from "@/components/workspace/maya-stage";
import { SessionPlan } from "@/components/workspace/session-plan";
import { MayaWelcome } from "@/components/workspace/maya-welcome";
import type { Curriculum } from "@/lib/curriculum";
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
  curriculum?: Curriculum | null;
}

export function Dashboard({
  quota,
  sessions,
  profile,
  insights,
  historyAvailable = true,
  showMayaWelcome = false,
  curriculum = null
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
    <div className="pb-10">
      <DocumentTitle title="Home" />
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

      <div className="mx-auto w-full max-w-[110rem] px-5 sm:px-8 lg:px-10">
        <SessionPlan
          initial={curriculum}
          completedIds={sessions
            .filter((item) => item.status === "completed" && item.setup.templateId)
            .map((item) => item.setup.templateId as string)}
          locked={exhausted}
        />

        {profile.resume?.roadmap.length || profile.resume?.practiceQuestions.length ? (
          <PreparationPlan profile={profile} practiceHref={practiceHref} />
        ) : null}

        {/* Progress and history share the main column so the rail's taller
            cards do not leave a hole beside a short competency map. */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-start">
          <div className="grid gap-11">
            <section id="progress" className="scroll-mt-20 lg:scroll-mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-cream">
                    Competency evidence
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cream/45">
                    Signals from your completed interview answers.
                  </p>
                </div>
                {insights.strongest ? (
                  <p className="hidden text-xs text-cream/38 sm:block">
                    Strongest: {insights.strongest.label}
                  </p>
                ) : null}
              </div>

              {insights.competencyMap.length ? (
                <div className="mt-5 grid gap-3">
                  {insights.competencyMap.map((competency) => (
                    <CompetencyRow key={competency.label} competency={competency} />
                  ))}
                </div>
              ) : (
                <div className="surface mt-5 flex min-h-72 flex-col items-center justify-center px-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
                    <TrendingUp size={18} />
                  </span>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-cream">
                    Your evidence map starts after one round
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-cream/42">
                    Helix scores what your answers actually demonstrate: ownership, decisions,
                    specifics, and outcomes.
                  </p>
                </div>
              )}
            </section>

            <section id="sessions" className="scroll-mt-20 lg:scroll-mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-cream">
                    Recent interviews
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cream/45">
                    Reports, transcripts, and follow-up practice.
                  </p>
                </div>
                {sessions.length > 0 ? (
                  <p className="hidden text-sm text-cream/35 sm:block">Newest first</p>
                ) : null}
              </div>

              {!historyAvailable ? (
                <div className="mt-5 rounded-3xl bg-[#ff9898]/[0.08] p-5 text-sm text-[#ffc2c2] shadow-soft-inset">
                  Session history is temporarily unavailable. You can still start a new interview.
                </div>
              ) : sessions.length === 0 ? (
                <div className="surface mt-5 grid min-h-64 place-items-center px-6 text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
                      <Mic size={20} />
                    </span>
                    <h3 className="mt-5 text-2xl font-semibold tracking-tight text-cream">
                      No interview evidence yet
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-cream/42">
                      Run a baseline round. Its report will appear here with strengths, gaps,
                      transcript evidence, and a targeted retry.
                    </p>
                    <Link
                      href={practiceHref}
                      className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-cream px-5 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]"
                    >
                      Start baseline <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {sessions.slice(0, 8).map((session) => (
                    <SessionRow key={session.sessionId} session={session} />
                  ))}
                </div>
              )}
            </section>
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
    <header className="relative px-5 pb-3 pt-6 sm:px-8 lg:px-10 lg:pt-8">
      <div className="relative mx-auto grid w-full max-w-[110rem] overflow-hidden rounded-[2rem] bg-[radial-gradient(42rem_26rem_at_82%_8%,rgba(169,205,255,0.34),transparent_72%),linear-gradient(135deg,rgba(79,112,197,0.96),rgba(39,76,172,0.94)_46%,rgba(29,66,157,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(255,255,255,0.06),0_34px_90px_-52px_rgba(4,12,42,0.9)] sm:p-7 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-8 lg:p-9 lg:pr-6">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cream/42 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#9fc4ff]/22 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(220,230,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(220,230,255,0.7) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(100% 100% at 100% 100%, #000 18%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(100% 100% at 100% 100%, #000 18%, transparent 72%)"
          }}
        />

        <div className="relative z-10 min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-2 text-xs font-semibold text-cream/70 shadow-soft-inset">
            <span className="h-1.5 w-1.5 rounded-full bg-[#71d6a5]" />
            Maya is ready
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-cream sm:text-5xl lg:text-6xl">
            {firstName ? `Ready when you are, ${firstName}.` : "Ready when you are."}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-cream/60">
            {active
              ? `You have a round in progress: ${active.questionsCovered} of ${active.questionCount} questions covered. I will pick up with the same context.`
              : focus
                ? `Pick a round and I will press on your real evidence. Current focus: ${focus}.`
                : "Pick a round. I ask from your actual experience, then score the evidence in your answers."}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {active ? (
              <Link
                href={`/interview/voice?session=${active.sessionId}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white"
              >
                <Play size={15} fill="currentColor" /> Resume interview
              </Link>
            ) : (
              <Link
                href={practiceHref}
                aria-disabled={exhausted}
                className={[
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition",
                  exhausted ? "pointer-events-none opacity-40" : "hover:bg-white"
                ].join(" ")}
              >
                <Mic size={15} /> {exhausted ? "Daily limit reached" : "Start an interview"}
              </Link>
            )}
            <Link
              href="#sessions-plan"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-5 text-sm font-semibold text-cream shadow-soft-inset transition hover:bg-white/[0.12]"
            >
              View plan <ArrowRight size={15} />
            </Link>
          </div>

          <dl className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <HeroPill
              label="Readiness"
              value={insights.readinessScore === null ? "—" : `${insights.readinessScore}`}
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

        <div className="relative z-10 mt-8 h-80 overflow-hidden sm:h-[24rem] lg:mt-0 lg:h-[25rem]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(22rem_18rem_at_54%_44%,rgba(156,199,255,0.24),transparent_72%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 bottom-5 h-20 rounded-full bg-[#9fc4ff]/12 blur-2xl"
          />
          <MayaStage />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-cream shadow-soft-inset">
              Maya
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#71d6a5]/14 px-3 py-1.5 text-xs font-semibold text-[#b5efd2] shadow-soft-inset">
              <span className="h-1.5 w-1.5 rounded-full bg-[#71d6a5]" /> Ready
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroPill({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-white/[0.055] p-4 shadow-soft-inset">
      <dt className="text-xs font-semibold text-cream/45">{label}</dt>
      <dd className="mt-3">
        <span className="block text-3xl font-semibold tracking-tight text-cream">{value}</span>
        <span className="mt-1 block text-xs text-cream/42">{hint}</span>
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
          <h2 className="text-3xl font-semibold tracking-tight text-cream">
            Your interview roadmap
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/42">
            Built from verified resume evidence and your target role.
          </p>
        </div>
        <Link
          href={practiceHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-4 text-sm font-semibold text-cream shadow-soft-inset transition hover:bg-white/[0.12]"
        >
          <Mic size={15} /> Start mock interview
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <div className="grid gap-4 sm:grid-cols-3">
          {roadmap.slice(0, 3).map((item, index) => (
            <article key={item.id} className="surface p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] font-mono text-xs font-semibold text-cream/62 shadow-soft-inset">
                  0{index + 1}
                </span>
                {index === 0 ? (
                  <span className="rounded-full bg-[#71d6a5]/14 px-3 py-1 text-xs font-semibold text-[#b5efd2] shadow-soft-inset">
                    Start here
                  </span>
                ) : null}
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-cream">{item.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-cream/48">{item.rationale}</p>
              {item.actions[0] ? (
                <p className="mt-5 rounded-2xl bg-white/[0.045] p-4 text-sm leading-6 text-cream/62 shadow-soft-inset">
                  {item.actions[0]}
                </p>
              ) : null}
            </article>
          ))}
          {!roadmap.length ? (
            <div className="surface p-6 text-sm text-cream/42 sm:col-span-3">
              Complete another profile analysis to generate your roadmap.
            </div>
          ) : null}
        </div>

        <aside className="surface p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-cream/70 shadow-soft-inset">
              <ListChecks size={16} />
            </span>
            <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-cream/45 shadow-soft-inset">
              {questions.length} prepared
            </span>
          </div>
          <h3 className="mt-5 text-xl font-semibold tracking-tight text-cream">
            Practice question queue
          </h3>
          <div className="mt-4 grid gap-3">
            {questions.slice(0, 2).map((question, index) => (
              <div key={question.id} className="rounded-2xl bg-white/[0.04] p-4 shadow-soft-inset">
                <span className="font-mono text-[10px] text-cream/34">0{index + 1}</span>
                <div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-cream/66">
                    {question.prompt}
                  </p>
                  <p className="mt-2 truncate text-xs text-cream/34">{question.evidenceAnchor}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/[0.035] p-3 text-sm text-cream/42 shadow-soft-inset">
            <Map size={14} /> Questions adapt after each report.
          </div>
        </aside>
      </div>
    </section>
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
    <div className="surface flex items-center gap-5 p-5 sm:p-6 lg:flex-col lg:items-start">
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
    <div className="surface grid gap-4 p-5 sm:grid-cols-[12rem_minmax(0,1fr)_4rem] sm:items-center">
      <div>
        <p className="text-base font-semibold text-cream">{competency.label}</p>
        <p className="mt-1 text-sm text-cream/38">
          {competency.attempts} {competency.attempts === 1 ? "answer" : "answers"}
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.08] shadow-soft-inset">
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
    <aside className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
          <Target size={17} />
        </span>
        <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-cream/50 shadow-soft-inset">
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
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.07] text-sm font-semibold text-cream shadow-soft-inset transition hover:bg-white/[0.12]"
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
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 shadow-soft-inset">
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
    <article className="surface group grid gap-5 p-5 transition hover:bg-white/[0.075] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] font-mono text-xs font-semibold text-cream/70 shadow-soft-inset">
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-4 text-sm font-semibold text-cream/72 shadow-soft-inset transition group-hover:bg-white/[0.11] group-hover:text-cream"
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
          ? "bg-[#71d6a5]/14 text-[#b5efd2] shadow-soft-inset"
          : status === "in_progress"
            ? "bg-cream/[0.12] text-cream/78 shadow-soft-inset"
            : "bg-white/[0.05] text-cream/42 shadow-soft-inset"
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
