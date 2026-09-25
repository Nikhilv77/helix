"use client";

import { workspaceMutationFetch } from "@/lib/workspace/summary-cache-invalidation";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  FileText,
  FlaskConical,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  X,
  XCircle
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DsaCodeEditor } from "@/features/interviews/ui/dsa/dsa-code-editor";
import { StoryPracticeArtifact } from "@/features/practice/shared/ui/story-practice-artifact";
import { PracticeCodeViewer } from "@/features/practice/shared/ui/practice-code-viewer";
import type { StoryPracticeWorkspaceExperience as StoryPracticeWorkspaceExperienceContract } from "@/features/practice/shared/ui/contracts";
import type {
  StoryPracticeAttemptWork,
  StoryPracticeQuestionBlockView,
  StoryPracticeDraftWork,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import {
  humanizeStoryPracticeKey,
  storyPracticeQuestionMinutes,
  storyPracticeQuestionWorkKind
} from "./presentation";
import { InteractiveAnswerInput } from "./interactive-answer-input";
import {
  emptyInteractiveResponse,
  interactiveResponseError,
  type InteractiveResponse
} from "../domain/interactive-response";
import { StoryPracticeLearningGuide } from "./story-practice-learning-guide";

type PendingAction = "hint" | "run" | "attempt" | "learn" | null;
type QuestionPanelTab = "description" | "hints" | "review";
type LocalRun = {
  id: string;
  code: string;
  result: NonNullable<StoryPracticeQuestionView["latestRun"]>["result"];
  createdAt: string;
};

export type StoryPracticeWorkspaceExperience =
  StoryPracticeWorkspaceExperienceContract<StoryPracticeQuestionView>;

export type StoryPracticeQuestionWorkspaceProps = {
  block: StoryPracticeQuestionBlockView;
  initialQuestion: StoryPracticeQuestionView;
  stageTitle: string;
  experience: StoryPracticeWorkspaceExperience;
  responseTool?: ReactNode;
  structuredAnswerPrompts?: readonly StructuredAnswerPrompt[];
};

export type StructuredAnswerPrompt = {
  label: string;
  suggestion: string;
};

const CORE_TECHNICAL_ANSWER_PROMPTS: readonly StructuredAnswerPrompt[] = [
  { label: "Outcome", suggestion: "State the exact outcome you expect from the evidence shown." },
  {
    label: "Why it happens",
    suggestion: "Connect that outcome to the runtime mechanism that causes it."
  },
  {
    label: "Production consequence",
    suggestion: "Explain the production impact if this behavior is misunderstood."
  },
  {
    label: "How to fix",
    suggestion: "Describe the smallest safe fix and why it changes the outcome."
  }
];

export function StoryPracticeQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle,
  experience,
  responseTool,
  structuredAnswerPrompts
}: StoryPracticeQuestionWorkspaceProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const interaction = question.question.interaction;
  const workKind = interaction
    ? "interactive"
    : storyPracticeQuestionWorkKind(question.question.format);
  const [interactive, setInteractive] = useState<InteractiveResponse | null>(() => {
    const saved = initialQuestion.draft ?? initialQuestion.latestAttempt?.work;
    return saved?.kind === "interactive"
      ? saved.response
      : interaction
        ? emptyInteractiveResponse(interaction)
        : null;
  });
  const [choice, setChoice] = useState<number | null>(() => initialChoice(initialQuestion));
  const [text, setText] = useState(() => initialText(initialQuestion));
  const [code, setCode] = useState(() => initialCode(initialQuestion));
  const [run, setRun] = useState<LocalRun | null>(() => initialRun(initialQuestion));
  const [pending, setPending] = useState<PendingAction>(null);
  const [draftState, setDraftState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [confirmLearn, setConfirmLearn] = useState(false);
  const usesModalReview = experience.answerReview === "modal";
  const answerPrompts =
    structuredAnswerPrompts ?? (usesModalReview ? CORE_TECHNICAL_ANSWER_PROMPTS : []);
  const [panelTab, setPanelTab] = useState<QuestionPanelTab>(() =>
    initialQuestion.status === "ACTIVE" || experience.slug === "core-technical"
      ? "description"
      : "review"
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [testCasesOpen, setTestCasesOpen] = useState(() => initialQuestion.latestRun !== null);
  const initialDraft = useRef(JSON.stringify(draftFor(workKind, choice, text, code, interactive)));
  const draftSequence = useRef(0);
  // Non-current library paths remain ordinary practice. Current ownership only
  // controls block-assessment eligibility, not whether a question can be solved.
  const mutable = block.status === "PRACTISING" && question.status === "ACTIVE";
  const terminal = question.status === "COMPLETED" || question.status === "LEARNED";
  const questionMinutes = storyPracticeQuestionMinutes(
    question.question.format,
    block.story.expectedMinutes
  );
  const previous = block.questions.find(({ order }) => order === question.order - 1) ?? null;
  const next = block.questions.find(({ order }) => order === question.order + 1) ?? null;

  const draft = useMemo(
    () => draftFor(workKind, choice, text, code, interactive),
    [choice, code, text, workKind, interactive]
  );
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    if (!mutable || draftSignature === initialDraft.current) return;
    setDraftState("unsaved");
    const sequence = ++draftSequence.current;
    const timer = window.setTimeout(() => {
      setDraftState("saving");
      void post<{ question: StoryPracticeQuestionView }>(
        `${experience.apiBase}/draft`,
        {
          questionId: question.id,
          draft
        },
        experience.label
      )
        .then(() => {
          if (draftSequence.current !== sequence) return;
          initialDraft.current = draftSignature;
          setDraftState("saved");
        })
        .catch((cause) => {
          if (draftSequence.current !== sequence) return;
          setDraftState("unsaved");
          setError(messageFrom(cause, "Your draft could not be saved. Try editing it again."));
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, draftSignature, experience.apiBase, experience.label, mutable, question.id]);

  async function revealHint() {
    const hintNumber = question.revealedHints.length + 1;
    if (!mutable || hintNumber > question.question.hintCount || pending) return;
    setPending("hint");
    setError(null);
    try {
      const data = await post<{ question: StoryPracticeQuestionView }>(
        `${experience.apiBase}/hint`,
        { questionId: question.id, hintNumber },
        experience.label
      );
      setQuestion(experience.adaptQuestion(data.question));
      setPanelTab("hints");
    } catch (cause) {
      setError(messageFrom(cause, "The next hint could not be revealed."));
    } finally {
      setPending(null);
    }
  }

  async function runCode() {
    if (
      !experience.capabilities.runCode ||
      !mutable ||
      workKind !== "code" ||
      !code.trim() ||
      pending
    )
      return;
    setPending("run");
    setError(null);
    setRun(null);
    setTestCasesOpen(true);
    const requestId = replaySafeRequestId(`${experience.slug}-run:${question.id}`, code);
    try {
      const data = await post<{ run: Omit<LocalRun, "code"> }>(
        `${experience.apiBase}/run`,
        { questionId: question.id, requestId, code },
        experience.label
      );
      setRun({ ...data.run, code });
      setTestCasesOpen(true);
      clearReplayRequest(`${experience.slug}-run:${question.id}`);
    } catch (cause) {
      setError(messageFrom(cause, "The isolated runner could not execute this draft."));
    } finally {
      setPending(null);
    }
  }

  async function submitAttempt() {
    if (!mutable || pending) return;
    const work = attemptFor(workKind, choice, text, code, run, interactive);
    const validation =
      interaction && interactive
        ? interactiveResponseError(interaction, interactive, true)
        : validateAttempt(workKind, work, code, run);
    if (validation) {
      setError(validation);
      if (workKind === "code") setTestCasesOpen(true);
      return;
    }
    setPending("attempt");
    setError(null);
    const signature = JSON.stringify(work);
    const key = `${experience.slug}-attempt:${question.id}`;
    const requestId = replaySafeRequestId(key, signature);
    try {
      const data = await post<{
        attempt: NonNullable<StoryPracticeQuestionView["latestAttempt"]>;
        question: StoryPracticeQuestionView;
      }>(
        `${experience.apiBase}/attempt`,
        { questionId: question.id, requestId, work },
        experience.label
      );
      clearReplayRequest(key);
      setQuestion(experience.adaptQuestion(data.question));
      setConfirmLearn(false);
      if (usesModalReview) setReviewOpen(true);
      else setPanelTab("review");
    } catch (cause) {
      setError(messageFrom(cause, "Your answer could not be evaluated. Your draft is safe."));
    } finally {
      setPending(null);
    }
  }

  async function learn() {
    if (!mutable || !confirmLearn || pending) return;
    setPending("learn");
    setLearnError(null);
    try {
      const data = await post<{ question: StoryPracticeQuestionView }>(
        `${experience.apiBase}/learn`,
        { questionId: question.id, confirmed: true },
        experience.label
      );
      setQuestion(experience.adaptQuestion(data.question));
      setConfirmLearn(false);
      setLearnError(null);
      if (usesModalReview) setReviewOpen(true);
      else setPanelTab("review");
    } catch (cause) {
      setLearnError(messageFrom(cause, "Learn could not be confirmed. Your draft is safe."));
    } finally {
      setPending(null);
    }
  }

  const attempt = question.latestAttempt;
  const answer = question.authorizedAnswer;
  const panelTabs: Array<{ id: QuestionPanelTab; label: string }> = [
    { id: "description", label: "Description" },
    { id: "hints", label: "Hints" },
    ...(usesModalReview ? [] : [{ id: "review" as const, label: "Review" }])
  ];

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[112rem] flex-col gap-2 xl:h-full">
      <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2.5 sm:px-4">
        <Link
          href={`${experience.routeBase}?block=${encodeURIComponent(block.id)}`}
          aria-label={`Back to ${experience.label} ${experience.subjectNoun}`}
          title={`Back to ${experience.subjectNoun}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-cream/48 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-cream sm:text-[17px]">
              {stageTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-cream/44">
              <span className="rounded-md bg-white/[0.045] px-2 py-1 capitalize">
                {block.selection.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.045] px-2 py-1">
                <Clock3 size={11} aria-hidden="true" /> {questionMinutes} min
              </span>
              <span className="rounded-md bg-white/[0.045] px-2 py-1 capitalize">
                {humanizeStoryPracticeKey(question.question.format)}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {usesModalReview && terminal && (attempt || answer) ? (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.045] px-3 text-[12.5px] font-semibold text-cream/68 transition hover:bg-white/[0.08] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
            >
              <Sparkles size={13} aria-hidden="true" className="text-[var(--workspace-accent)]" />
              Review answer
            </button>
          ) : null}
          {terminal ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--workspace-accent-soft)] px-3 text-[12.5px] font-semibold text-[var(--workspace-accent)]">
              <CheckCircle2 size={14} aria-hidden="true" />
              {question.status === "LEARNED" ? "Learned · zero mastery" : "Completed"}
            </span>
          ) : null}
          <QuestionLink
            blockId={block.id}
            question={next}
            direction="next"
            routeBase={experience.routeBase}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619] xl:h-full">
          <div
            role="tablist"
            aria-label={`${experience.label} question reference`}
            className="story-practice-tabs thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2"
          >
            {panelTabs.map((item) => {
              const selected = item.id === panelTab;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setPanelTab(item.id)}
                  className={`story-practice-tab relative h-10 shrink-0 rounded-t-lg px-3 text-[13px] font-semibold transition-colors ${selected ? "text-cream" : "text-cream/42 hover:bg-white/[0.035] hover:text-cream/72"}`}
                >
                  {item.label}
                  {item.id === "hints" ? (
                    <span className="ml-1.5 text-[11px] tabular-nums text-cream/34">
                      {question.revealedHints.length}/{question.question.hintCount}
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--workspace-accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {panelTab === "description" ? (
              <div className="space-y-7">
                <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111214] px-5 py-5 sm:px-6 sm:py-6">
                  <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
                    Question {question.order} of {block.questions.length} ·{" "}
                    {humanizeStoryPracticeKey(question.question.format)}
                  </p>
                  <h2 className="relative mt-3 max-w-[36rem] font-display text-[1.65rem] font-semibold leading-[1.15] tracking-[-0.035em] text-cream sm:text-[1.9rem]">
                    {stageTitle}
                  </h2>
                  <p className="relative mt-4 whitespace-pre-wrap text-[14.5px] leading-7 text-cream/66">
                    {question.question.prompt}
                  </p>
                  {question.question.revisionNote ? (
                    <p
                      role="note"
                      className="relative mt-4 rounded-lg border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] px-3 py-2 text-[12px] leading-5 text-cream/72"
                    >
                      {question.question.revisionNote}
                    </p>
                  ) : null}
                  <div className="relative mt-5 flex flex-wrap gap-1.5">
                    {question.question.topicKeys.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1 text-[10.5px] font-medium text-cream/42"
                      >
                        {humanizeStoryPracticeKey(topic)}
                      </span>
                    ))}
                  </div>
                </section>
                <Artifact question={question} />
                <section className="rounded-xl bg-black/20 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                    {capitalize(experience.subjectNoun)} context
                  </p>
                  <p className="mt-2 text-[13px] font-semibold leading-5 text-cream/72">
                    {block.story.title}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-5 text-cream/46">
                    {block.selection.reason}
                  </p>
                </section>
              </div>
            ) : null}

            {panelTab === "hints" ? (
              <section>
                <div className="flex items-center gap-2.5">
                  <Lightbulb
                    size={16}
                    aria-hidden="true"
                    className="text-[var(--workspace-accent)]"
                  />
                  <div>
                    <h2 className="text-[14px] font-semibold text-cream">Progressive hints</h2>
                    <p className="mt-0.5 text-[12.5px] text-cream/42">Reveal only what you need.</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-3" aria-label="Revealed hints">
                  {question.revealedHints.map((hint, index) => (
                    <li
                      key={`${index}:${hint}`}
                      className="fade-slide flex gap-3 rounded-xl bg-white/[0.035] p-4"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-[12px] font-semibold text-[var(--workspace-accent)]">
                        {index + 1}
                      </span>
                      <p className="text-[14px] leading-6 text-cream/72">{hint}</p>
                    </li>
                  ))}
                </ol>
                {!mutable && question.revealedHints.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-4">
                    <p className="text-[13px] leading-6 text-cream/52">
                      No hints were opened before this question was completed. The full reasoning is
                      available in the answer debrief.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        usesModalReview ? setReviewOpen(true) : setPanelTab("review")
                      }
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-white/[0.055] px-3 text-[12.5px] font-semibold text-cream/72 transition hover:bg-white/[0.085] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
                    >
                      Open answer debrief
                    </button>
                  </div>
                ) : null}
                {mutable && question.revealedHints.length < question.question.hintCount ? (
                  <button
                    type="button"
                    onClick={() => void revealHint()}
                    disabled={pending !== null}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[13px] font-semibold text-cream/72 transition hover:bg-white/[0.065] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] disabled:opacity-55"
                  >
                    {pending === "hint" ? (
                      <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      <Lightbulb size={14} aria-hidden="true" />
                    )}
                    Reveal hint {question.revealedHints.length + 1} of {question.question.hintCount}
                  </button>
                ) : null}
              </section>
            ) : null}

            {panelTab === "review" && !usesModalReview ? (
              <div className="space-y-4">
                <ReviewContext question={question} stageTitle={stageTitle} />
                {attempt ? <Feedback question={question} experience={experience} /> : null}
                {answer ? <AuthorizedAnswer question={question} /> : null}
                {!attempt && !answer ? (
                  <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-5">
                    <FileText size={17} className="text-cream/38" aria-hidden="true" />
                    <h2 className="mt-4 text-[14px] font-semibold text-cream/78">
                      Review unlocks after your attempt
                    </h2>
                    <p className="mt-2 text-[13px] leading-6 text-cream/46">
                      Submit your answer or explicitly Learn to see concise feedback and the
                      interview connection.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101214] xl:h-full">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[#141619] px-3 py-2 sm:px-4">
            <p className="truncate text-[13.5px] font-semibold text-cream/38">
              Question {question.order} of {block.questions.length} · {block.story.title}
            </p>
            {mutable ? (
              <span role="status" className="text-[11px] text-cream/38">
                {draftState === "saving"
                  ? "Saving draft…"
                  : draftState === "unsaved"
                    ? "Draft not saved"
                    : "Draft saved"}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-cream/88">
              {workKind === "code" ? (
                <Code2 size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
              ) : (
                <FileText size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
              )}
              <h2 id="your-response-heading">
                {terminal
                  ? "Your submitted answer"
                  : workKind === "code"
                    ? responseLabel(question.question.format)
                    : "Answer workspace"}
              </h2>
            </div>
            {workKind === "code" && experience.capabilities.runCode ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] font-medium text-cream/36 sm:inline">
                  {experience.environmentLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCode(starterCodeForEditor(question));
                    setRun(null);
                    setTestCasesOpen(false);
                  }}
                  disabled={!mutable || pending === "run"}
                  aria-label="Reset starter code"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-cream/48 transition hover:bg-white/[0.085] hover:text-cream disabled:opacity-40"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void runCode()}
                  disabled={!mutable || pending === "run" || !code.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cream px-3.5 text-[12.5px] font-semibold text-[#171a16] transition hover:bg-white disabled:opacity-45"
                >
                  {pending === "run" ? (
                    <Loader2 size={13} className="motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Play size={13} aria-hidden="true" />
                  )}
                  {pending === "run" ? "Running" : "Run code"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {interaction && interactive ? (
              <div className="p-4 sm:p-5">
                <InteractiveAnswerInput
                  interaction={interaction}
                  response={interactive}
                  disabled={!mutable || pending !== null}
                  onChange={(value) => {
                    setInteractive(value);
                    setError(null);
                  }}
                />
              </div>
            ) : workKind === "choice" ? (
              <div className="p-4 sm:p-5">
                <ResponseIntro format={question.question.format} experience={experience} />
                <ChoiceInput
                  choices={question.question.choices ?? []}
                  selected={choice}
                  disabled={!mutable || pending !== null}
                  name={`${experience.slug}-choice`}
                  onChange={setChoice}
                />
              </div>
            ) : workKind === "code" ? (
              <CodeInput
                code={code}
                disabled={!mutable}
                ariaLabel={`${experience.label} JavaScript editor`}
                onChange={(value) => {
                  setCode(value);
                  setError(null);
                  if (run?.code !== value) {
                    setRun(null);
                    setTestCasesOpen(false);
                  }
                }}
                onRun={() => void runCode()}
              />
            ) : (
              <div className="p-4 sm:p-5">
                {responseTool}
                <ResponseIntro format={question.question.format} experience={experience} />
                <TextInput
                  value={text}
                  spoken={question.question.format === "spoken"}
                  structuredPrompts={answerPrompts}
                  disabled={!mutable || pending !== null}
                  placeholder={experience.textAnswerPlaceholder}
                  onChange={setText}
                />
              </div>
            )}
          </div>

          {workKind === "code" ? (
            <div
              className={`flex min-h-11 shrink-0 items-center border-t px-4 text-sm leading-5 sm:px-5 ${
                error
                  ? "border-[#e3a15b]/20 bg-[#e3a15b]/10 text-[#e7bd83]"
                  : "border-white/[0.07] bg-black/10 text-cream/46"
              }`}
              role={error ? "alert" : "status"}
              aria-live="polite"
            >
              {error ? (
                error
              ) : pending === "run" ? (
                <span className="inline-flex items-center gap-2 text-cream/68">
                  <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
                  Running your code against the test cases…
                </span>
              ) : run?.result.accepted ? (
                "All tests pass. You can submit this solution."
              ) : run ? (
                "Some tests failed. Fix the code, then run it again."
              ) : (
                "Edit the starter code, run the tests, then submit after they pass."
              )}
            </div>
          ) : error ? (
            <p
              role="alert"
              className="mx-4 mb-4 rounded-lg border border-[#e3a15b]/20 bg-[#e3a15b]/10 px-4 py-3 text-sm leading-5 text-[#e7bd83] sm:mx-5"
            >
              {error}
            </p>
          ) : null}

          {workKind === "code" && testCasesOpen ? (
            <div className="thin-scroll max-h-[16rem] shrink-0 overflow-y-auto border-t border-white/[0.07] bg-black/10 px-4 py-4 sm:px-5">
              {run ? (
                <RunResult run={run} />
              ) : (
                <p className="text-sm text-cream/46">
                  {pending === "run"
                    ? "The test results will appear here when the run finishes."
                    : "No test result is available yet."}
                </p>
              )}
            </div>
          ) : null}

          {workKind === "code" ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] bg-[#141619] px-3 py-2 sm:px-4">
              <button
                type="button"
                onClick={() => setTestCasesOpen((open) => !open)}
                aria-expanded={testCasesOpen}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.05] hover:text-cream"
              >
                <FlaskConical size={13} aria-hidden="true" />
                Test cases
                {run ? (
                  <>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${run.result.accepted ? "bg-[var(--workspace-accent)]" : "bg-[#ff8f8f]"}`}
                    />
                    <span
                      className={`font-mono text-[12px] tabular-nums ${run.result.accepted ? "text-cream/72" : "text-[#ff8f8f]"}`}
                    >
                      {run.result.publicTests.filter(({ passed }) => passed).length}/
                      {run.result.publicTests.length}
                    </span>
                    <span className="text-[11.5px] text-cream/38">
                      · {run.result.hiddenTests.total} hidden
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-normal text-cream/38">
                    · {(question.question as { publicTests?: unknown[] }).publicTests?.length ?? 0}{" "}
                    visible + hidden checks
                  </span>
                )}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform ${testCasesOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ) : null}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-[#141619] px-3 py-2 sm:px-4">
            <nav
              className="flex items-center gap-1"
              aria-label={`${experience.label} question navigation`}
            >
              <QuestionLink
                blockId={block.id}
                question={previous}
                direction="previous"
                routeBase={experience.routeBase}
              />
            </nav>
            {mutable ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLearnError(null);
                    setConfirmLearn(true);
                  }}
                  disabled={pending !== null}
                  aria-expanded={confirmLearn}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.09] hover:text-cream disabled:opacity-55"
                >
                  <SkipForward size={13} aria-hidden="true" />
                  Learn instead
                </button>
                <button
                  type="button"
                  onClick={() => void submitAttempt()}
                  disabled={pending !== null}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cream px-3.5 text-[12.5px] font-semibold text-[#17181a] transition hover:bg-white disabled:cursor-wait disabled:opacity-55"
                >
                  {pending === "attempt" ? (
                    <Loader2 size={13} className="motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Check size={13} aria-hidden="true" />
                  )}
                  {pending === "attempt" ? "Evaluating…" : "Submit answer"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <LearnConfirmationModal
        open={confirmLearn && mutable}
        codeQuestion={workKind === "code"}
        pending={pending === "learn"}
        error={learnError}
        onCancel={() => {
          setLearnError(null);
          setConfirmLearn(false);
        }}
        onConfirm={() => void learn()}
      />

      {usesModalReview ? (
        <StoryPracticeReviewModal
          open={reviewOpen}
          question={question}
          stageTitle={stageTitle}
          experience={experience}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </section>
  );
}

function LearnConfirmationModal({
  open,
  codeQuestion,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  codeQuestion: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => setPortalRoot(document.body), []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, open, pending]);

  if (!open || !portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[max(1rem,8vh)] sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-black/70 backdrop-blur-[3px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="learn-confirmation-title"
        className="relative w-full max-w-[34rem] overflow-hidden rounded-2xl border border-[#e3a15b]/30 bg-[#171614] shadow-[0_30px_100px_rgba(0,0,0,0.7)]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e3a15b]/80 to-transparent" />
        <div className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e3a15b]/25 bg-[#e3a15b]/10 text-[#efb978]">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#efb978]">
                Learning mode
              </p>
              <h2
                id="learn-confirmation-title"
                className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.03em] text-cream"
              >
                Reveal the guided answer?
              </h2>
              <p className="mt-3 text-sm leading-6 text-cream/62">
                This reveals the guided answer and unlocks progress, but contributes zero Practice
                mastery. The question will be recorded as Learned rather than solved.
              </p>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-[#e3a15b]/20 bg-[#e3a15b]/[0.07] px-4 py-3 text-sm leading-5 text-[#efc38d]"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              autoFocus
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-4 text-sm font-semibold text-cream/68 transition hover:bg-white/[0.08] hover:text-cream disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#17181a] transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
              ) : null}
              {pending
                ? "Opening guide…"
                : codeQuestion
                  ? "Reveal answer and continue"
                  : "Confirm Learn"}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    portalRoot
  );
}

