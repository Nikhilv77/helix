import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  Clock,
  SkipForward
} from "lucide-react";
import { PracticeIntro } from "@/components/workspace/practice/practice-intro";
import type { DsaChapter, FrontendDsaPlan, PlanQuestion } from "@/lib/roadmap/frontend-plan";
import { FRONTEND_SESSIONS } from "@/lib/roadmap/frontend-plan";
import type { FrontendRoadmapChapter, FrontendRoadmapHome } from "@/lib/roadmap/roadmap";

/**
 * The DSA session's actual content, shown on Practice.
 *
 * Home lists the preparation sessions as cards; opening the DSA one lands here, where
 * the pattern chapters and their questions live. Splitting it this way keeps
 * Home glanceable and gives the 123 rows a page of their own.
 *
 * Chapters use native <details> so the whole thing stays a server component —
 * 123 rows do not need to ship any JavaScript to be expandable.
 */
export function DsaTopics({
  plan,
  roadmap = null,
  questionStatuses
}: {
  plan: FrontendDsaPlan;
  roadmap?: FrontendRoadmapHome | null;
  questionStatuses?: Record<string, string>;
}) {
  const statusBySlug = questionStatuses ? new Map(Object.entries(questionStatuses)) : null;
  // Prefer the persisted session title; fall back to the template only when
  // there is no roadmap to read.
  const activeSession =
    roadmap?.sessions.find((session) => session.id === roadmap.currentSessionTemplateSlug) ??
    roadmap?.sessions[0] ??
    null;
  const fallback = FRONTEND_SESSIONS.find((session) => session.status === "active");
  const purpose = activeSession?.purpose ?? fallback?.purpose ?? "";

  // Per-chapter progress, keyed by slug, so each block can show real state.
  const progressByChapter = new Map(
    (roadmap?.chapters ?? []).map((chapter) => [chapter.id, chapter])
  );

  return (
    <section id="plan" className="relative scroll-mt-20 lg:scroll-mt-8">
      <Link
        href="/practice"
        aria-label="Back to Practice sessions"
        className="absolute left-0 top-0 z-20 grid h-9 w-9 place-items-center rounded-xl bg-[#17181b] text-cream/52 transition hover:bg-[#202126] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35"
      >
        <ArrowLeft size={13} aria-hidden="true" />
      </Link>

      <PracticeIntro
        purpose={purpose}
        roadmap={roadmap}
        nextHref={
          roadmap?.nextQuestionHref ??
          (plan.firstQuestionSlug ? `/dsa-questions/${plan.firstQuestionSlug}` : null)
        }
        nextLabel={
          (roadmap?.completedQuestions ?? 0) > 0 ? "Continue practising" : "Start the first pattern"
        }
      />

      <div className="mt-12 sm:mt-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/32">
              DSA patterns
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-[-0.035em] text-cream sm:text-[2rem]">
              Work through one pattern at a time
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-cream/44">
              Each chapter keeps its briefing, questions, and progress together.
            </p>
          </div>
          <p className="shrink-0 text-[12px] text-cream/36">
            <strong className="font-semibold text-cream/72">
              {roadmap?.completedQuestions ?? 0}
            </strong>{" "}
            of {roadmap?.totalQuestions ?? plan.totalQuestions} complete
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {plan.chapters.map((chapter, index) => (
          <ChapterBlock
            key={chapter.id}
            chapter={chapter}
            index={index}
            progress={progressByChapter.get(chapter.id) ?? null}
            statusBySlug={statusBySlug}
          />
        ))}
      </div>
    </section>
  );
}

