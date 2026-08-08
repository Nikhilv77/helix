import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Box,
  Braces,
  CheckCircle2,
  Boxes,
  Code2,
  FileText,
  Timer,
  ListChecks,
  MonitorSmartphone,
  Sparkles,
  Target
} from "lucide-react";
import { MayaStage } from "@/components/workspace/maya-stage";
import { InterviewSignal } from "@/components/marketing/blueprint-art";
import { ChapterCarousel } from "@/components/workspace/chapter-carousel";
import { MayaInsights } from "@/components/workspace/maya-insights";
import type { CarouselChapter } from "@/components/workspace/chapter-carousel";
import { FRONTEND_SESSIONS } from "@/lib/frontend-plan";
import type { FrontendDsaPlan } from "@/lib/frontend-plan";
import type { FrontendRoadmapInsight } from "@/lib/roadmap";
import type { FrontendRoadmapHome } from "@/lib/roadmap";
import type { Role } from "@/lib/types";

type SessionMeta = {
  icon: LucideIcon;
  accent: string;
  background: string;
  tag: string;
  metric: string;
};

const SESSION_META: Record<string, SessionMeta> = {
  "frontend-dsa": {
    icon: Code2,
    accent: "bg-[linear-gradient(135deg,#bfe2ff,#6fa8ff)]",
    background: "/images/session-cards/frontend-dsa-v2.jpg",
    tag: "Coding",
    metric: "123 questions"
  },
  "javascript-react-core": {
    icon: Braces,
    accent: "bg-[linear-gradient(135deg,#d8ebff,#7db7ff)]",
    background: "/images/session-cards/javascript-react-core-v2.jpg",
    tag: "React",
    metric: "Core concepts"
  },
  "build-real-ui-features": {
    icon: Box,
    accent: "bg-[linear-gradient(135deg,#cde8ff,#82c2ff)]",
    background: "/images/session-cards/build-real-ui-features-v2.jpg",
    tag: "UI build",
    metric: "Live tasks"
  },
  "production-ui-quality": {
    icon: Sparkles,
    accent: "bg-[linear-gradient(135deg,#d7eaff,#91bfff)]",
    background: "/images/session-cards/production-ui-quality-v2.jpg",
    tag: "Quality",
    metric: "Ship-ready UI"
  },
  "resume-behavioral-defense": {
    icon: FileText,
    accent: "bg-[linear-gradient(135deg,#dceeff,#85b8f4)]",
    background: "/images/session-cards/resume-behavioral-defense-v2.jpg",
    tag: "Stories",
    metric: "Evidence"
  },
  "final-frontend-mock": {
    icon: Target,
    accent: "bg-[linear-gradient(135deg,#cfe7ff,#799df5)]",
    background: "/images/session-cards/final-frontend-mock-v2.jpg",
    tag: "Mock loop",
    metric: "Full round"
  }
};

const DEFAULT_META: SessionMeta = {
  icon: Code2,
  accent: "bg-[linear-gradient(135deg,#45c4ff,#5477ff)]",
  background: "/images/session-cards/frontend-dsa-v2.jpg",
  tag: "Practice",
  metric: "Session"
};