function Artifact({
  question,
  comfortable = false
}: {
  question: StoryPracticeQuestionView;
  comfortable?: boolean;
}) {
  return <StoryPracticeArtifact artifact={question.question.artifact} comfortable={comfortable} />;
}

function ChoiceInput({
  choices,
  selected,
  disabled,
  name,
  onChange
}: {
  choices: string[];
  selected: number | null;
  disabled: boolean;
  name: string;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="grid gap-2.5" disabled={disabled}>
      <legend className="sr-only">Choose one answer</legend>
      {choices.map((option, index) => (
        <label
          key={`${index}:${option}`}
          className={`group flex min-h-[4.25rem] cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3.5 text-[13.5px] leading-5 transition duration-200 ${selected === index ? "border-[var(--workspace-accent-border)] bg-[linear-gradient(110deg,var(--workspace-accent-soft),rgba(255,255,255,0.025))] text-cream/88 shadow-[inset_3px_0_0_var(--workspace-accent)]" : "border-white/[0.075] bg-[#111214] text-cream/60 hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-white/[0.035] hover:text-cream/82"}`}
        >
          <input
            type="radio"
            name={name}
            checked={selected === index}
            onChange={() => onChange(index)}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[11px] font-semibold transition ${selected === index ? "border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]" : "border-white/[0.07] bg-white/[0.035] text-cream/34 group-hover:text-cream/62"}`}
          >
            {String.fromCharCode(65 + index)}
          </span>
          <span className="min-w-0 flex-1">{option}</span>
          {selected === index ? (
            <CheckCircle2
              size={16}
              aria-hidden="true"
              className="shrink-0 text-[var(--workspace-accent)]"
            />
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

function TextInput({
  value,
  spoken,
  structuredPrompts,
  disabled,
  placeholder,
  onChange
}: {
  value: string;
  spoken: boolean;
  structuredPrompts: readonly StructuredAnswerPrompt[];
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [ghost, setGhost] = useState<{ prompt: string; anchor: number; suggestion: string } | null>(
    null
  );
  const [ghostText, setGhostText] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 224), 420)}px`;
  }, [value]);

  useEffect(() => {
    if (!ghost) {
      setGhostText("");
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setGhostText(ghost.suggestion);
      return;
    }
    let length = 0;
    setGhostText("");
    const timer = window.setInterval(() => {
      length += 1;
      setGhostText(ghost.suggestion.slice(0, length));
      if (length >= ghost.suggestion.length) window.clearInterval(timer);
    }, 14);
    return () => window.clearInterval(timer);
  }, [ghost]);

  function addPrompt(prompt: StructuredAnswerPrompt) {
    const textarea = textareaRef.current;
    const heading = `${prompt.label}:\n`;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const separator = before.trimEnd() ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const after = value.slice(end);
    const trailingSeparator = after.trim() ? "\n" : "";
    const next = `${before}${separator}${heading}${trailingSeparator}${after}`;
    const cursor = start + separator.length + heading.length;
    setGhost({ prompt: prompt.label, anchor: cursor, suggestion: prompt.suggestion });
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="max-w-[52rem]">
      {spoken ? (
        <p className="mb-2 text-[12px] leading-5 text-cream/42">
          Say your answer aloud, then type the evidence you want assessed.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-white/[0.085] bg-[#0d0f10] shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
        {structuredPrompts.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cream/30">
              Add a prompt
            </span>
            {structuredPrompts.map((prompt) => {
              const alreadyAdded = hasStructuredPrompt(value, prompt.label);
              return (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => addPrompt(prompt)}
                  disabled={disabled || alreadyAdded}
                  aria-label={alreadyAdded ? `${prompt.label} prompt added` : undefined}
                  className="rounded-md border border-white/[0.065] bg-white/[0.035] px-2 py-1 text-[10.5px] font-medium text-cream/48 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-cream/76 disabled:cursor-not-allowed disabled:border-white/[0.045] disabled:bg-white/[0.02] disabled:text-cream/28"
                >
                  {alreadyAdded ? (
                    <Check size={10} aria-hidden="true" className="mr-1 inline" />
                  ) : (
                    "+ "
                  )}
                  {prompt.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="relative">
          <textarea
            ref={textareaRef}
            aria-label={spoken ? "Spoken answer transcript" : "Written answer"}
            value={value}
            onChange={(event) => {
              setGhost(null);
              onChange(event.target.value);
            }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            disabled={disabled}
            maxLength={12_000}
            rows={8}
            className={`block min-h-56 max-h-[26.25rem] w-full resize-none overflow-y-auto bg-transparent px-4 py-4 text-[14px] leading-7 caret-cream outline-none placeholder:text-cream/24 disabled:opacity-65 ${structuredPrompts.length && value ? "text-transparent" : "text-cream"}`}
            placeholder={placeholder}
          />
          {structuredPrompts.length && value ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-4 text-[14px] leading-7"
            >
              <div
                className="whitespace-pre-wrap break-words text-cream"
                style={{ transform: `translateY(-${scrollTop}px)` }}
              >
                {ghost ? (
                  <>
                    <StyledAnswerText
                      value={value.slice(0, ghost.anchor)}
                      prompts={structuredPrompts}
                    />
                    <span className="text-cream/25">{ghostText}</span>
                    <StyledAnswerText
                      value={value.slice(ghost.anchor)}
                      prompts={structuredPrompts}
                    />
                  </>
                ) : (
                  <StyledAnswerText value={value} prompts={structuredPrompts} />
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex min-h-10 items-center justify-between border-t border-white/[0.055] px-3 sm:px-4">
          <p className="text-[11px] text-cream/30">
            {structuredPrompts.length
              ? "Use only the prompts that help your explanation."
              : "Your draft saves automatically."}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-cream/28">{value.length}/12000</p>
        </div>
      </div>
    </div>
  );
}

function StyledAnswerText({
  value,
  prompts
}: {
  value: string;
  prompts: readonly StructuredAnswerPrompt[];
}) {
  const lines = value.split("\n");
  return lines.map((line, index) => (
    <span key={`${index}:${line}`}>
      {isStructuredPromptLine(line, prompts) ? (
        <span className="font-semibold text-cream/90 underline decoration-[var(--workspace-accent)] decoration-1 underline-offset-[5px]">
          {line}
        </span>
      ) : (
        line
      )}
      {index < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function isStructuredPromptLine(line: string, prompts: readonly StructuredAnswerPrompt[]): boolean {
  return prompts.some(({ label }) => new RegExp(`^${escapeRegex(label)}:\\s*$`, "i").test(line));
}

function hasStructuredPrompt(value: string, prompt: string): boolean {
  return new RegExp(`^${escapeRegex(prompt)}:\\s*$`, "im").test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ResponseIntro({
  format,
  experience
}: {
  format: StoryPracticeQuestionView["question"]["format"];
  experience: StoryPracticeWorkspaceExperience;
}) {
  const guidance = experience.responseGuidance(format) ?? responseGuidance(format);
  return (
    <div className="mb-5 border-b border-white/[0.06] pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
        Your response
      </p>
      <h3 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-cream sm:text-[1.65rem]">
        {experience.responseLabel(format) ?? responseLabel(format)}
      </h3>
      <p className="mt-2 max-w-[42rem] text-sm leading-6 text-cream/46">{guidance}</p>
    </div>
  );
}

function CodeInput({
  code,
  disabled,
  ariaLabel,
  onChange,
  onRun
}: {
  code: string;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  return (
    <div className="h-[32rem] min-h-0 overflow-hidden bg-[#0b0d10] sm:h-[38rem] xl:h-full">
      <DsaCodeEditor
        language="javascript"
        value={code}
        onChange={onChange}
        onRun={onRun}
        readOnly={disabled}
        autoFocus={false}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

function RunResult({ run }: { run: LocalRun }) {
  const result = run.result;
  return (
    <section aria-label="Code run result" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-cream">Test results</h3>
          <p className="mt-0.5 text-[13px] leading-5 text-cream/45">
            Public cases are shown; hidden inputs stay private.
          </p>
        </div>
        <p
          role="status"
          className={`flex items-center gap-2 text-[13px] font-semibold ${result.accepted ? "text-cream" : "text-[#ffb4b4]"}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${result.accepted ? "bg-[var(--workspace-accent)]" : "bg-[#ff8f8f]"}`}
          />
          {result.accepted ? "All tests accepted" : humanizeStoryPracticeKey(result.status)}
        </p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.publicTests.map((test) => (
          <li key={test.name} className="practice-glass-soft rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-cream/75">{test.name}</span>
              <span
                className={`inline-flex items-center gap-1 text-[13px] font-semibold ${test.passed ? "text-cream" : "text-[#ffb4b4]"}`}
              >
                {test.passed ? (
                  <CheckCircle2 size={13} aria-hidden="true" />
                ) : (
                  <XCircle size={13} aria-hidden="true" />
                )}
                {test.passed ? "Passed" : "Failed"}
              </span>
            </div>
            <dl className="mt-3 grid gap-x-3 gap-y-1.5 font-mono text-[12px] leading-5 sm:grid-cols-[4.5rem_1fr]">
              <dt className="text-cream/35">Input</dt>
              <dd className="break-words text-cream/65">{test.input}</dd>
              <dt className="text-cream/35">Expected</dt>
              <dd className="break-words text-cream/65">{test.expected}</dd>
            </dl>
            {test.diagnostic ? (
              <p className="mt-2 text-[12px] leading-5 text-[#ffb4b4]">{test.diagnostic}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-cream/45">
        Hidden tests: {result.hiddenTests.passed}/{result.hiddenTests.total} ·{" "}
        {Math.round(result.durationMs)} ms
        {result.peakMemoryMb !== null ? ` · ${Math.round(result.peakMemoryMb)} MB` : ""}
      </p>
      {result.diagnostic ? (
        <p className="mt-2 text-[12px] leading-5 text-[#ffb4b4]">{result.diagnostic}</p>
      ) : null}
    </section>
  );
}

function Feedback({
  question,
  experience
}: {
  question: StoryPracticeQuestionView;
  experience: StoryPracticeWorkspaceExperience;
}) {
  const attempt = question.latestAttempt!;
  const score = attempt.score ?? attempt.feedback.score;
  const verdict =
    score >= 8
      ? "Strong answer"
      : score >= 5
        ? "Partially correct"
        : score > 0
          ? "Needs work"
          : "Incorrect";
  return (
    <section
      className="rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] px-5 py-5"
      aria-labelledby="attempt-feedback-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Answer review
      </p>
      <h2
        id="attempt-feedback-heading"
        className="mt-2 font-display text-[1.3rem] font-semibold text-cream"
      >
        {verdict} · {score}/10
      </h2>
      <p className="mt-2 text-[13px] leading-6 text-cream/58">{attempt.feedback.result}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <FeedbackItem label="What worked" value={attempt.feedback.didWell} />
        <FeedbackItem label="What to improve" value={attempt.feedback.missingOrIncorrect} />
        <FeedbackItem
          label={experience.feedbackReasoningLabel}
          value={attempt.feedback.mechanism}
        />
        <FeedbackItem
          label="Production consequence"
          value={attempt.feedback.productionConsequence}
        />
      </dl>
      {question.question.interviewConnection ? (
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <h3 className="text-[12px] font-semibold text-cream/72">Interview connection</h3>
          <p className="mt-2 text-[13px] leading-6 text-cream/54">
            {question.question.interviewConnection}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function FeedbackItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.11em] text-cream/34">
        {label}
      </dt>
      <dd className="mt-1.5 text-[12.5px] leading-5 text-cream/58">{value}</dd>
    </div>
  );
}

function AuthorizedAnswer({ question }: { question: StoryPracticeQuestionView }) {
  const answer = question.authorizedAnswer!;
  return (
    <details open className="rounded-xl border border-white/[0.075] bg-[#111214] px-4 py-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-cream/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]">
        Correct answer and explanation
      </summary>
      <p className="mt-4 text-[13px] leading-6 text-cream/64">{answer.concise}</p>
      <p className="mt-3 text-[12.5px] leading-6 text-cream/48">{answer.explanation}</p>
      {answer.learningGuide ? <StoryPracticeLearningGuide guide={answer.learningGuide} /> : null}
      {answer.referenceSolution ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.075] bg-[#0b0d10]">
          <div className="flex h-10 items-center justify-between border-b border-white/[0.065] bg-[#15181d] px-3.5">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-cream/58">
              <Code2 size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
              Reference solution
            </span>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-cream/28">
              JavaScript · read only
            </span>
          </div>
          <PracticeCodeViewer
            code={answer.referenceSolution}
            language={question.question.artifact.language ?? "javascript"}
            maxLines={18}
            ariaLabel="Reference solution code, read only"
            embedded
          />
        </div>
      ) : null}
    </details>
  );
}

function StoryPracticeReviewModal({
  open,
  question,
  stageTitle,
  experience,
  onClose
}: {
  open: boolean;
  question: StoryPracticeQuestionView;
  stageTitle: string;
  experience: StoryPracticeWorkspaceExperience;
  onClose: () => void;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const attempt = question.latestAttempt;
  const answer = question.authorizedAnswer;

  useEffect(() => setPortalRoot(document.body), []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  if (!open || !portalRoot || (!attempt && !answer)) return null;

  const score = attempt?.score ?? attempt?.feedback.score ?? 0;
  const verdict = !attempt
    ? "Learning review"
    : score >= 8
      ? "Strong answer"
      : score >= 5
        ? "Partially correct"
        : score > 0
          ? "Needs work"
          : "Incorrect";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="presentation"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/75 backdrop-blur-[3px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-review-title"
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[58rem] flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.11] bg-[#141719] shadow-[0_32px_120px_rgba(0,0,0,0.68)]"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-white/[0.075] bg-[#0c0e0f] px-5 py-4 sm:px-6 sm:py-5">
          <div className="practice-accent-glow pointer-events-none absolute inset-x-[15%] bottom-[-120%] h-[180%] opacity-55" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-cream/42">
                <span className="text-[var(--workspace-accent)]">Answer debrief</span>
                <span aria-hidden="true">·</span>
                <span>{experience.label}</span>
              </div>
              <h2
                id="story-review-title"
                className="mt-2 font-display text-[1.55rem] font-semibold leading-tight tracking-[-0.035em] text-cream sm:text-[1.9rem]"
              >
                {verdict}
                {attempt ? ` · ${score}/10` : ""}
              </h2>
              <p className="mt-2 max-w-[48rem] text-sm leading-6 text-cream/60">
                {attempt?.feedback.result ?? `Review the reasoning behind ${stageTitle}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close answer review"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.055] text-cream/56 transition hover:bg-white/[0.1] hover:text-cream"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
          {attempt ? (
            <section
              className="grid gap-5 border-b border-white/[0.07] py-5 sm:grid-cols-2 sm:gap-0"
              aria-label="Answer feedback"
            >
              <div className="sm:pr-6">
                <ReviewInsight
                  label="What you understood"
                  value={attempt.feedback.didWell}
                  tone="positive"
                />
              </div>
              <div className="sm:border-l sm:border-white/[0.07] sm:pl-6">
                <ReviewInsight
                  label="What went wrong"
                  value={attempt.feedback.missingOrIncorrect}
                  tone="corrective"
                />
              </div>
            </section>
          ) : null}

          <section className="border-b border-white/[0.07] py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--workspace-accent)]">
                  {question.question.artifact.kind === "code"
                    ? "Question and code"
                    : "Question and evidence"}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-cream/82">{stageTitle}</h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/34">
                Read only
              </span>
            </div>
            <div
              className={`mt-4 grid gap-5 ${attempt ? "lg:grid-cols-2 lg:gap-0" : "grid-cols-1"}`}
            >
              <div className={`min-w-0 ${attempt ? "lg:pr-6" : ""}`}>
                <Artifact question={question} comfortable />
              </div>
              {attempt ? (
                <div className="space-y-5 lg:border-l lg:border-white/[0.07] lg:pl-6">
                  <>
                    <ReviewDetail
                      label={experience.feedbackReasoningLabel}
                      value={attempt.feedback.mechanism}
                    />
                    <ReviewDetail
                      label="Why this matters"
                      value={attempt.feedback.productionConsequence}
                    />
                  </>
                </div>
              ) : null}
            </div>
          </section>

          {answer ? (
            <section className="border-b border-white/[0.07] py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--workspace-accent)]">
                Strong interview answer
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-cream/86">{answer.concise}</p>
              <p className="mt-2 text-sm leading-6 text-cream/58">{answer.explanation}</p>
              {answer.referenceSolution ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b0d10]">
                  <PracticeCodeViewer
                    code={readableCode(answer.referenceSolution)}
                    language={question.question.artifact.language ?? "javascript"}
                    maxLines={16}
                    ariaLabel="Strong interview answer reference code"
                    embedded
                  />
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </aside>
    </div>,
    portalRoot
  );
}

function ReviewInsight({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "positive" | "corrective";
}) {
  return (
    <article>
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${tone === "positive" ? "bg-[var(--workspace-accent)]" : "bg-[#e3a15b]"}`}
        />
        <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-cream/42">{label}</h3>
      </div>
      <p className="mt-2.5 text-sm leading-6 text-cream/66">{value}</p>
    </article>
  );
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.1em] text-cream/42">{label}</p>
      <p className="mt-2 text-sm leading-6 text-cream/62">{value}</p>
    </div>
  );
}

function ReviewContext({
  question,
  stageTitle
}: {
  question: StoryPracticeQuestionView;
  stageTitle: string;
}) {
  return (
    <section className="rounded-[1.15rem] border border-white/[0.075] bg-[#111214] px-5 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Question reviewed
      </p>
      <h2 className="mt-2 font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-cream">
        {stageTitle}
      </h2>
      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-6 text-cream/62">
        {question.question.prompt}
      </p>
      <div className="mt-5 border-t border-white/[0.06] pt-5">
        <Artifact question={question} />
      </div>
    </section>
  );
}

function QuestionLink({
  blockId,
  question,
  direction,
  routeBase
}: {
  blockId: string;
  question: Pick<StoryPracticeQuestionView, "id" | "order"> | null;
  direction: "previous" | "next";
  routeBase: string;
}) {
  const label = direction === "previous" ? "Previous" : "Next question";
  if (!question)
    return (
      <span className="inline-flex h-9 items-center px-3 text-[12px] text-cream/24">{label}</span>
    );
  return (
    <Link
      href={`${routeBase}/questions/${encodeURIComponent(question.id)}?block=${encodeURIComponent(blockId)}`}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.04] px-3 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.075] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
    >
      {direction === "previous" ? <ArrowLeft size={13} aria-hidden="true" /> : null}
      {label}
      {direction === "next" ? <ArrowRight size={13} aria-hidden="true" /> : null}
    </Link>
  );
}

function initialChoice(question: StoryPracticeQuestionView): number | null {
  const work = question.draft ?? question.latestAttempt?.work;
  return work?.kind === "choice" ? work.selectedChoiceIndex : null;
}

function initialText(question: StoryPracticeQuestionView): string {
  const work = question.draft ?? question.latestAttempt?.work;
  return work?.kind === "text" ? work.text : "";
}

function initialCode(question: StoryPracticeQuestionView): string {
  const work = question.draft ?? question.latestAttempt?.work;
  if (work?.kind === "code") return work.code;
  return question.latestRun?.code ?? starterCodeForEditor(question);
}

function starterCodeForEditor(question: StoryPracticeQuestionView): string {
  const starter = question.question.starterCode ?? "";
  if (!starter || starter.includes("\n")) return starter;

  const artifact = question.question.artifact;
  if (
    artifact.kind === "code" &&
    artifact.content.includes("\n") &&
    withoutFormatting(artifact.content) === withoutFormatting(starter)
  ) {
    return artifact.content;
  }

  return expandCompactCode(starter);
}

function withoutFormatting(value: string): string {
  return value.replace(/\s+/g, "");
}

function readableCode(value: string): string {
  return value.includes("\n") ? value : expandCompactCode(value);
}

/** Formats legacy one-line starter code without changing its tokens. */
function expandCompactCode(source: string): string {
  const lines: string[] = [];
  let current = "";
  let indent = 0;
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;

  const pushLine = () => {
    const content = current.trim();
    if (content) lines.push(`${"  ".repeat(indent)}${content}`);
    current = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quote) {
      current += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "{") {
      current = `${current.trimEnd()} {`;
      pushLine();
      indent += 1;
      continue;
    }
    if (character === "}") {
      pushLine();
      indent = Math.max(0, indent - 1);
      current = "}";
      const next = source.slice(index + 1).trimStart()[0];
      if (next !== ";" && next !== "," && next !== ")" && next !== "]") pushLine();
      continue;
    }
    if (character === ";") {
      current += character;
      pushLine();
      continue;
    }
    current += character;
  }
  pushLine();
  return lines.join("\n");
}

function initialRun(question: StoryPracticeQuestionView): LocalRun | null {
  const run = question.latestRun;
  return run ? { id: run.id, code: run.code, result: run.result, createdAt: run.createdAt } : null;
}

function draftFor(
  kind: ReturnType<typeof storyPracticeQuestionWorkKind>,
  choice: number | null,
  text: string,
  code: string,
  interactive: InteractiveResponse | null
): StoryPracticeDraftWork | null {
  if (kind === "interactive")
    return interactive ? { kind: "interactive", response: interactive } : null;
  if (kind === "choice")
    return choice === null ? null : { kind: "choice", selectedChoiceIndex: choice };
  if (kind === "code") return code.trim() ? { kind: "code", code } : null;
  return text.trim() ? { kind: "text", text } : null;
}

function attemptFor(
  kind: ReturnType<typeof storyPracticeQuestionWorkKind>,
  choice: number | null,
  text: string,
  code: string,
  run: LocalRun | null,
  interactive: InteractiveResponse | null
): StoryPracticeAttemptWork | null {
  if (kind === "interactive")
    return interactive ? { kind: "interactive", response: interactive } : null;
  if (kind === "choice")
    return choice === null ? null : { kind: "choice", selectedChoiceIndex: choice };
  if (kind === "code") return run ? { kind: "code", code, runId: run.id } : null;
  return text.trim() ? { kind: "text", text } : null;
}

function validateAttempt(
  kind: ReturnType<typeof storyPracticeQuestionWorkKind>,
  work: StoryPracticeAttemptWork | null,
  code: string,
  run: LocalRun | null
): string | null {
  if (!work)
    return kind === "code"
      ? "Run this exact code before submitting it."
      : "Add a complete answer before submitting.";
  if (work.kind === "text" && work.text.trim().length < 8)
    return "Write at least 8 characters so the response can be assessed.";
  if (kind === "code" && (!run?.result.accepted || run.code !== code))
    return "Pass all tests with this exact code before submitting it.";
  return null;
}

function responseLabel(format: StoryPracticeQuestionView["question"]["format"]): string {
  switch (format) {
    case "mcq":
      return "Choose the strongest explanation";
    case "spoken":
      return "Speak, then capture your answer";
    case "debug-repair":
      return "Repair the implementation";
    case "micro-implementation":
      return "Implement the missing behavior";
    case "predict-explain":
      return "Predict and explain";
    case "artifact-diagnosis":
      return "Diagnose the evidence";
    case "production-decision":
      return "Make the production decision";
    case "written":
      return "Write your reasoning";
    default:
      return assertNever(format);
  }
}

function responseGuidance(format: StoryPracticeQuestionView["question"]["format"]): string {
  switch (format) {
    case "mcq":
      return "Choose the explanation that best accounts for the evidence, not merely the observed symptom.";
    case "predict-explain":
      return "State the outcome first, then connect each step to the runtime mechanism that causes it.";
    case "written":
      return "Build a concise causal chain: mechanism, evidence, production consequence, and repair.";
    case "spoken":
      return "Answer aloud as you would in the interview, then capture the important evidence for assessment.";
    case "artifact-diagnosis":
      return "Cite concrete lines from the artifact, isolate the root cause, and explain why the obvious workaround fails.";
    case "production-decision":
      return "Make one defensible decision and cover its trade-off, rollout boundary, and verification signal.";
    case "debug-repair":
    case "micro-implementation":
      return "Use the executable workspace and prove the exact submitted code against the test contract.";
    default:
      return assertNever(format);
  }
}

async function post<T>(url: string, body: unknown, experienceLabel: string): Promise<T> {
  const response = await workspaceMutationFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(
      payload?.error?.message ?? `This ${experienceLabel} action could not be completed.`
    );
  }
  return payload.data;
}

function replaySafeRequestId(key: string, signature: string): string {
  const raw = window.sessionStorage.getItem(key);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as { signature?: unknown; requestId?: unknown };
      if (saved.signature === signature && typeof saved.requestId === "string")
        return saved.requestId;
    } catch {
      // Replace malformed browser state with a fresh, server-valid request ID.
    }
  }
  const requestId = crypto.randomUUID();
  window.sessionStorage.setItem(key, JSON.stringify({ signature, requestId }));
  return requestId;
}

function clearReplayRequest(key: string) {
  window.sessionStorage.removeItem(key);
}

function messageFrom(cause: unknown, fallback: string): string {
  if (cause instanceof TypeError && /fetch|network/i.test(cause.message)) return fallback;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled story-practice question format: ${String(value)}`);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