function ChapterBlock({
  chapter,
  index,
  progress,
  statusBySlug
}: {
  chapter: DsaChapter;
  index: number;
  progress: FrontendRoadmapChapter | null;
  statusBySlug: Map<string, string> | null;
}) {
  const done = progress?.status === "COMPLETED";
  const current = progress?.status === "ACTIVE" || progress?.status === "IN_PROGRESS";
  const percent = Math.round(progress?.progressPercent ?? 0);

  return (
    <details
      className="group overflow-hidden rounded-[1.45rem] bg-[#17181b] transition duration-300 open:bg-[#1b1c20]"
      open={index === 0}
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 [&::-webkit-details-marker]:hidden sm:gap-5 sm:p-6">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/35 font-mono text-[12px] font-semibold text-cream/48">
          {done ? <Check size={16} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-semibold tracking-[-0.02em] text-cream sm:text-xl">
              {chapter.title}
            </span>
            <span className="text-[13px] font-medium text-cream/40">
              {progress
                ? `${progress.completedQuestions}/${progress.questions} done`
                : `${chapter.questions.length} questions`}{" "}
              · ~{Math.round(chapter.minutes / 60)}h
            </span>
            {current ? (
              <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-cream/56">
                In progress
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block max-w-2xl text-sm leading-6 text-cream/45">
            {chapter.whyItMatters}
          </span>

          {progress && progress.completedQuestions > 0 ? (
            <span className="mt-4 flex items-center gap-3">
              <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-cream/[0.08]">
                <span
                  className="block h-full rounded-full bg-cream/72"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-cream/50">{percent}%</span>
            </span>
          ) : (
            <span className="mt-3 flex flex-wrap items-center gap-1.5">
              <MixChip tone="easy" count={chapter.counts.easy} />
              <MixChip tone="medium" count={chapter.counts.medium} />
              <MixChip tone="hard" count={chapter.counts.hard} />
            </span>
          )}
        </span>

        <ChevronDown
          size={18}
          aria-hidden
          className="mt-1 shrink-0 text-cream/35 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="mt-1 bg-black/[0.12] px-5 sm:px-6 sm:pl-[5.5rem]">
        <Link
          href={`/practice/${chapter.id}`}
          className="group/session flex items-center gap-3 py-4 transition hover:bg-white/[0.018]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/45 text-cream/48">
            <BookOpen size={15} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-cream">
              Open the pattern briefing
            </span>
            <span className="mt-0.5 block text-[13px] leading-5 text-cream/50">
              Review the idea, common traps, and the questions that follow.
            </span>
          </span>
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="shrink-0 text-cream/35 transition group-hover/session:translate-x-0.5 group-hover/session:text-cream"
          />
        </Link>
      </div>

      <ul className="mt-px divide-y divide-white/[0.055] bg-black/[0.12] px-5 sm:px-6 sm:pl-[5.5rem]">
        {chapter.questions.map((question, position) => (
          <li key={question.slug}>
            <QuestionRow
              question={question}
              position={position + 1}
              status={statusBySlug?.get(question.slug) ?? null}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

function MixChip({ tone, count }: { tone: "easy" | "medium" | "hard"; count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-medium capitalize text-cream/42">
      {count} {tone}
    </span>
  );
}

function QuestionRow({
  question,
  position,
  status
}: {
  question: PlanQuestion;
  position: number;
  status: string | null;
}) {
  const done = status === "COMPLETED";
  const skipped = status === "SKIPPED";

  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className="group/row -mx-2 flex min-h-[4.5rem] items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-white/[0.03] sm:gap-4 sm:px-3"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/45 text-cream/30 transition group-hover/row:text-cream/60">
        {done ? (
          <Check size={13} aria-hidden="true" />
        ) : skipped ? (
          <SkipForward size={12} aria-hidden="true" />
        ) : (
          <Circle size={11} aria-hidden="true" />
        )}
      </span>
      <span className="w-5 shrink-0 text-right font-mono text-[11px] text-cream/30">
        {position}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-medium transition ${
            done
              ? "text-cream/45 line-through decoration-cream/25"
              : "text-cream/85 group-hover/row:text-cream"
          }`}
        >
          {question.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] capitalize text-cream/38">
          {question.primaryPattern.replace(/-/g, " ")}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1 text-[11px] text-cream/35 sm:flex">
        <Clock size={11} aria-hidden="true" /> {question.expectedTimeMinutes}m
      </span>
      <span className="shrink-0 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium capitalize text-cream/42">
        {question.difficulty}
      </span>
    </Link>
  );
}