export function SessionCards({
  roadmap,
  fallbackPlan,
  firstName,
  targetRole = null
}: {
  roadmap: FrontendRoadmapHome | null;
  fallbackPlan?: FrontendDsaPlan | null;
  firstName: string;
  targetRole?: Role | null;
}) {
  const sessions = roadmap?.sessions.length
    ? roadmap.sessions
    : FRONTEND_SESSIONS.map((session) => ({
        ...session,
        progressPercent: 0,
        completedQuestions: 0,
        totalQuestions: 0,
        href: sessionHref(session.id, session.title)
      }));
  const activeSession =
    sessions.find((session) => session.id === roadmap?.currentSessionTemplateSlug) ?? sessions[0];
  const progress = Math.round(roadmap?.overallProgressPercent ?? 0);
  const totalQuestions = roadmap?.totalQuestions ?? fallbackPlan?.totalQuestions ?? 123;
  const totalHours = roadmap
    ? Math.round(roadmap.totalMinutes / 60)
    : fallbackPlan
      ? Math.round(fallbackPlan.totalMinutes / 60)
      : 49;
  const totalChapters = roadmap?.totalChapters ?? fallbackPlan?.chapters.length ?? 12;
  const nextHref = roadmap?.nextQuestionHref ?? activeSession?.href ?? "/practice";
  const carouselChapters: CarouselChapter[] = roadmap?.chapters.length
    ? roadmap.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        whyItMatters: chapter.whyItMatters,
        questions: chapter.questions,
        minutes: chapter.minutes,
        counts: chapter.counts,
        firstQuestionSlug: chapter.firstQuestionSlug,
        completedQuestions: chapter.completedQuestions,
        progressPercent: chapter.progressPercent
      }))
    : (fallbackPlan?.chapters ?? []).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        whyItMatters: chapter.whyItMatters,
        questions: chapter.questions.length,
        minutes: chapter.minutes,
        counts: chapter.counts,
        firstQuestionSlug: chapter.questions[0]?.slug ?? null,
        completedQuestions: 0,
        progressPercent: 0
      }));
  const insights = roadmap?.insights.length ? roadmap.insights : fallbackInsights(fallbackPlan);
  const heading =
    targetRole === "frontend"
      ? "Your frontend interview roadmap."
      : "Your interview roadmap starts here.";

  return (
    <div className="w-full min-w-0 max-w-[calc(100vw-1rem)] overflow-x-clip px-2 pb-6 pt-2 sm:max-w-full sm:px-3 lg:px-3">
      <section className="relative isolate max-w-full overflow-hidden rounded-[1.5rem] bg-[#3557b4] shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)]">
        <BlueprintPattern className="opacity-[0.16]" />
        <div className="relative z-10 grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(17rem,0.92fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(19rem,0.9fr)_minmax(0,1.15fr)] xl:gap-6">
          <div className="order-2 flex h-full min-w-0 flex-col justify-center rounded-2xl bg-[#2a4aa0] p-5 lg:order-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-cream/[0.1] px-3 py-1.5 text-[13px] font-medium text-cream/80">
              <span className="h-2 w-2 rounded-full bg-[#8be6bd] shadow-[0_0_14px_rgba(139,230,189,0.8)]" />
              Welcome back{firstName ? `, ${displayName(firstName)}` : ""}
            </div>

            <h1 className="mt-3.5 max-w-[20rem] font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.03em] text-cream sm:max-w-[28rem] sm:text-[clamp(2rem,2.5vw,2.9rem)] sm:leading-[1.05]">
              {heading}
            </h1>

            <p className="mt-2.5 max-w-[20rem] text-[15px] font-medium leading-6 text-cream/68 sm:max-w-[29rem]">
              Start with DSA. Build one strong session at a time.
            </p>

            <div className="mt-4 w-full min-w-0 pr-1">
              <div className="flex items-baseline gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/50">
                  Overall progress
                </p>
                <span className="text-[13px] font-semibold tabular-nums text-cream/80">
                  {progress}% complete
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#27459a]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#8be6bd] to-[#bff3dc]"
                  style={{ width: `${Math.max(progress, 1.5)}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-cream/66">
                <HeroMetric icon={Boxes} value={totalChapters} label="chapters" />
                <HeroMetric icon={ListChecks} value={totalQuestions} label="questions" />
                <HeroMetric icon={Timer} value={`~${totalHours}h`} label="practice" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={nextHref}
                className="group inline-flex h-12 min-w-[12.5rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#fff8e8] to-[#e5dcc3] px-6 text-[14px] font-semibold text-[#24459a] shadow-[0_18px_38px_-26px_rgba(239,232,214,0.95),inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:from-white hover:to-[#f0e8d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Start session
                <ArrowRight
                  size={17}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
              <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2a4aa0] px-3.5 text-[12px] font-semibold text-cream/72">
                <Braces size={15} className="text-[#bfe2ff]" aria-hidden="true" />
                {activeSession?.title ?? "Frontend DSA"}
              </span>
            </div>
          </div>

          {activeSession ? (
            <div className="relative order-1 h-full min-h-[17rem] overflow-hidden rounded-2xl bg-[#2a4aa0] sm:min-h-[20rem] lg:min-h-[23rem]">
              <span className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 text-[12px] font-semibold text-cream/65">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8be6bd]" />
                Maya is ready
              </span>

              {/* Same interview-turn trace that sits behind Maya on the
                  marketing hero, so she reads the same way in both places. */}
              <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[15rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 opacity-30 sm:h-[18rem] sm:w-[24rem] lg:h-[21rem] lg:w-[28rem] lg:opacity-40" />

              <div
                className="absolute inset-x-[-10%] bottom-[-4%] top-[-10%] z-10 sm:inset-x-[-6%] lg:inset-x-[-5%] xl:inset-x-[-2%]"
                style={{
                  maskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)",
                  WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)"
                }}
              >
                <MayaStage />
              </div>
            </div>
          ) : null}

          {carouselChapters.length ? (
            <div className="order-3 flex h-full min-w-0 lg:order-2">
              <ChapterCarousel chapters={carouselChapters} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-4">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,64rem)_minmax(18rem,1fr)]">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isCurrent={session.id === roadmap?.currentSessionTemplateSlug}
              />
            ))}
          </div>

          <MayaInsights insights={insights} />
        </div>
      </section>
    </div>
  );
}

function fallbackInsights(plan: FrontendDsaPlan | null | undefined): FrontendRoadmapInsight[] {
  const coach = plan?.coach;
  if (!coach) return [];

  return [
    {
      id: "fallback-next-priority",
      kind: "NEXT_PRIORITY",
      title: "Next priority",
      body: `${coach.chapterTitle}: ${coach.chapterWhy}`,
      evidenceLabel: coach.questionTitle,
      ctaLabel: "Start practice",
      ctaHref: `/dsa-questions/${coach.questionSlug}`,
      priority: 10
    },
    ...(coach.watchOut
      ? [
          {
            id: "fallback-common-trap",
            kind: "COMMON_TRAP" as const,
            title: "Common trap",
            body: coach.watchOut,
            evidenceLabel: coach.questionTitle,
            ctaLabel: null,
            ctaHref: null,
            priority: 20
          }
        ]
      : []),
    ...(coach.signal
      ? [
          {
            id: "fallback-strong-signal",
            kind: "STRONG_SIGNAL" as const,
            title: "Strong answers show",
            body: coach.signal,
            evidenceLabel: null,
            ctaLabel: null,
            ctaHref: null,
            priority: 30
          }
        ]
      : []),
    {
      id: "fallback-streak",
      kind: "STREAK",
      title: "Streak",
      body: "Not started. Your first session begins the count.",
      evidenceLabel: null,
      ctaLabel: null,
      ctaHref: null,
      priority: 40
    }
  ];
}

function HeroMetric({
  icon: Icon,
  value,
  label
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={16} className="text-[#bfe2ff]" aria-hidden="true" />
      <strong className="font-semibold text-cream">{value}</strong>
      <span>{label}</span>
    </span>
  );
}

interface DisplaySession {
  id: string;
  order: number;
  title: string;
  purpose: string;
  covers: string[];
  completedQuestions?: number;
  href?: string;
  progressPercent?: number;
  status?: string;
  totalQuestions?: number;
}

function SessionCard({ session, isCurrent }: { session: DisplaySession; isCurrent: boolean }) {
  const meta = SESSION_META[session.id] ?? DEFAULT_META;
  const Icon = meta.icon;
  const coverHints = session.covers.slice(0, 2);
  const progressPercent = Math.round(session.progressPercent ?? 0);
  const metric =
    session.totalQuestions && session.totalQuestions > 0
      ? `${session.completedQuestions ?? 0}/${session.totalQuestions} done`
      : meta.metric;

  return (
    <Link
      href={session.href ?? sessionHref(session.id, session.title)}
      aria-label={`Open ${session.title}`}
      className="block h-full min-w-0 max-w-full"
    >
      <article className="group relative flex h-full min-h-[22.5rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.45rem] bg-[#385fb8] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_0_1px_rgba(239,232,214,0.07),0_24px_62px_-42px_rgba(4,12,45,0.9)] transition duration-300 hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(239,232,214,0.11),0_32px_74px_-44px_rgba(4,12,45,1)] sm:min-h-[23rem] sm:p-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-80 saturate-[0.95] transition-transform duration-700 group-hover:scale-[1.045]"
          style={{ backgroundImage: `url(${meta.background})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(191,226,255,0.2)_0%,rgba(75,113,197,0.3)_36%,rgba(42,78,162,0.58)_62%,rgba(14,35,97,0.92)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(22rem_14rem_at_18%_4%,rgba(235,246,255,0.22),transparent_70%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_42%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(239,232,214,0.08))]"
        />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <span
            className={`grid h-11 w-11 place-items-center rounded-2xl ${meta.accent} text-[#244aa3] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_32px_-22px_rgba(4,12,45,0.82)] transition duration-300 group-hover:scale-105`}
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="rounded-full bg-cream/[0.14] px-2.5 py-1 text-[11px] font-semibold text-cream/75">
            {isCurrent
              ? "Active"
              : progressPercent > 0
                ? `${progressPercent}%`
                : String(session.order).padStart(2, "0")}
          </span>
        </div>

        <div className="relative z-10 mt-auto">
          <h3 className="break-words text-[1.35rem] font-semibold leading-6 tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            {session.title}
          </h3>
          <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-[13px] font-medium leading-5 text-white/74">
            {session.purpose}
          </p>

          <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/[0.12] px-2.5 py-1.5 text-[11px] font-semibold text-cream/80">
              <MonitorSmartphone size={13} aria-hidden="true" />
              {meta.tag}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/[0.12] px-2.5 py-1.5 text-[11px] font-semibold text-cream/80">
              <Timer size={13} aria-hidden="true" />
              {metric}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/[0.12] px-2.5 py-1.5 text-[11px] font-semibold text-cream/80">
              <CheckCircle2 size={13} aria-hidden="true" />
              {shortCover(coverHints[0] ?? "Guided practice")}
            </span>
          </div>

          <span className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#171a16] shadow-[0_16px_30px_-20px_rgba(255,255,255,0.78)] transition group-hover:bg-cream">
            Start session
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
        </div>
      </article>
    </Link>
  );
}

