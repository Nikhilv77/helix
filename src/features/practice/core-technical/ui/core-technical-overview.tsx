"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import {
  coreTechnicalQuestionMinutes,
  humanizeCoreTechnicalKey
} from "@/features/practice/core-technical/domain/ui-state";
import {
  CORE_TECHNICAL_ASSESSMENT_EXPERIENCE,
  CoreTechnicalAssessment,
  type PublicAssessment
} from "./core-technical-assessment";
import { CORE_TECHNICAL_INTRO_EXPERIENCE, CoreTechnicalIntro } from "./core-technical-intro";
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

const CORE_TECHNICAL_OVERVIEW_EXPERIENCE: StoryPracticeOverviewExperience = {
  slug: "core-technical",
  label: "Core Technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "story",
  environmentLabel: "Node.js 22",
  libraryDescription: "Browse the reviewed production stories in your Node.js path.",
  coachSteps: ["Name the mechanism", "Trace cause and consequence", "Prove the repair"],
  intro: CORE_TECHNICAL_INTRO_EXPERIENCE,
  assessment: CORE_TECHNICAL_ASSESSMENT_EXPERIENCE
};

export function CoreTechnicalOverview({
  block,
  history,
  storyLibrary = [],
  storyHistory = [],
  allowEarlyAssessmentStart = false,
  experience
}: {
  block: StoryPracticeBlockView;
  history: StoryPracticeHistoryNavigationView | null;
  storyLibrary?: StoryPracticeLibraryEntryView[];
  storyHistory?: StoryPracticeHistoryListView;
  allowEarlyAssessmentStart?: boolean;
  experience?: StoryPracticeOverviewExperience;
}) {
  const resolvedExperience = experience ?? CORE_TECHNICAL_OVERVIEW_EXPERIENCE;
  const terminalCount = block.questions.filter(
    ({ status }) => status === "COMPLETED" || status === "LEARNED"
  ).length;
  const nextQuestion = block.questions.find(({ status }) => status === "ACTIVE") ?? null;

  return (
    <section className="relative scroll-mt-20 lg:scroll-mt-8">
      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14 xl:gap-y-7">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <CoreTechnicalIntro
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
                    minutes={coreTechnicalQuestionMinutes(
                      question.question.format,
                      block.story.expectedMinutes
                    )}
                    routeBase={resolvedExperience.routeBase}
                  />
                );
              })}
            </ul>

            <CoreTechnicalAssessment
              block={block}
              terminalCount={terminalCount}
              allowEarlyStart={allowEarlyAssessmentStart}
              experience={resolvedExperience.assessment}
            />
          </div>

          <StoryLibrary
            entries={storyLibrary}
            history={storyHistory}
            selectedBlockId={block.id}
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
  experience
}: {
  entries: StoryPracticeLibraryEntryView[];
  history: StoryPracticeHistoryListView;
  selectedBlockId: string;
  experience: StoryPracticeOverviewExperience;
}) {
  const cards = storyLibraryCards(entries, history);
  if (!cards.length) return null;

  return (
    <section className="mt-9" aria-labelledby={`${experience.slug}-library-heading`}>
      <h2
        id={`${experience.slug}-library-heading`}
        className="text-[12px] font-semibold uppercase tracking-[0.14em] text-cream/52"
      >
        Explore all {experience.label}
      </h2>
      <p className="mt-2 max-w-[42rem] text-[14px] leading-6 text-cream/52">
        {experience.libraryDescription} Questions stay inside the active {experience.subjectNoun}.
      </p>

      <div className="mt-4 space-y-3">
        {cards.map((card, index) => (
          <StoryLibraryCard
            key={card.key}
            card={card}
            index={index}
            selected={card.history?.id === selectedBlockId}
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
  history: StoryPracticeHistoryListView[number] | null;
};

function storyLibraryCards(
  entries: StoryPracticeLibraryEntryView[],
  history: StoryPracticeHistoryListView
): StoryLibraryCardView[] {
  const latestByKey = new Map<string, StoryPracticeHistoryListView[number]>();
  for (const item of [...history].sort((left, right) => right.ordinal - left.ordinal)) {
    if (!latestByKey.has(item.story.key)) latestByKey.set(item.story.key, item);
  }

  const cards = entries.map((entry) => ({
    key: entry.key,
    title: entry.title,
    topicKeys: entry.topicKeys,
    difficulties: entry.difficulties,
    history: latestByKey.get(entry.key) ?? null
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
      history: item
    });
  }
  return cards;
}

function StoryLibraryCard({
  card,
  index,
  selected,
  experience
}: {
  card: StoryLibraryCardView;
  index: number;
  selected: boolean;
  experience: StoryPracticeOverviewExperience;
}) {
  const totalQuestions = card.history?.story.stages.length ?? 8;
  const progressed = card.history
    ? card.history.completedQuestionCount + card.history.learnedQuestionCount
    : 0;
  const percent = Math.round((progressed / Math.max(totalQuestions, 1)) * 100);
  const status = card.history
    ? card.history.status === "ASSESSED"
      ? "Completed"
      : card.history.isCurrent
        ? "Current"
        : "Practised"
    : "Not started";
  const className = `group flex min-w-0 flex-col gap-5 rounded-[1.2rem] border px-5 py-5 transition sm:flex-row sm:items-center ${selected ? "border-[var(--workspace-accent-border)] bg-[linear-gradient(110deg,var(--workspace-accent-soft),#17181b_28%)]" : card.history ? "border-white/[0.06] bg-[#17181b] hover:-translate-y-0.5 hover:border-white/[0.11] hover:bg-[#191a1e]" : "border-white/[0.045] bg-[#141518]"}`;
  const content = (
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
              {humanizeCoreTechnicalKey(topic)}
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
    </>
  );

  return card.history ? (
    <Link
      href={`${experience.routeBase}?block=${encodeURIComponent(card.history.id)}`}
      aria-current={selected ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
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
            <span>{humanizeCoreTechnicalKey(question.question.format)}</span>
            <span className="text-cream/22">•</span>
            <span>{humanizeCoreTechnicalKey(difficulty)}</span>
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
