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
  const title = activeSession?.title ?? fallback?.title ?? "Full-stack DSA";
  const purpose = activeSession?.purpose ?? fallback?.purpose ?? "";

  const hours = roadmap
    ? Math.round(roadmap.totalMinutes / 60)
    : Math.round(plan.totalMinutes / 60);
  const mix = roadmap?.questionMix ?? plan.counts;

  // Per-chapter progress, keyed by slug, so each block can show real state.
  const progressByChapter = new Map(
    (roadmap?.chapters ?? []).map((chapter) => [chapter.id, chapter])
  );

  return (
    <section id="plan" className="scroll-mt-20 lg:scroll-mt-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-cream/45 transition hover:text-cream"
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-cream/42">
              Pattern library
            </p>
            <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-[-0.035em] text-cream sm:text-[2rem]">
              Build the instincts that make a solution feel obvious.
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-cream/55">
              Open a chapter for your teacher&apos;s briefing or go directly to a problem. Your
              progress stays attached to every pattern.
            </p>
          </div>
          <div className="practice-glass-soft flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3">
            <span
              className="h-2 w-2 rounded-full shadow-[0_0_14px_var(--workspace-accent)]"
              style={{ backgroundColor: "var(--workspace-accent)" }}
            />
            <p className="text-[14px] text-cream/58">
              <strong className="font-semibold text-cream">
                {roadmap?.completedQuestions ?? 0}
              </strong>{" "}
              of {roadmap?.totalQuestions ?? plan.totalQuestions} complete
            </p>
          </div>
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
      className={`practice-chapter-card group overflow-hidden ${current ? "is-current" : ""}`}
      open={index === 0}
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 [&::-webkit-details-marker]:hidden sm:gap-5 sm:p-6">
        <span
          className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cream/[0.1] bg-black/25 font-mono text-[12px] font-semibold text-cream/52"
          style={
            done
              ? { color: "var(--workspace-accent)", borderColor: "var(--workspace-accent-border)" }
              : undefined
          }
        >
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
              <span
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  color: "var(--workspace-accent)",
                  borderColor: "var(--workspace-accent-border)",
                  backgroundColor: "var(--workspace-accent-soft)"
                }}
              >
                Current
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
                  className="block h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: "var(--workspace-accent)",
                    boxShadow: "0 0 12px var(--workspace-accent)"
                  }}
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

      <div className="border-t border-cream/[0.07] px-5 pt-4 sm:px-6 sm:pl-[5.5rem]">
        <Link
          href={`/practice/${chapter.id}`}
          className="group/session flex items-center gap-3 rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5"
          style={{
            borderColor: "var(--workspace-accent-border)",
            background:
              "linear-gradient(120deg, var(--workspace-accent-soft), rgba(255,255,255,0.025) 72%)"
          }}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center"
            style={{ color: "var(--workspace-accent)" }}
          >
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-cream">
              Take this session with your teacher
            </span>
            <span className="mt-0.5 block text-[13px] leading-5 text-cream/50">
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

      <ul className="grid gap-2 p-5 sm:px-6 sm:pl-[5.5rem] lg:grid-cols-2">
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
    <span className="rounded-full border border-cream/[0.08] bg-black/20 px-2.5 py-1 text-[11px] font-semibold capitalize text-cream/48">
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
      className="practice-question-row group/row flex min-h-[4.75rem] items-center gap-3 rounded-2xl px-3.5 py-3 transition sm:gap-4"
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cream/[0.08] bg-black/20 text-cream/30 transition group-hover/row:text-cream/60"
        style={
          done
            ? {
                color: "var(--workspace-accent)",
                borderColor: "var(--workspace-accent-border)",
                backgroundColor: "var(--workspace-accent-soft)"
              }
            : undefined
        }
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
        <span className="mt-0.5 block truncate text-[12px] capitalize text-cream/38">
          {question.primaryPattern.replace(/-/g, " ")}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1 text-[11px] text-cream/35 sm:flex">
        <Clock size={11} aria-hidden="true" /> {question.expectedTimeMinutes}m
      </span>
      <span className="shrink-0 rounded-full border border-cream/[0.08] bg-black/20 px-2 py-1 text-[10px] font-semibold capitalize text-cream/45">
        {question.difficulty}
      </span>
    </Link>
  );
}
