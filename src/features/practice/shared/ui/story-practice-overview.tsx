"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { humanizeStoryPracticeKey, storyPracticeQuestionMinutes } from "./presentation";
import { StoryPracticeAssessment, type PublicAssessment } from "./story-practice-assessment";
import { StoryPracticeIntro } from "./story-practice-intro";
import type { StoryPracticeOverviewExperience as StoryPracticeOverviewExperienceContract } from "@/features/practice/shared/ui/contracts";
import type {
  StoryPracticeBlockView,
  StoryPracticeHistoryListView,
  StoryPracticeHistoryNavigationView,
  StoryPracticeLibraryEntryView
} from "@/features/practice/shared/ui/view-contracts";

export type StoryPracticeOverviewExperience = StoryPracticeOverviewExperienceContract<
  PublicAssessment,
  NonNullable<PublicAssessment["report"]>
>;

export type StoryPracticeOverviewProps = {
  block: StoryPracticeBlockView;
  history: StoryPracticeHistoryNavigationView | null;
  storyLibrary?: StoryPracticeLibraryEntryView[];
  storyHistory?: StoryPracticeHistoryListView;
  allowEarlyAssessmentStart?: boolean;
  experience: StoryPracticeOverviewExperience;
};

export function StoryPracticeOverview({
  block,
  history,
  storyLibrary = [],
  storyHistory = [],
  allowEarlyAssessmentStart = false,
  experience: resolvedExperience
}: StoryPracticeOverviewProps) {
  const terminalCount = block.questions.filter(
    ({ status }) => status === "COMPLETED" || status === "LEARNED"
  ).length;
  const nextQuestion = block.questions.find(({ status }) => status === "ACTIVE") ?? null;

  return (
    <section className="relative scroll-mt-20 lg:scroll-mt-8">
      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14 xl:gap-y-7">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <StoryPracticeIntro
            block={block}
            terminalCount={terminalCount}
            experience={resolvedExperience.intro}
          />
        </div>

        <aside className="rounded-[1.45rem] border border-white/[0.085] bg-[#141619] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:px-6 xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-[9.3rem]">
          <h2 className="font-display text-[1.2rem] font-semibold leading-6 tracking-[-0.025em] text-cream">
            Follow the evidence.
          </h2>
          <ol className="mt-4 space-y-3.5">
            {resolvedExperience.coachSteps.map((title, index) => (
              <CoachStep key={title} number={`0${index + 1}`} title={title} />
            ))}
          </ol>
        </aside>

        <section
          className="min-w-0 xl:col-start-1 xl:row-start-2"
          aria-labelledby={`${resolvedExperience.slug}-path-heading`}
        >
          <div className="flex flex-col gap-4 rounded-[1.4rem] bg-[#17181b] px-5 py-5 sm:px-6 sm:py-6">
            {history ? (
              <HistoryNavigation history={history} experience={resolvedExperience} />
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2
                  id={`${resolvedExperience.slug}-path-heading`}
                  className="font-display text-[1.45rem] font-semibold tracking-[-0.025em] text-cream"
                >
                  Your {block.questions.length}-question {resolvedExperience.subjectNoun}
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-cream/54">
                  {block.story.candidateRole}
                </p>
                <p className="mt-2 max-w-[42rem] text-[12px] leading-5 text-cream/38">
                  {block.selection.reason}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-[#111214] px-4 py-3 text-[12px] leading-5 text-cream/56">
                <p className="font-semibold text-cream/78">
                  {block.questions.length} questions · {block.story.expectedMinutes} min
                </p>
                <p className="mt-0.5 capitalize">
                  {block.selection.difficulty}
                  {resolvedExperience.environmentLabel
                    ? ` · ${resolvedExperience.environmentLabel}`
                    : ""}
                </p>
              </div>
            </div>

            <nav
              className="flex gap-1.5"
              aria-label={`Jump to an ${resolvedExperience.label} question`}
            >
              {block.questions.map((question) => {
                const current = question.status === "ACTIVE";
                const terminal = question.status === "COMPLETED" || question.status === "LEARNED";
                const stage = block.story.stages.find(({ order }) => order === question.order);
                return (
                  <Link
                    key={question.id}
                    href={`${resolvedExperience.routeBase}/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(block.id)}`}
                    aria-label={`Question ${question.order}: ${stage?.title ?? `${capitalize(resolvedExperience.subjectNoun)} stage`}, ${current ? "current progress" : question.status.toLowerCase()}`}
                    aria-current={current ? "step" : undefined}
                    data-story-practice-progress={terminal ? "terminal" : "pending"}
                    data-core-progress={terminal ? "terminal" : "pending"}
                    className="group/step relative flex min-h-11 min-w-0 flex-1 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181b]"
                  >
                    <span
                      className={`relative z-10 block h-1.5 w-full rounded-full transition duration-200 group-hover/step:-translate-y-0.5 ${terminal ? "bg-[var(--workspace-accent)] shadow-[0_0_14px_var(--workspace-accent)]" : "bg-[#303236] group-hover/step:bg-[#3a3c41]"}`}
                    />
                    <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-30 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-[#0e0f11] px-2.5 py-2 text-center text-[11px] leading-4 text-cream/72 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition group-hover/step:opacity-100 group-focus-visible/step:opacity-100 sm:block">
                      <strong className="block font-medium text-cream/92">
                        {question.order} ·{" "}
                        {stage?.title ?? `${capitalize(resolvedExperience.subjectNoun)} stage`}
                      </strong>
                      <span className="capitalize text-cream/45">
                        {current ? "Current progress" : question.status.toLowerCase()}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <ul className="grid gap-2.5 lg:grid-cols-2">
              {block.questions.map((question) => {
                const stage = block.story.stages.find(({ order }) => order === question.order);
                return (
                  <QuestionRow
                    key={question.id}
                    blockId={block.id}
                    question={question}
                    title={stage?.title ?? `Question ${question.order}`}
                    next={question.id === nextQuestion?.id && block.isCurrent}
                    difficulty={block.selection.difficulty}
                    minutes={storyPracticeQuestionMinutes(
                      question.question.format,
                      block.story.expectedMinutes
                    )}
                    routeBase={resolvedExperience.routeBase}
                  />
                );
              })}
            </ul>

            <StoryPracticeAssessment
              block={block}
              terminalCount={terminalCount}
              allowEarlyStart={allowEarlyAssessmentStart}
              dedicatedRoom={false}
              experience={resolvedExperience.assessment}
            />
          </div>

          <StoryLibrary
            entries={storyLibrary}
            history={storyHistory}
            selectedBlockId={block.id}
            selectedBlock={block}
            experience={resolvedExperience}
          />
        </section>
      </div>
    </section>
  );
}

function StoryLibrary({
  entries,
  history,
  selectedBlockId,
  selectedBlock,
  experience
}: {
  entries: StoryPracticeLibraryEntryView[];
  history: StoryPracticeHistoryListView;
  selectedBlockId: string;
  selectedBlock: StoryPracticeBlockView;
  experience: StoryPracticeOverviewExperience;
}) {
  const router = useRouter();
  const pendingPaths = useRef(new Set<string>());
  const requestedOrderByPath = useRef(new Map<string, number>());
  const [startingOrderByPath, setStartingOrderByPath] = useState<Record<string, number>>({});
  const [startErrorByPath, setStartErrorByPath] = useState<Record<string, string>>({});
  const cards = storyLibraryCards(entries, history).sort((left, right) => {
    const leftIsCurrent = left.history?.isCurrent === true;
    const rightIsCurrent = right.history?.isCurrent === true;
    if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
    const leftIsSelected = left.history?.id === selectedBlockId;
    const rightIsSelected = right.history?.id === selectedBlockId;
    if (leftIsSelected !== rightIsSelected) return leftIsSelected ? -1 : 1;
    return left.curriculumOrder - right.curriculumOrder;
  });
  if (!cards.length) return null;

  const openLibraryQuestion = async (storyKey: string, order: number) => {
    if (!experience.startUnstartedPath) return;
    requestedOrderByPath.current.set(storyKey, order);
    setStartingOrderByPath((current) => ({ ...current, [storyKey]: order }));
    setStartErrorByPath((current) => withoutKey(current, storyKey));
    // A second row click in the same path reuses the in-flight preparation and
    // changes only the destination question. Other paths remain interactive.
    if (pendingPaths.current.has(storyKey)) return;
    pendingPaths.current.add(storyKey);
    const storageKey = `${experience.slug}-start-path:${storyKey}`;
    const requestId = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, requestId);
    try {
      const payload = await postLibraryPath(experience.startUnstartedPath.endpoint, {
        requestId,
        storyKey
      });
      const destination = readPreparedQuestion(
        payload,
        requestedOrderByPath.current.get(storyKey) ?? order
      );
      if (!destination) throw new Error("The prepared question could not be opened.");
      sessionStorage.removeItem(storageKey);
      router.push(
        `${experience.routeBase}/questions/${encodeURIComponent(destination.questionId)}?block=${encodeURIComponent(destination.blockId)}`
      );
    } catch (cause) {
      setStartErrorByPath((current) => ({
        ...current,
        [storyKey]:
          cause instanceof Error
            ? cause.message
            : "This practice path could not be prepared. Your progress is safe; try again."
      }));
    } finally {
      pendingPaths.current.delete(storyKey);
      requestedOrderByPath.current.delete(storyKey);
      setStartingOrderByPath((current) => withoutKey(current, storyKey));
    }
  };

  return (
    <section className="mt-9" aria-labelledby={`${experience.slug}-library-heading`}>
      <h2
        id={`${experience.slug}-library-heading`}
        className="text-[12px] font-semibold uppercase tracking-[0.14em] text-cream/52"
      >
        Explore all {experience.label}
      </h2>
      <p className="mt-2 max-w-[42rem] text-[14px] leading-6 text-cream/52">
        {experience.libraryDescription} Practice any question; only the current{" "}
        {experience.subjectNoun}
        unlocks an assessment.
      </p>

      <div className="mt-4 space-y-3">
        {cards.map((card, index) => (
          <StoryLibraryCard
            key={card.key}
            card={card}
            index={index}
            selected={card.history?.id === selectedBlockId}
            selectedBlock={card.history?.id === selectedBlockId ? selectedBlock : null}
            candidateDifficulty={selectedBlock.selection.difficulty}
            startingOrder={startingOrderByPath[card.key] ?? null}
            startError={startErrorByPath[card.key] ?? null}
            onQuestionOpen={
              experience.startUnstartedPath
                ? (order) => void openLibraryQuestion(card.key, order)
                : null
            }
            experience={experience}
          />
        ))}
      </div>
    </section>
  );
}

type StoryLibraryCardView = {
  key: string;
  title: string;
  topicKeys: string[];
  difficulties: string[];
  expectedMinutes: number;
  questions: NonNullable<StoryPracticeLibraryEntryView["questions"]>;
  history: StoryPracticeHistoryListView[number] | null;
  curriculumOrder: number;
};

function storyLibraryCards(
  entries: StoryPracticeLibraryEntryView[],
  history: StoryPracticeHistoryListView
): StoryLibraryCardView[] {
  const latestByKey = new Map<string, StoryPracticeHistoryListView[number]>();
  for (const item of [...history].sort((left, right) => right.ordinal - left.ordinal)) {
    if (!latestByKey.has(item.story.key)) latestByKey.set(item.story.key, item);
  }

  const cards = entries.map((entry, curriculumOrder) => ({
    key: entry.key,
    title: entry.title,
    topicKeys: entry.topicKeys,
    difficulties: entry.difficulties,
    expectedMinutes: entry.expectedMinutes ?? 45,
    questions: entry.questions ?? [],
    history: latestByKey.get(entry.key) ?? null,
    curriculumOrder
  }));
  const known = new Set(cards.map(({ key }) => key));
  for (const item of [...history].sort((left, right) => left.ordinal - right.ordinal)) {
    if (known.has(item.story.key)) continue;
    known.add(item.story.key);
    cards.push({
      key: item.story.key,
      title: item.story.title,
      topicKeys: [item.story.primaryTopicKey, ...item.story.secondaryTopicKeys],
      difficulties: [item.story.difficulty],
      expectedMinutes: 45,
      questions: item.story.stages.map(({ order }) => ({
        order,
        title: `Question ${order}`,
        format: "written"
      })),
      history: item,
      curriculumOrder: cards.length
    });
  }
  return cards;
}

function StoryLibraryCard({
  card,
  index,
  selected,
  selectedBlock,
  candidateDifficulty,
  startingOrder,
  startError,
  onQuestionOpen,
  experience
}: {
  card: StoryLibraryCardView;
  index: number;
  selected: boolean;
  selectedBlock: StoryPracticeBlockView | null;
  candidateDifficulty: StoryPracticeBlockView["selection"]["difficulty"];
  startingOrder: number | null;
  startError: string | null;
  onQuestionOpen: ((order: number) => void) | null;
  experience: StoryPracticeOverviewExperience;
}) {
  const totalQuestions = card.questions.length || card.history?.story.stages.length || 8;
  const progressed = card.history
    ? card.history.completedQuestionCount + card.history.learnedQuestionCount
    : 0;
  const percent = Math.round((progressed / Math.max(totalQuestions, 1)) * 100);
  const status = card.history
    ? card.history.status === "ASSESSED"
      ? "Completed"
      : card.history.isCurrent
        ? "Current"
        : "In progress"
    : "Not started";
  const className = `group overflow-hidden rounded-[1.2rem] border bg-[#17181b] transition duration-200 ${selected ? "border-[var(--workspace-accent-border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_0_0_1px_var(--workspace-accent-soft),0_18px_48px_rgba(0,0,0,0.24)]" : card.history ? "border-white/[0.075] hover:border-white/[0.14] hover:bg-[#191a1e]" : "border-white/[0.055] bg-[#141518] hover:border-white/[0.11]"}`;
  const summary = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] font-mono text-[12px] font-semibold tabular-nums text-[var(--workspace-accent)]">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[1.15rem] font-semibold tracking-[-0.025em] text-cream/88 sm:text-[1.25rem]">
            {card.title}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${card.history?.isCurrent ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]" : "bg-white/[0.05] text-cream/40"}`}
          >
            {status}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-cream/42">
          <span>
            {totalQuestions}-question {experience.subjectNoun}
          </span>
          <span className="text-cream/20">•</span>
          <span className="capitalize">{card.difficulties.join(" · ")}</span>
          {card.topicKeys.slice(0, 2).map((topic) => (
            <span key={topic} className="rounded-md bg-white/[0.035] px-2 py-0.5">
              {humanizeStoryPracticeKey(topic)}
            </span>
          ))}
        </span>
      </span>
      <span className="w-full shrink-0 sm:w-36">
        <span className="flex items-baseline justify-between text-[12px] font-semibold tabular-nums">
          <span className="text-cream/62">{progressed} progressed</span>
          <span className={progressed ? "text-[var(--workspace-accent)]" : "text-cream/30"}>
            {percent}%
          </span>
        </span>
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="block h-full rounded-full bg-[var(--workspace-accent)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </span>
      </span>
      <ChevronDown
        size={17}
        aria-hidden="true"
        className="shrink-0 text-cream/35 transition-transform duration-200 group-open:rotate-180"
      />
    </>
  );

  const recommendedDifficulty = card.difficulties.includes(candidateDifficulty)
    ? candidateDifficulty
    : (card.difficulties[0] ?? candidateDifficulty);
  const difficulty =
    selectedBlock?.selection.difficulty ?? card.history?.story.difficulty ?? recommendedDifficulty;
  const savedQuestionByOrder = new Map(
    (card.history?.questions ?? []).map((question) => [question.order, question])
  );
  const questions = (
    selectedBlock
      ? selectedBlock.questions.map((question) => ({
          order: question.order,
          title:
            selectedBlock.story.stages.find(({ order }) => order === question.order)?.title ??
            `Question ${question.order}`,
          format: question.question.format,
          id: question.id,
          status: question.status
        }))
      : card.questions.map((question) => ({
          ...question,
          id: savedQuestionByOrder.get(question.order)?.id ?? null,
          status: savedQuestionByOrder.get(question.order)?.status ?? null
        }))
  ).sort((left, right) => left.order - right.order);

  return (
    <details
      className={`dsa-chapter-details ${className}`}
      open={selected || card.history?.isCurrent}
    >
      <summary
        className="flex min-h-[7.5rem] cursor-pointer list-none flex-col gap-5 px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--workspace-accent)] sm:flex-row sm:items-center [&::-webkit-details-marker]:hidden"
        aria-current={selected ? "page" : undefined}
      >
        {summary}
      </summary>
      <div className="dsa-chapter-body border-t border-white/[0.06] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {questions.map((question) => (
            <LibraryQuestionRow
              key={`${card.key}-${question.order}`}
              question={question}
              blockId={selectedBlock?.id ?? card.history?.id ?? null}
              routeBase={experience.routeBase}
              difficulty={difficulty}
              minutes={storyPracticeQuestionMinutes(
                question.format as Parameters<typeof storyPracticeQuestionMinutes>[0],
                selectedBlock?.story.expectedMinutes ?? card.expectedMinutes
              )}
              loading={startingOrder === question.order}
              onOpen={!card.history && onQuestionOpen ? () => onQuestionOpen(question.order) : null}
            />
          ))}
        </ul>
        {startError ? (
          <p role="alert" className="px-1 pt-3 text-[11px] leading-5 text-[#e7bd83]">
            {startError}
          </p>
        ) : null}
      </div>
    </details>
  );
}

async function postLibraryPath(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : "This practice path could not be prepared. Your progress is safe; try again.";
    throw new Error(message);
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function readPreparedQuestion(
  payload: unknown,
  order: number
): { blockId: string; questionId: string } | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.block)) return null;
  const block = payload.data.block;
  if (typeof block.id !== "string" || !Array.isArray(block.questions)) return null;
  const question = block.questions.find(
    (item) => isRecord(item) && item.order === order && typeof item.id === "string"
  );
  return isRecord(question) && typeof question.id === "string"
    ? { blockId: block.id, questionId: question.id }
    : null;
}

