"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DsaCodeEditor } from "@/components/interview/dsa/dsa-code-editor";
import { StoryPracticeArtifact, type StoryPracticeArtifactData } from "@/components/workspace/shared/story-practice-artifact";
import {
  coreTechnicalQuestionMinutes,
  coreTechnicalQuestionWorkKind,
  humanizeCoreTechnicalKey
} from "@/lib/practice/core-technical/ui-state";
import type {
  CoreTechnicalDraftWork,
  CoreTechnicalAttemptWork
} from "@/lib/practice/core-technical/practice-contracts";
import type {
  CoreTechnicalPublicBlock,
  CoreTechnicalPublicQuestion
} from "@/server/core-technical/practice.service";

type PendingAction = "hint" | "run" | "attempt" | "learn" | null;
type QuestionPanelTab = "description" | "hints" | "review";
type LocalRun = {
  id: string;
  code: string;
  result: NonNullable<CoreTechnicalPublicQuestion["latestRun"]>["result"];
  createdAt: string;
};

export type StoryPracticeWorkspaceExperience = {
  slug: string;
  label: string;
  apiBase: string;
  routeBase: string;
  subjectNoun: string;
  adaptQuestion: (question: unknown) => CoreTechnicalPublicQuestion;
};

const CORE_TECHNICAL_EXPERIENCE: StoryPracticeWorkspaceExperience = {
  slug: "core-technical",
  label: "Core Technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "story",
  adaptQuestion: (question) => question as CoreTechnicalPublicQuestion
};

