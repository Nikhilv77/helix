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
    targetRole === "fullstack"
      ? "Your full-stack interview roadmap."
      : "Your interview roadmap starts here.";

  return (
    <div className="w-full min-w-0 max-w-[calc(100vw-1rem)] overflow-x-clip px-2 pb-6 pt-2 sm:max-w-full sm:px-3 lg:px-3">
      <section className="relative isolate max-w-full">
        <div className="relative z-10 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(17rem,0.92fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(19rem,0.9fr)_minmax(0,1.15fr)] xl:gap-6">
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
            <div className="relative order-1 h-full min-h-[17rem] overflow-hidden rounded-2xl bg-cream/[0.055] backdrop-blur-xl sm:min-h-[20rem] lg:min-h-[23rem]">
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
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,25rem)]">
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
      <article className="group relative flex min-h-[8.75rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-cream/[0.075] bg-cream/[0.055] p-3.5 shadow-[inset_0_1px_0_rgba(241,234,216,0.055)] transition-[border-color,transform,filter] duration-300 hover:-translate-y-0.5 hover:border-cream/[0.14] hover:brightness-[1.035] sm:min-h-[9.25rem] sm:p-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full bg-[#bfe2ff]/[0.055] blur-2xl transition-opacity duration-300 group-hover:opacity-80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cream/16 to-transparent"
        />

        <div className="relative z-10 flex min-w-0 items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.accent} text-[#244aa3] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon size={19} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-[0.96rem] font-semibold leading-5 tracking-tight text-cream">
                {session.title}
              </h3>
              <span className="shrink-0 rounded-full bg-cream/[0.08] px-2 py-0.5 text-[10px] font-semibold text-cream/54">
                {isCurrent
                  ? "Active"
                  : progressPercent > 0
                    ? `${progressPercent}%`
                    : String(session.order).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[0.76rem] font-medium leading-[1.35] text-[#aeb7d4]">
              {session.purpose}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-3">
          <div className="mb-2 flex max-w-full flex-wrap gap-1.5 overflow-hidden">
            <span className="inline-flex items-center gap-1 rounded-md bg-cream/[0.07] px-2 py-1 text-[10px] font-medium text-cream/58">
              <Timer size={11} aria-hidden="true" />
              {metric}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-cream/[0.07] px-2 py-1 text-[10px] font-medium text-cream/58">
              <CheckCircle2 size={11} aria-hidden="true" />
              <span className="truncate">{shortCover(coverHints[0] ?? meta.tag)}</span>
            </span>
          </div>

          <span className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-cream/[0.12] px-3 text-[12px] font-semibold text-cream/82 transition group-hover:bg-cream group-hover:text-[#24459a]">
            Start session
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </article>
    </Link>
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