function LibraryQuestionRow({
  question,
  blockId,
  routeBase,
  difficulty,
  minutes,
  loading,
  onOpen
}: {
  question: {
    order: number;
    title: string;
    format: string;
    id: string | null;
    status: string | null;
  };
  blockId: string | null;
  routeBase: string;
  difficulty: string;
  minutes: number;
  loading: boolean;
  onOpen: (() => void) | null;
}) {
  const completed = question.status === "COMPLETED";
  const learned = question.status === "LEARNED";
  const body = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[12px] font-semibold tabular-nums text-cream/50">
        {question.order}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-cream/88 group-hover/question:text-cream sm:text-[15.5px]">
            {question.title}
          </span>
          {completed || learned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--workspace-accent-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--workspace-accent)]">
              <Check size={10} aria-hidden="true" /> {completed ? "Solved" : "Learned"}
            </span>
          ) : null}
        </span>
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px] text-cream/50">
          <span>{humanizeStoryPracticeKey(question.format)}</span>
          <span className="text-cream/22">•</span>
          <span>{humanizeStoryPracticeKey(difficulty)}</span>
          <span className="text-cream/22">•</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 size={11} aria-hidden="true" /> {minutes} min
          </span>
        </span>
      </span>
      {loading ? (
        <Loader2
          size={14}
          className="shrink-0 text-[var(--workspace-accent)] motion-safe:animate-spin"
          aria-hidden="true"
        />
      ) : question.id || onOpen ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cream/30 group-hover/question:bg-white/[0.05] group-hover/question:text-cream/68">
          <ArrowRight size={12} aria-hidden="true" />
        </span>
      ) : null}
    </>
  );
  const rowClass =
    "group/question flex h-full min-h-[5rem] items-start gap-3.5 rounded-[1rem] bg-[#111214] p-4";
  return (
    <li className="min-w-0">
      {question.id && blockId ? (
        <Link
          href={`${routeBase}/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(blockId)}`}
          className={`${rowClass} transition duration-200 hover:-translate-y-0.5 hover:bg-[#141518] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]`}
        >
          {body}
        </Link>
      ) : onOpen ? (
        <button
          type="button"
          disabled={loading}
          onClick={onOpen}
          className={`${rowClass} w-full text-left transition duration-200 hover:-translate-y-0.5 hover:bg-[#141518] disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]`}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

function HistoryNavigation({
  history,
  experience
}: {
  history: StoryPracticeHistoryNavigationView;
  experience: StoryPracticeOverviewExperience;
}) {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4"
      aria-label={`${experience.label} ${experience.subjectNoun} history`}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/38">
          {capitalize(experience.subjectNoun)} history
        </p>
        <p className="mt-1 text-sm font-semibold text-cream/75">
          {capitalize(experience.subjectNoun)} {history.selected.ordinal} of {history.totalBlocks}
          {history.selected.isCurrent ? " · Current" : " · Completed"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <HistoryLink
          blockId={history.previousBlockId}
          direction="previous"
          routeBase={experience.routeBase}
        />
        <HistoryLink
          blockId={history.nextBlockId}
          direction="next"
          routeBase={experience.routeBase}
        />
      </div>
    </nav>
  );
}

function HistoryLink({
  blockId,
  direction,
  routeBase
}: {
  blockId: string | null;
  direction: "previous" | "next";
  routeBase: string;
}) {
  const label = direction === "previous" ? "Previous" : "Next";
  if (!blockId) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.04] px-3 text-xs text-cream/24">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`${routeBase}?block=${encodeURIComponent(blockId)}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-cream/62 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
    >
      {direction === "previous" ? <ArrowLeft size={13} aria-hidden="true" /> : null}
      {label}
      {direction === "next" ? <ArrowRight size={13} aria-hidden="true" /> : null}
    </Link>
  );
}

function QuestionRow({
  blockId,
  question,
  title,
  next,
  difficulty,
  minutes,
  routeBase
}: {
  blockId: string;
  question: StoryPracticeBlockView["questions"][number];
  title: string;
  next: boolean;
  difficulty: StoryPracticeBlockView["selection"]["difficulty"];
  minutes: number;
  routeBase: string;
}) {
  const completed = question.status === "COMPLETED";
  const learned = question.status === "LEARNED";
  return (
    <li className="min-w-0">
      <Link
        href={`${routeBase}/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(blockId)}`}
        className="group/question flex h-full min-h-[5rem] items-start gap-3.5 rounded-[1rem] bg-[#111214] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-[#141518] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[12px] font-semibold tabular-nums text-cream/50">
          {question.order}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-cream/88 group-hover/question:text-cream sm:text-[15.5px]">
              {title}
            </span>
            {completed ? (
              <StatusPill label="Completed" />
            ) : learned ? (
              <StatusPill label="Learned" learned />
            ) : next ? (
              <StatusPill label="Up next" subtle />
            ) : null}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 text-[12.5px] text-cream/50">
            <span>{humanizeStoryPracticeKey(question.question.format)}</span>
            <span className="text-cream/22">•</span>
            <span>{humanizeStoryPracticeKey(difficulty)}</span>
            <span className="text-cream/22">•</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 size={11} aria-hidden="true" /> {minutes} min
            </span>
          </span>
        </span>
        {!completed && !learned ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cream/30 group-hover/question:bg-white/[0.05] group-hover/question:text-cream/68">
            <ArrowRight size={12} aria-hidden="true" />
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function StatusPill({
  label,
  learned = false,
  subtle = false
}: {
  label: string;
  learned?: boolean;
  subtle?: boolean;
}) {
  const tone = learned
    ? "border border-[#e3a15b]/15 bg-[#e3a15b]/10 text-[#e7bd83]"
    : subtle
      ? "bg-white/[0.06] text-cream/52"
      : "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${tone}`}
    >
      {label}
    </span>
  );
}

function CoachStep({ number, title }: { number: string; title: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="font-mono text-[9px] font-semibold text-[var(--workspace-accent)]">
        {number}
      </span>
      <span className="text-[13px] font-medium leading-5 text-cream/76">{title}</span>
    </li>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