export function CoreTechnicalQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle,
  experience = CORE_TECHNICAL_EXPERIENCE
}: {
  block: CoreTechnicalPublicBlock;
  initialQuestion: CoreTechnicalPublicQuestion;
  stageTitle: string;
  experience?: StoryPracticeWorkspaceExperience;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const workKind = coreTechnicalQuestionWorkKind(question.question.format);
  const [choice, setChoice] = useState<number | null>(() => initialChoice(initialQuestion));
  const [text, setText] = useState(() => initialText(initialQuestion));
  const [code, setCode] = useState(() => initialCode(initialQuestion));
  const [run, setRun] = useState<LocalRun | null>(() => initialRun(initialQuestion));
  const [pending, setPending] = useState<PendingAction>(null);
  const [draftState, setDraftState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);
  const [confirmLearn, setConfirmLearn] = useState(false);
  const [panelTab, setPanelTab] = useState<QuestionPanelTab>(() =>
    initialQuestion.status === "ACTIVE" ? "description" : "review"
  );
  const [testCasesOpen, setTestCasesOpen] = useState(() => initialQuestion.latestRun !== null);
  const initialDraft = useRef(JSON.stringify(draftFor(workKind, choice, text, code)));
  const draftSequence = useRef(0);
  const mutable = block.isCurrent && question.status === "ACTIVE";
  const terminal = question.status === "COMPLETED" || question.status === "LEARNED";
  const questionMinutes = coreTechnicalQuestionMinutes(
    question.question.format,
    block.story.expectedMinutes
  );
  const previous = block.questions.find(({ order }) => order === question.order - 1) ?? null;
  const next = block.questions.find(({ order }) => order === question.order + 1) ?? null;

  const draft = useMemo(
    () => draftFor(workKind, choice, text, code),
    [choice, code, text, workKind]
  );
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    if (!mutable || draftSignature === initialDraft.current) return;
    setDraftState("unsaved");
    const sequence = ++draftSequence.current;
    const timer = window.setTimeout(() => {
      setDraftState("saving");
      void post<{ question: CoreTechnicalPublicQuestion }>(`${experience.apiBase}/draft`, {
        questionId: question.id,
        draft
      })
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
  }, [draft, draftSignature, mutable, question.id]);

  async function revealHint() {
    const hintNumber = question.revealedHints.length + 1;
    if (!mutable || hintNumber > question.question.hintCount || pending) return;
    setPending("hint");
    setError(null);
    try {
      const data = await post<{ question: CoreTechnicalPublicQuestion }>(
        `${experience.apiBase}/hint`,
        { questionId: question.id, hintNumber }
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
    if (!mutable || workKind !== "code" || !code.trim() || pending) return;
    setPending("run");
    setError(null);
    setRun(null);
    setTestCasesOpen(true);
    const requestId = replaySafeRequestId(`${experience.slug}-run:${question.id}`, code);
    try {
      const data = await post<{ run: Omit<LocalRun, "code"> }>(`${experience.apiBase}/run`, {
        questionId: question.id,
        requestId,
        code
      });
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
    const work = attemptFor(workKind, choice, text, code, run);
    const validation = validateAttempt(workKind, work, code, run);
    if (validation) {
      setError(validation);
      return;
    }
    setPending("attempt");
    setError(null);
    const signature = JSON.stringify(work);
    const key = `${experience.slug}-attempt:${question.id}`;
    const requestId = replaySafeRequestId(key, signature);
    try {
      const data = await post<{
        attempt: NonNullable<CoreTechnicalPublicQuestion["latestAttempt"]>;
        question: CoreTechnicalPublicQuestion;
      }>(`${experience.apiBase}/attempt`, {
        questionId: question.id,
        requestId,
        work
      });
      clearReplayRequest(key);
      setQuestion(experience.adaptQuestion(data.question));
      setConfirmLearn(false);
      setPanelTab("review");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause, "Your answer could not be evaluated. Your draft is safe."));
    } finally {
      setPending(null);
    }
  }

  async function learn() {
    if (!mutable || !confirmLearn || pending) return;
    setPending("learn");
    setError(null);
    try {
      const data = await post<{ question: CoreTechnicalPublicQuestion }>(
        `${experience.apiBase}/learn`,
        { questionId: question.id, confirmed: true }
      );
      setQuestion(experience.adaptQuestion(data.question));
      setPanelTab("review");
      router.refresh();
    } catch (cause) {
      setError(messageFrom(cause, "Learn could not be confirmed. Your draft is safe."));
    } finally {
      setPending(null);
    }
  }

  const attempt = question.latestAttempt;
  const answer = question.authorizedAnswer;
  const panelTabs: Array<{ id: QuestionPanelTab; label: string }> = [
    { id: "description", label: "Description" },
    { id: "hints", label: "Hints" },
    { id: "review", label: "Review" }
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
                {humanizeCoreTechnicalKey(question.question.format)}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {terminal ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--workspace-accent-soft)] px-3 text-[12.5px] font-semibold text-[var(--workspace-accent)]">
              <CheckCircle2 size={14} aria-hidden="true" />
              {question.status === "LEARNED" ? "Learned · zero mastery" : "Completed"}
            </span>
          ) : null}
          <QuestionLink blockId={block.id} question={next} direction="next" routeBase={experience.routeBase} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619] xl:h-full">
          <div
            role="tablist"
            aria-label={`${experience.label} question reference`}
            className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2"
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
                  className={`relative h-10 shrink-0 rounded-t-lg px-3 text-[13px] font-semibold transition-colors ${selected ? "text-cream" : "text-cream/42 hover:bg-white/[0.035] hover:text-cream/72"}`}
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
                <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(156,109,255,0.09),rgba(255,255,255,0.018)_42%,rgba(0,0,0,0.16))] px-5 py-5 sm:px-6 sm:py-6">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--workspace-accent)] opacity-[0.07] blur-3xl"
                  />
                  <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
                    Question {question.order} of {block.questions.length} ·{" "}
                    {humanizeCoreTechnicalKey(question.question.format)}
                  </p>
                  <h2 className="relative mt-3 max-w-[36rem] font-display text-[1.65rem] font-semibold leading-[1.15] tracking-[-0.035em] text-cream sm:text-[1.9rem]">
                    {stageTitle}
                  </h2>
                  <p className="relative mt-4 whitespace-pre-wrap text-[14.5px] leading-7 text-cream/66">
                    {question.question.prompt}
                  </p>
                  <div className="relative mt-5 flex flex-wrap gap-1.5">
                    {question.question.topicKeys.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1 text-[10.5px] font-medium text-cream/42"
                      >
                        {humanizeCoreTechnicalKey(topic)}
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
                {mutable && question.revealedHints.length < question.question.hintCount ? (
                  <button
                    type="button"
                    onClick={() => void revealHint()}
                    disabled={pending !== null}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[13px] font-semibold text-cream/72 transition hover:bg-white/[0.065] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] disabled:opacity-55"
                  >
                    {pending === "hint" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Lightbulb size={14} aria-hidden="true" />
                    )}
                    Reveal hint {question.revealedHints.length + 1} of {question.question.hintCount}
                  </button>
                ) : null}
              </section>
            ) : null}

            {panelTab === "review" ? (
              <div className="space-y-4">
                {attempt ? <Feedback question={question} /> : null}
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
                {workKind === "code" ? responseLabel(question.question.format) : "Answer workspace"}
              </h2>
            </div>
            {workKind === "code" ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] font-medium text-cream/36 sm:inline">
                  JavaScript · Node.js 22
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCode(question.question.starterCode ?? "");
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
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Play size={13} aria-hidden="true" />
                  )}
                  {pending === "run" ? "Running" : "Run code"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {workKind === "choice" ? (
              <div className="p-4 sm:p-5">
                <ResponseIntro format={question.question.format} />
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
                  if (run?.code !== value) {
                    setRun(null);
                    setTestCasesOpen(false);
                  }
                }}
                onRun={() => void runCode()}
              />
            ) : (
              <div className="p-4 sm:p-5">
                <ResponseIntro format={question.question.format} />
                <TextInput
                  value={text}
                  spoken={question.question.format === "spoken"}
                  disabled={!mutable || pending !== null}
                  onChange={setText}
                />
              </div>
            )}

            {error ? (
              <p
                role="alert"
                className="mx-4 mb-4 rounded-lg border border-[#e3a15b]/20 bg-[#e3a15b]/10 px-4 py-3 text-[13px] leading-5 text-[#e7bd83] sm:mx-5"
              >
                {error}
              </p>
            ) : null}
            {confirmLearn && mutable ? (
              <div className="mx-4 mb-4 rounded-xl border border-[#e3a15b]/20 bg-[#e3a15b]/[0.07] px-4 py-4 sm:mx-5">
                <p className="text-[13px] leading-5 text-cream/62">
                  This reveals the answer and unlocks progress, but contributes zero Practice
                  mastery.
                </p>
                <button
                  type="button"
                  onClick={() => void learn()}
                  disabled={pending !== null}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cream px-4 text-[13px] font-semibold text-[#17181a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-55"
                >
                  {pending === "learn" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Confirm Learn
                </button>
              </div>
            ) : null}
          </div>

          {workKind === "code" && testCasesOpen ? (
            <div className="thin-scroll max-h-[16rem] shrink-0 overflow-y-auto border-t border-white/[0.07] bg-black/10 px-4 py-4 sm:px-5">
              {run ? (
                <RunResult run={run} />
              ) : (
                <p className="text-[12.5px] text-cream/42">
                  Run your code to check the public cases and hidden-case summary.
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
                ) : null}
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
              <QuestionLink blockId={block.id} question={previous} direction="previous" routeBase={experience.routeBase} />
            </nav>
            {mutable ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLearn((current) => !current)}
                  disabled={pending !== null}
                  aria-expanded={confirmLearn}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.09] hover:text-cream disabled:opacity-55"
                >
                  <SkipForward size={13} aria-hidden="true" /> Learn instead
                </button>
                <button
                  type="button"
                  onClick={() => void submitAttempt()}
                  disabled={pending !== null}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cream px-3.5 text-[12.5px] font-semibold text-[#17181a] transition hover:bg-white disabled:cursor-wait disabled:opacity-55"
                >
                  {pending === "attempt" ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
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
    </section>
  );
}

function Artifact({ question }: { question: CoreTechnicalPublicQuestion }) {
  return <StoryPracticeArtifact artifact={question.question.artifact as StoryPracticeArtifactData} />;
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
  disabled,
  onChange
}: {
  value: string;
  spoken: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      {spoken ? (
        <p className="mb-2 text-[12px] leading-5 text-cream/42">
          Say your answer aloud, then type the evidence you want assessed.
        </p>
      ) : null}
      <textarea
        aria-label={spoken ? "Spoken answer transcript" : "Written answer"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        maxLength={12_000}
        rows={14}
        className="min-h-[24rem] w-full resize-none rounded-xl border border-white/[0.075] bg-[linear-gradient(145deg,#111315,#0e1012)] px-4 py-4 text-[14px] leading-7 text-cream outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] placeholder:text-cream/24 transition focus:border-[var(--workspace-accent-border)] focus:ring-4 focus:ring-[var(--workspace-accent-soft)] disabled:opacity-65 xl:min-h-[calc(100svh-28rem)]"
        placeholder="Trace the mechanism, cite the artifact, and explain the production consequence…"
      />
      <p className="mt-1.5 text-right font-mono text-[10px] tabular-nums text-cream/28">
        {value.length}/12000
      </p>
    </div>
  );
}

function ResponseIntro({ format }: { format: CoreTechnicalPublicQuestion["question"]["format"] }) {
  return (
    <div className="mb-5 border-b border-white/[0.06] pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
        Your response
      </p>
      <h3 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-cream sm:text-[1.65rem]">
        {responseLabel(format)}
      </h3>
      <p className="mt-2 max-w-[42rem] text-[12.5px] leading-5 text-cream/42">
        {responseGuidance(format)}
      </p>
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
          {result.accepted ? "All tests accepted" : humanizeCoreTechnicalKey(result.status)}
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

function Feedback({ question }: { question: CoreTechnicalPublicQuestion }) {
  const attempt = question.latestAttempt!;
  return (
    <section
      className="rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] px-5 py-5"
      aria-labelledby="attempt-feedback-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Interview feedback
      </p>
      <h2
        id="attempt-feedback-heading"
        className="mt-2 font-display text-[1.3rem] font-semibold text-cream"
      >
        {attempt.score ?? attempt.feedback.score}/10 · {attempt.feedback.result}
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <FeedbackItem label="What worked" value={attempt.feedback.didWell} />
        <FeedbackItem label="What to improve" value={attempt.feedback.missingOrIncorrect} />
        <FeedbackItem label="Mechanism" value={attempt.feedback.mechanism} />
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

function AuthorizedAnswer({ question }: { question: CoreTechnicalPublicQuestion }) {
  const answer = question.authorizedAnswer!;
  return (
    <details className="rounded-xl border border-white/[0.075] bg-[#111214] px-4 py-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-cream/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]">
        Review the concise answer
      </summary>
      <p className="mt-4 text-[13px] leading-6 text-cream/64">{answer.concise}</p>
      <p className="mt-3 text-[12.5px] leading-6 text-cream/48">{answer.explanation}</p>
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
          <div style={{ height: codeViewerHeight(answer.referenceSolution, 380) }}>
            <DsaCodeEditor
              language="javascript"
              value={answer.referenceSolution}
              readOnly
              autoFocus={false}
              ariaLabel="Reference solution code, read only"
            />
          </div>
        </div>
      ) : null}
    </details>
  );
}

function QuestionLink({
  blockId,
  question,
  direction,
  routeBase
}: {
  blockId: string;
  question: CoreTechnicalPublicQuestion | null;
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

function initialChoice(question: CoreTechnicalPublicQuestion): number | null {
  const work = question.draft ?? question.latestAttempt?.work;
  return work?.kind === "choice" ? work.selectedChoiceIndex : null;
}

function initialText(question: CoreTechnicalPublicQuestion): string {
  const work = question.draft ?? question.latestAttempt?.work;
  return work?.kind === "text" ? work.text : "";
}

function initialCode(question: CoreTechnicalPublicQuestion): string {
  const work = question.draft ?? question.latestAttempt?.work;
  if (work?.kind === "code") return work.code;
  return question.latestRun?.code ?? question.question.starterCode ?? "";
}

function initialRun(question: CoreTechnicalPublicQuestion): LocalRun | null {
  const run = question.latestRun;
  return run ? { id: run.id, code: run.code, result: run.result, createdAt: run.createdAt } : null;
}

function draftFor(
  kind: ReturnType<typeof coreTechnicalQuestionWorkKind>,
  choice: number | null,
  text: string,
  code: string
): CoreTechnicalDraftWork | null {
  if (kind === "choice")
    return choice === null ? null : { kind: "choice", selectedChoiceIndex: choice };
  if (kind === "code") return code.trim() ? { kind: "code", code } : null;
  return text.trim() ? { kind: "text", text } : null;
}

function attemptFor(
  kind: ReturnType<typeof coreTechnicalQuestionWorkKind>,
  choice: number | null,
  text: string,
  code: string,
  run: LocalRun | null
): CoreTechnicalAttemptWork | null {
  if (kind === "choice")
    return choice === null ? null : { kind: "choice", selectedChoiceIndex: choice };
  if (kind === "code") return run ? { kind: "code", code, runId: run.id } : null;
  return text.trim() ? { kind: "text", text } : null;
}

function validateAttempt(
  kind: ReturnType<typeof coreTechnicalQuestionWorkKind>,
  work: CoreTechnicalAttemptWork | null,
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

function responseLabel(format: CoreTechnicalPublicQuestion["question"]["format"]): string {
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

function responseGuidance(format: CoreTechnicalPublicQuestion["question"]["format"]): string {
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

function codeViewerHeight(value: string, maximum: number): number {
  return Math.min(maximum, Math.max(220, value.split("\n").length * 23 + 64));
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
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
      payload?.error?.message ?? "This Core Technical action could not be completed."
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
  throw new Error(`Unhandled Core Technical question format: ${String(value)}`);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
