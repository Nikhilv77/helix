import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Clock,
  SkipForward,
  Sparkles
} from "lucide-react";
import { PracticeIntro } from "@/components/workspace/practice/practice-intro";
import type { DsaChapter, FrontendDsaPlan, PlanQuestion } from "@/lib/frontend-plan";
import { FRONTEND_SESSIONS } from "@/lib/frontend-plan";
import type { FrontendRoadmapChapter, FrontendRoadmapHome } from "@/lib/roadmap";

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
  const title = activeSession?.title ?? fallback?.title ?? "Full-stack DSA";
  const purpose = activeSession?.purpose ?? fallback?.purpose ?? "";

  const hours = roadmap ? Math.round(roadmap.totalMinutes / 60) : Math.round(plan.totalMinutes / 60);
  const mix = roadmap?.questionMix ?? plan.counts;

  // Per-chapter progress, keyed by slug, so each block can show real state.
  const progressByChapter = new Map(
    (roadmap?.chapters ?? []).map((chapter) => [chapter.id, chapter])
  );

  return (
    <section id="plan" className="scroll-mt-20 lg:scroll-mt-8">
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-cream/45 transition hover:text-cream"
      >
        <ArrowLeft size={13} />
        Preparation path
      </Link>

      <PracticeIntro
        sessionTitle={title}
        purpose={purpose}
        roadmap={roadmap}
        nextHref={
          roadmap?.nextQuestionHref ??
          (plan.firstQuestionSlug ? `/dsa-questions/${plan.firstQuestionSlug}` : null)
        }
        nextLabel={
          (roadmap?.completedQuestions ?? 0) > 0 ? "Continue practising" : "Start the first pattern"
        }
        stats={[
          {
            label: "Questions",
            value: String(roadmap?.totalQuestions ?? plan.totalQuestions)
          },
          { label: "Chapters", value: String(roadmap?.totalChapters ?? plan.chapters.length) },
          { label: "Estimated", value: `~${hours}h` },
          { label: "Mix", value: `${mix.easy}E · ${mix.medium}M · ${mix.hard}H` }
        ]}
      />

      <div className="mt-8">
        <div className="flex flex-col gap-2 border-b border-cream/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cream/42">
              Practice plan
            </p>
            <p className="mt-1 text-[14.5px] leading-6 text-cream/58">
              Work through each pattern, then open a question when you are ready to solve.
            </p>
          </div>
          <p className="text-[13px] leading-5 text-cream/38 sm:text-right">
            {roadmap?.completedQuestions ?? 0} of {roadmap?.totalQuestions ?? plan.totalQuestions} complete
          </p>
        </div>
      </div>

      <div className="divide-y divide-cream/10">
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
      className={`group overflow-hidden ${current ? "bg-cream/[0.025]" : ""}`}
      open={index === 0}
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 py-5 transition hover:bg-cream/[0.035] [&::-webkit-details-marker]:hidden sm:gap-5">
        <span
          className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
            done ? "bg-[#8be6bd]/15 text-[#8be6bd]" : "bg-cream/[0.07] font-mono text-cream/60"
          }`}
        >
          {done ? <Check size={16} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-semibold tracking-tight text-cream">{chapter.title}</span>
            <span className="text-xs font-medium text-cream/40">
              {progress
                ? `${progress.completedQuestions}/${progress.questions} done`
                : `${chapter.questions.length} questions`}{" "}
              · ~{Math.round(chapter.minutes / 60)}h
            </span>
            {current ? (
              <span className="rounded-md bg-cream/[0.1] px-2 py-0.5 text-[11px] font-semibold text-cream/75">
                Current
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block max-w-2xl text-sm leading-6 text-cream/45">
            {chapter.whyItMatters}
          </span>

          {progress && progress.completedQuestions > 0 ? (
            <span className="mt-3 flex items-center gap-3">
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#1e3c88]">
                <span
                  className="block h-full rounded-full bg-[#8be6bd]"
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

      <div className="border-t border-cream/[0.07] py-3 sm:pl-[4.5rem]">
        <Link
          href={`/practice/${chapter.id}`}
          className="group/session flex items-center gap-3 rounded-xl border border-cream/15 bg-cream/[0.035] p-3.5 transition hover:bg-cream/[0.08]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream text-[#254294]">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-cream">
              Take this session with Maya
            </span>
            <span className="mt-0.5 block text-xs text-cream/45">
              She sets up the pattern and the traps, then you solve.
            </span>
          </span>
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="shrink-0 text-cream/35 transition group-hover/session:translate-x-0.5 group-hover/session:text-cream"
          />
        </Link>
      </div>

      <ul className="pb-3 sm:pl-[4.5rem]">
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

const MIX_TONE: Record<"easy" | "medium" | "hard", string> = {
  easy: "bg-emerald-400/14 text-emerald-200/90",
  medium: "bg-amber-400/14 text-amber-200/90",
  hard: "bg-rose-400/14 text-rose-200/90"
};

function MixChip({ tone, count }: { tone: "easy" | "medium" | "hard"; count: number }) {
  if (count === 0) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MIX_TONE[tone]}`}>
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
      className="group/row flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream/[0.06] sm:gap-4"
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition ${
          done
            ? "bg-[#8be6bd]/15 text-[#8be6bd]"
            : "bg-cream/[0.06] text-cream/30 group-hover/row:text-cream/60"
        }`}
      >
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
        <span className="mt-0.5 block truncate text-[11px] text-cream/33">
          {question.primaryPattern.replace(/-/g, " ")}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1 text-[11px] text-cream/35 sm:flex">
        <Clock size={11} aria-hidden="true" /> {question.expectedTimeMinutes}m
      </span>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${MIX_TONE[question.difficulty]}`}
      >
        {question.difficulty}
      </span>
    </Link>
  );
}