function BlueprintPattern({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(239,232,214,0.16) 1px, transparent 1px), linear-gradient(180deg, rgba(239,232,214,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(239,232,214,0.07) 1px, transparent 1px), linear-gradient(180deg, rgba(239,232,214,0.07) 1px, transparent 1px)",
        backgroundSize: "112px 112px, 112px 112px, 28px 28px, 28px 28px",
        backgroundPosition: "center top"
      }}
    />
  );
}

function sessionHref(id: string, title: string): string {
  if (id === "frontend-dsa") return "/practice";

  const params = new URLSearchParams({ focus: title });
  return `/interview?${params.toString()}`;
}

function displayName(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function shortCover(value: string): string {
  return value
    .replace("Pattern-by-pattern practice, warmups first", "Pattern practice")
    .replace("Maya introduces each pattern and how to recognize it", "Maya coaching")
    .replace("Common mistakes and interview signals per group", "Interview signals")
    .replace("Closures, `this`, prototypes and the event loop", "JS internals")
    .replace("React rendering, state batching and effect timing", "React rendering")
    .replace("Forms, controlled inputs and component architecture", "Forms & architecture")
    .replace("Autocomplete, infinite scroll, modals and data tables", "Live UI tasks")
    .replace("State shape and prop design under time pressure", "State design")
    .replace("Talking through tradeoffs while you build", "Build tradeoffs")
    .replace("Performance debugging and Core Web Vitals", "Performance")
    .replace("Accessibility and keyboard behaviour", "Accessibility")
    .replace("Responsive layout and cross-browser basics", "Responsive UI")
    .replace("App shell, route and data boundaries", "App boundaries")
    .replace("Caching, pagination and realtime tradeoffs", "Cache tradeoffs")
    .replace("Designing for reliability under partial failure", "Reliability")
    .replace("Core Web Vitals and browser profiling", "Vitals profiling")
    .replace("Bundle, image and network optimization", "Network cost")
    .replace("Explaining measurable performance wins", "Perf evidence")
    .replace("Keyboard flows and focus management", "Keyboard flows")
    .replace("Semantic markup and screen reader checks", "Semantics")
    .replace("Contrast, motion and inclusive states", "Inclusive states")
    .replace("Unit, integration and UI test strategy", "Test strategy")
    .replace("Debugging async and rendering issues", "Async debugging")
    .replace("Making flaky failures actionable", "Flake fixes")
    .replace("Feature deep-dives on what you actually shipped", "Feature defense")
    .replace("Ownership, tradeoffs and incident stories", "Ownership stories")
    .replace("Maya pushing back on vague or unsupported claims", "Evidence checks")
    .replace("One continuous mock across every round type", "Full loop")
    .replace("Scored against the same rubric as a real loop", "Loop scoring")
    .replace("A report naming your single highest-leverage fix", "One clear fix");
}
