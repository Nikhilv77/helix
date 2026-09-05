import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, SkipForward } from "lucide-react";
import { BlockAssessmentPreview } from "@/components/workspace/dsa/block-assessment-preview";
import { PracticeCoachCard, PracticeIntro } from "@/components/workspace/practice/practice-intro";
import type { DsaRecommendation } from "@/lib/practice/dsa-recommendation";
import type { DsaChapter, FrontendDsaPlan, PlanQuestion } from "@/lib/roadmap/frontend-plan";
import { PREP_SESSIONS } from "@/lib/roadmap/frontend-plan";
import type { FrontendRoadmapChapter, FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { DsaBlockHistoryView } from "@/server/dsa/dsa-block-history.service";

/** The DSA roadmap: current pattern first, then the complete numbered path. */
export function DsaTopics({
  plan,
  roadmap = null,
  questionStatuses,
  recommendation = null,
  blockHistory = null,
  panel = "overview",
  allowEarlyAssessmentStart = false
}: {
  plan: FrontendDsaPlan;
  roadmap?: FrontendRoadmapHome | null;
  questionStatuses?: Record<string, string>;
  recommendation?: DsaRecommendation | null;
  blockHistory?: DsaBlockHistoryView | null;
  panel?: "overview" | "transcript";
  allowEarlyAssessmentStart?: boolean;
}) {
  const statusBySlug = questionStatuses ? new Map(Object.entries(questionStatuses)) : null;
  const selectedRecommendation = blockHistory?.selected.recommendation ?? recommendation;
  const selectedStatusBySlug = blockHistory
    ? new Map(
        blockHistory.selected.recommendation.questions.map((question) => [
          question.slug,
          question.status
        ])
      )
    : statusBySlug;
  const activeSession =
    roadmap?.sessions.find((session) => session.id === roadmap.currentSessionTemplateSlug) ??
    roadmap?.sessions[0] ??
    null;
  const fallback = PREP_SESSIONS.find((session) => session.status === "active");
  const purpose = activeSession?.purpose ?? fallback?.purpose ?? "";
  const progressByChapter = new Map(
    (roadmap?.chapters ?? []).map((chapter) => [chapter.id, chapter])
  );
  const currentChapterId =
    selectedRecommendation?.focusChapterId ??
    roadmap?.currentChapterTemplateSlug ??
    roadmap?.chapters.find((chapter) => chapter.status === "IN_PROGRESS")?.id ??
    plan.chapters[0]?.id ??
    null;
  const nextQuestion = selectedRecommendation
    ? (selectedRecommendation.questions.find((question) => {
        const status = selectedStatusBySlug?.get(question.slug);
        return status !== "COMPLETED" && status !== "SKIPPED";
      }) ?? null)
    : findNextQuestion(plan, roadmap?.nextQuestionHref, currentChapterId, statusBySlug);
  const completed = [...(statusBySlug?.values() ?? [])].filter(
    (status) => status === "COMPLETED"
  ).length;

  return (
    <section id="plan" className="relative scroll-mt-20 lg:scroll-mt-8">
      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14 xl:gap-y-7">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <PracticeIntro
            purpose={purpose}
            roadmap={roadmap}
            recommendation={selectedRecommendation}
            completedQuestions={completed}
            nextHref={
              nextQuestion
                ? `/dsa-questions/${nextQuestion.slug}`
                : (roadmap?.nextQuestionHref ??
                  (plan.firstQuestionSlug ? `/dsa-questions/${plan.firstQuestionSlug}` : null))
            }
            nextLabel={completed > 0 ? "Continue" : "Start"}
            nextQuestionTitle={nextQuestion?.title ?? null}
          />
        </div>

        <div className="xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-[9.3rem]">
          <PracticeCoachCard />
        </div>

        <section
          className="min-w-0 xl:col-start-1 xl:row-start-2"
          aria-labelledby="dsa-path-heading"
        >
          {selectedRecommendation ? (
            <RecommendationBlock
              recommendation={selectedRecommendation}
              statusBySlug={selectedStatusBySlug}
              blockHistory={blockHistory}
              panel={panel}
              allowEarlyAssessmentStart={allowEarlyAssessmentStart}
            />
          ) : null}

          <h2
            id="dsa-path-heading"
            className={`${recommendation ? "mt-9" : ""} text-[12px] font-semibold uppercase tracking-[0.14em] text-cream/52`}
          >
            Explore all DSA
          </h2>
          <p className="mt-2 max-w-[42rem] text-[14px] leading-6 text-cream/52">
            Browse the full {plan.totalQuestions}-question library anytime.
          </p>

          <div className="mt-4 space-y-3">
            {plan.chapters.map((chapter, index) => (
              <ChapterBlock
                key={chapter.id}
                chapter={chapter}
                index={index}
                progress={progressByChapter.get(chapter.id) ?? null}
                statusBySlug={statusBySlug}
                current={chapter.id === currentChapterId}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function RecommendationBlock({
  recommendation,
  statusBySlug,
  blockHistory,
  panel,
  allowEarlyAssessmentStart
}: {
  recommendation: DsaRecommendation;
  statusBySlug: Map<string, string> | null;
  blockHistory: DsaBlockHistoryView | null;
  panel: "overview" | "transcript";
  allowEarlyAssessmentStart: boolean;
}) {
  return (
    <section aria-labelledby="recommended-now-heading">
      <div className="flex flex-col gap-4 rounded-[1.4rem] bg-[#17181b] px-5 py-5 sm:px-6 sm:py-6">
        {blockHistory ? <BlockHistoryNavigation history={blockHistory} /> : null}
        {blockHistory && panel === "transcript" ? (
          <BlockTranscript history={blockHistory} />
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-[42rem]">
                <h2
                  id="recommended-now-heading"
                  className="font-display text-[1.45rem] font-semibold tracking-[-0.025em] text-cream"
                >
                  Your {recommendation.questions.length}-question practice block
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-cream/54">
                  {recommendation.focusLabel}, selected for your current level.
                </p>
              </div>

              <div className="shrink-0 rounded-xl bg-[#111214] px-4 py-3 text-[12px] leading-5 text-cream/56">
                <p className="font-semibold text-cream/78">
                  {recommendation.questions.length} questions ·{" "}
                  {formatDuration(recommendation.minutes)}
                </p>
                <p className="mt-0.5 capitalize">
                  {recommendation.mix.easy} easy · {recommendation.mix.medium} medium ·{" "}
                  {recommendation.mix.hard} hard
                </p>
              </div>
            </div>

            <ul className="grid gap-2.5 lg:grid-cols-2">
              {recommendation.questions.map((question, index) => (
                <QuestionRow
                  key={question.slug}
                  question={question}
                  index={index}
                  status={statusBySlug?.get(question.slug) ?? null}
                  next={
                    question.slug ===
                    recommendation.questions.find((candidate) => {
                      const status = statusBySlug?.get(candidate.slug);
                      return status !== "COMPLETED" && status !== "SKIPPED";
                    })?.slug
                  }
                />
              ))}
            </ul>

            {blockHistory ? (
              <BlockAssessmentPreview
                block={blockHistory.selected}
                nextBlockId={blockHistory.nextBlockId}
                allowEarlyStart={allowEarlyAssessmentStart}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function BlockHistoryNavigation({ history }: { history: DsaBlockHistoryView }) {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4"
      aria-label="DSA block history"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/38">
          Practice history
        </p>
        <p className="mt-1 text-sm font-semibold text-cream/75">
          Block {history.selected.ordinal} of {history.totalBlocks}
          {history.selected.current ? " · Current" : " · Completed"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {history.previousBlockId ? (
          <Link
            href={`/practice/dsa?block=${encodeURIComponent(history.previousBlockId)}&panel=overview`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/62 hover:text-cream"
          >
            <ArrowLeft size={13} aria-hidden="true" /> Previous
          </Link>
        ) : (
          <span className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.04] px-3 text-xs text-cream/24">
            Previous
          </span>
        )}
        {history.nextBlockId ? (
          <Link
            href={`/practice/dsa?block=${encodeURIComponent(history.nextBlockId)}&panel=overview`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/62 hover:text-cream"
          >
            Next <ArrowRight size={13} aria-hidden="true" />
          </Link>
        ) : (
          <span className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.04] px-3 text-xs text-cream/24">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

function BlockTranscript({ history }: { history: DsaBlockHistoryView }) {
  const turns = history.selected.transcript;
  return (
    <section aria-labelledby="block-transcript-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="block-transcript-heading"
            className="font-display text-[1.45rem] font-semibold text-cream"
          >
            Block {history.selected.ordinal} assessment transcript
          </h2>
          <p className="mt-1 text-[13px] text-cream/48">Saved teacher and candidate turns.</p>
        </div>
        <Link
          href={`/practice/dsa?block=${encodeURIComponent(history.selected.id)}&panel=overview`}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/65"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Return to overview
        </Link>
      </div>
      {turns?.length ? (
        <ol className="mt-5 space-y-3">
          {turns.map((turn, index) => (
            <li
              key={`${turn.speaker}-${turn.startMs}-${index}`}
              className="rounded-xl bg-[#111214] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--workspace-accent)]">
                  {turn.speaker === "agent" ? "Teacher" : "Candidate"}
                </p>
                <time className="font-mono text-[10px] tabular-nums text-cream/35">
                  {formatTranscriptTime(turn.startMs)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-cream/68">
                {turn.text}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div
          role="status"
          className="mt-5 rounded-xl border border-white/[0.07] bg-[#111214] px-4 py-5 text-sm leading-6 text-cream/48"
        >
          No saved transcript is available for this assessment.
        </div>
      )}
    </section>
  );
}

function formatTranscriptTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function ChapterBlock({
  chapter,
  index,
  progress,
  statusBySlug,
  current
}: {
  chapter: DsaChapter;
  index: number;
  progress: FrontendRoadmapChapter | null;
  statusBySlug: Map<string, string> | null;
  current: boolean;
}) {
  const completedQuestions =
    progress?.completedQuestions ??
    chapter.questions.filter((question) => statusBySlug?.get(question.slug) === "COMPLETED").length;
  const done = completedQuestions === chapter.questions.length;
  const percent =
    chapter.questions.length > 0
      ? Math.round((completedQuestions / chapter.questions.length) * 100)
      : 0;
  const nextQuestionIndex = chapter.questions.findIndex((question) => {
    const status = statusBySlug?.get(question.slug);
    return status !== "COMPLETED" && status !== "SKIPPED";
  });
  const nextQuestion = chapter.questions[nextQuestionIndex >= 0 ? nextQuestionIndex : 0] ?? null;

  return (
    <details
      className={[
        "dsa-chapter-details group overflow-hidden rounded-[1.4rem] bg-[#17181b] transition-colors duration-200",
        current ? "bg-[#191a1d]" : "hover:bg-[#1a1b1e]"
      ].join(" ")}
      open={current}
    >
      <summary className="flex min-h-[4.75rem] cursor-pointer list-none items-center gap-3.5 px-4 py-4 [&::-webkit-details-marker]:hidden sm:gap-4 sm:px-5">
        <span
          aria-hidden="true"
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.045] text-[13px] font-semibold tabular-nums",
            current ? "text-[var(--workspace-accent)]" : done ? "text-cream/70" : "text-cream/48"
          ].join(" ")}
        >
          {done ? <Check size={14} aria-hidden="true" /> : index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-cream sm:text-[18px]">
              {chapter.title}
            </span>
            {current && !done ? (
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                In progress
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block text-[13px] text-cream/50">
            {chapter.questions.length} {chapter.questions.length === 1 ? "problem" : "problems"}
          </span>
        </span>

        <span className="hidden w-32 shrink-0 sm:block">
          <span className="flex items-baseline justify-between text-[13px] font-semibold tracking-[-0.01em] tabular-nums">
            <span className="text-cream/72">{completedQuestions} solved</span>
            <span className="text-[var(--workspace-accent)]">{percent}%</span>
          </span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <span
              className="block h-full rounded-full bg-[var(--workspace-accent)]"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-cream/40 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="dsa-chapter-body">
        <div className="px-4 pb-3 sm:px-5 sm:pb-4">
          <QuestionStepper
            questions={chapter.questions}
            statusBySlug={statusBySlug}
            completedQuestions={completedQuestions}
          />
        </div>

        <ul className="grid gap-2.5 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-2">
          {chapter.questions.map((question, questionIndex) => (
            <QuestionRow
              key={question.slug}
              question={question}
              index={questionIndex}
              status={statusBySlug?.get(question.slug) ?? null}
              next={question.slug === nextQuestion?.slug && !done}
            />
          ))}
        </ul>
      </div>
    </details>
  );
}

function QuestionStepper({
  questions,
  statusBySlug,
  completedQuestions
}: {
  questions: PlanQuestion[];
  statusBySlug: Map<string, string> | null;
  completedQuestions: number;
}) {
  const currentStepIndex = Math.min(completedQuestions, Math.max(questions.length - 1, 0));

  return (
    <nav className="flex gap-1.5" aria-label="Jump to a question in this pattern">
      {questions.map((question, index) => {
        const status = statusBySlug?.get(question.slug) ?? null;
        const isPassed = index < completedQuestions;
        const isCurrent = index === currentStepIndex;
        return (
          <Link
            key={question.slug}
            href={`/dsa-questions/${question.slug}`}
            aria-label={`Question ${index + 1}: ${question.title}${isCurrent ? ", current progress step" : status === "COMPLETED" ? ", completed" : ""}`}
            aria-current={isCurrent ? "step" : undefined}
            className="group/step relative min-w-0 flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181b]"
          >
            {isCurrent ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-1 top-1/2 h-4 -translate-y-1/2 rounded-full bg-[var(--workspace-accent)] opacity-30 blur-md"
              />
            ) : null}
            <span
              className={[
                "relative z-10 block h-1.5 w-full rounded-full transition duration-200 group-hover/step:-translate-y-0.5 group-hover/step:brightness-125",
                stepTone(isPassed, isCurrent)
              ].join(" ")}
            />
            <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-30 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-[#0e0f11] px-2.5 py-2 text-center text-[11px] leading-4 text-cream/72 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition group-hover/step:opacity-100 group-focus-visible/step:opacity-100 sm:block">
              <strong className="block font-medium text-cream/92">
                {index + 1} · {question.title}
              </strong>
              <span className="capitalize text-cream/45">
                {isCurrent
                  ? "Current progress"
                  : status === "COMPLETED"
                    ? "Completed"
                    : question.difficulty}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function QuestionRow({
  question,
  index,
  status,
  next
}: {
  question: PlanQuestion;
  index: number;
  status: string | null;
  next: boolean;
}) {
  const completed = status === "COMPLETED";
  const skipped = status === "SKIPPED";

  return (
    <li className="min-w-0">
      <Link
        href={`/dsa-questions/${question.slug}`}
        className="group/question flex h-full min-h-[5rem] items-start gap-3.5 rounded-[1rem] bg-[#111214] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-[#141518] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[12px] font-semibold tabular-nums text-cream/50">
          {index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`truncate text-[15px] font-semibold tracking-[-0.015em] sm:text-[15.5px] ${completed ? "text-cream/82" : "text-cream/88 group-hover/question:text-cream"}`}
            >
              {question.title}
            </span>
            {completed ? (
              <span className="rounded-full bg-[var(--workspace-accent-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--workspace-accent)]">
                Solved
              </span>
            ) : skipped ? (
              <span className="rounded-full border border-[#e3a15b]/15 bg-[#e3a15b]/10 px-2.5 py-1 text-[10px] font-semibold text-[#e7bd83]">
                Skipped · Learn &amp; retry
              </span>
            ) : next ? (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-cream/52">
                Up next
              </span>
            ) : null}
          </span>
          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px] text-cream/50">
            <span className="truncate">{formatPattern(question.primaryPattern)}</span>
            <span className="text-cream/22">•</span>
            <span className="capitalize">{question.difficulty}</span>
            <span className="text-cream/22">•</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 size={11} aria-hidden="true" /> {question.expectedTimeMinutes} min
            </span>
          </span>
        </span>

        <span
          className={[
            "grid h-7 w-7 shrink-0 place-items-center rounded-full transition",
            completed
              ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
              : "text-cream/30 group-hover/question:bg-white/[0.05] group-hover/question:text-cream/68"
          ].join(" ")}
        >
          {completed ? (
            <Check size={12} aria-hidden="true" />
          ) : skipped ? (
            <SkipForward size={11} aria-hidden="true" />
          ) : (
            <ArrowRight size={12} aria-hidden="true" />
          )}
        </span>
      </Link>
    </li>
  );
}

function stepTone(passed: boolean, current: boolean): string {
  if (current) return "workspace-accent-indicator";
  if (passed) return "bg-[var(--workspace-accent)]";
  return "bg-[#303236]";
}

function findNextQuestion(
  plan: FrontendDsaPlan,
  nextQuestionHref: string | undefined,
  currentChapterId: string | null,
  statusBySlug: Map<string, string> | null
): PlanQuestion | null {
  const questions = plan.chapters.flatMap((chapter) => chapter.questions);
  const hrefSlug = nextQuestionHref?.split("/").filter(Boolean).at(-1);
  const hrefMatch = hrefSlug
    ? questions.find((question) => question.slug === decodeURIComponent(hrefSlug))
    : null;
  if (hrefMatch) return hrefMatch;

  const activeQuestions =
    plan.chapters.find((chapter) => chapter.id === currentChapterId)?.questions ?? questions;
  return (
    activeQuestions.find((question) => {
      const status = statusBySlug?.get(question.slug);
      return status !== "COMPLETED" && status !== "SKIPPED";
    }) ??
    questions[0] ??
    null
  );
}

function formatPattern(pattern: string): string {
  return pattern
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}
