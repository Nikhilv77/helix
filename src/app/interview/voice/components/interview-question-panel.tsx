"use client";

import { Check, Loader2, Mic, Send, X } from "lucide-react";
import type { InterviewQuestion, InterviewStage } from "@/lib/shared/types";
import { ResizableTextarea } from "@/components/interview/dsa/resizable-textarea";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { INTERVIEW_PANEL_CARD, INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./panel-surface";

export interface InterviewStageDef {
  id: InterviewStage;
  label: string;
  caption: string;
}

/** The resume round's three acts. */
export const RESUME_STAGES: InterviewStageDef[] = [
  { id: "skills", label: "Skills", caption: "What your resume claims" },
  { id: "code", label: "Code", caption: "A task in your own stack" },
  { id: "experience", label: "Experience", caption: "The work you shipped" }
];

/** The fundamentals round's three acts. */
export const FUNDAMENTALS_STAGES: InterviewStageDef[] = [
  { id: "rapid", label: "Rapid fire", caption: "Quick checks across areas" },
  { id: "explain", label: "Explain", caption: "The mechanism, not the label" },
  { id: "scenario", label: "Scenario", caption: "Diagnose something real" }
];

export type StageCounts = Partial<Record<InterviewStage, { total: number; done: number }>>;

export interface InterviewGrade {
  questionIndex: number;
  correct: boolean;
}

/** How far the round has moved through each of its stages. */
export function stageCounts(
  stages: Array<InterviewStage | null>,
  answeredIndex: number
): StageCounts {
  const counts: StageCounts = {};

  stages.forEach((stage, index) => {
    if (!stage) return;
    const entry = counts[stage] ?? { total: 0, done: 0 };
    entry.total += 1;
    if (index < answeredIndex) entry.done += 1;
    counts[stage] = entry;
  });

  return counts;
}

/**
 * The middle column of a resume round: which stage we are in, the question
 * currently on the table, and the surface for answering it.
 *
 * The answer surface follows the question's own `answerFormat`, so a multiple
 * choice question shows options, a written question shows an editor, and a
 * spoken question stays out of the way and lets the candidate talk.
 */
export function InterviewQuestionPanel({
  question,
  questionIndex,
  questionCount,
  stages,
  anchorLabel,
  counts,
  grade,
  liveTranscript,
  micOn,
  thinking,
  sending,
  error,
  draft,
  notes,
  selectedOption,
  onDraftChange,
  onNotesChange,
  onSelectOption,
  onSubmit,
  onRequestMic
}: {
  question: InterviewQuestion | null;
  questionIndex: number;
  questionCount: number;
  /** The round's acts, in order, drawn by the stage rail. */
  stages: InterviewStageDef[];
  /** Prefix for the question's anchor line, when the round has one to show. */
  anchorLabel?: string | null;
  counts: StageCounts;
  grade: InterviewGrade | null;
  liveTranscript: string;
  micOn: boolean;
  thinking: boolean;
  sending: boolean;
  error: string | null;
  draft: string;
  notes: string;
  selectedOption: string | null;
  onDraftChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSelectOption: (option: string) => void;
  onSubmit: () => void;
  onRequestMic: () => void;
}) {
  const teacher = useWorkspaceTeacher();
  const stage = question?.stage ?? stages[0]?.id ?? "skills";
  const format = question?.answerFormat ?? (question?.kind === "code" ? "typed" : "spoken");
  const graded = grade && grade.questionIndex === questionIndex ? grade : null;

  return (
    <section
      className={`${INTERVIEW_PANEL_SHELL} flex min-h-[28rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
    >
      <StageRail stages={stages} current={stage} counts={counts} />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        {question ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="text-cream/44">
                Question {Math.min(questionIndex + 1, questionCount)} of {questionCount}
              </span>
              {question.skill ? (
                <>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-cream/24" />
                  <span className="font-medium text-[var(--workspace-accent)]">
                    {question.skill}
                  </span>
                </>
              ) : null}
              {question.competency ? (
                <>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-cream/24" />
                  <span className="text-cream/44">{question.competency}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-4 text-balance font-display text-[1.45rem] font-semibold leading-[1.24] tracking-tight text-cream sm:text-[1.7rem]">
              {question.text}
            </h1>

            {question.evidenceAnchor && anchorLabel ? (
              <p className="mt-3 border-l-2 border-[var(--workspace-accent)]/45 pl-3 text-sm leading-6 text-cream/48">
                {anchorLabel}: {question.evidenceAnchor}
              </p>
            ) : null}

            {question.codeTask ? (
              <p className={`${INTERVIEW_PANEL_CARD} mt-5 p-4 text-[15px] leading-7 text-cream/72`}>
                {question.codeTask}
              </p>
            ) : null}

            {question.codeSnippet ? (
              <pre className="thin-scroll mt-5 max-h-80 overflow-auto rounded-xl bg-black/35 p-4 font-mono text-sm leading-6 text-cream/78 ring-1 ring-inset ring-white/[0.06]">
                <code>{question.codeSnippet}</code>
              </pre>
            ) : null}

            {question.expects?.length && format !== "mcq" ? (
              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/38">
                  A strong answer covers
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {question.expects.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-6 text-cream/56">
                      <span
                        aria-hidden="true"
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--workspace-accent)]"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {format === "mcq" && question.options?.length ? (
              <ul className="mt-7 space-y-2.5">
                {question.options.map((option, index) => {
                  const chosen = selectedOption === option;
                  const state = graded && chosen ? (graded.correct ? "right" : "wrong") : null;

                  return (
                    <li key={option}>
                      <button
                        type="button"
                        disabled={sending || Boolean(selectedOption)}
                        onClick={() => onSelectOption(option)}
                        className={`group flex w-full items-start gap-3.5 rounded-xl px-4 py-3.5 text-left transition disabled:cursor-default ${
                          state === "right"
                            ? "bg-[var(--workspace-accent)]/[0.14] ring-1 ring-inset ring-[var(--workspace-accent)]/55"
                            : state === "wrong"
                              ? "bg-[#dd5f5f]/[0.1] ring-1 ring-inset ring-[#dd5f5f]/40"
                              : chosen
                                ? "bg-white/[0.07] ring-1 ring-inset ring-white/[0.14]"
                                : "bg-white/[0.03] ring-1 ring-inset ring-white/[0.05] enabled:hover:bg-white/[0.06] enabled:hover:ring-white/[0.1]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
                            state === "right"
                              ? "bg-[var(--workspace-accent)] text-[#101113]"
                              : state === "wrong"
                                ? "bg-[#dd5f5f] text-[#101113]"
                                : "bg-white/[0.06] text-cream/56"
                          }`}
                        >
                          {state === "right" ? (
                            <Check size={13} strokeWidth={2.5} />
                          ) : state === "wrong" ? (
                            <X size={13} strokeWidth={2.5} />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </span>
                        <span className="text-[15px] leading-6 text-cream/82">{option}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {format === "spoken" && !question.codeTask ? (
              <div className={`${INTERVIEW_PANEL_CARD} mt-7 p-4`}>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      micOn
                        ? "animate-pulse bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]"
                        : "bg-cream/28"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-cream/76">
                    {micOn
                      ? `Answer out loud — ${teacher.name} is listening`
                      : "Your microphone is off"}
                  </p>
                  {!micOn ? (
                    <button
                      type="button"
                      onClick={onRequestMic}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--workspace-accent)] transition hover:text-cream"
                    >
                      <Mic size={13} aria-hidden="true" />
                      Turn on
                    </button>
                  ) : null}
                </div>
                <p className="mt-2.5 min-h-[1.5rem] text-[15px] leading-7 text-cream/62">
                  {liveTranscript || (
                    <span className="text-cream/28">
                      Take your time. Say it the way you would in a real interview.
                    </span>
                  )}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className={`${INTERVIEW_PANEL_CARD} p-5 text-sm leading-7 text-cream/50`}>
            {thinking
              ? `${teacher.name} is thinking…`
              : `Waiting for ${teacher.name}'s next question.`}
          </p>
        )}
      </div>

      {question && format !== "mcq" ? (
        <div
          className={`shrink-0 border-t ${INTERVIEW_PANEL_RULE} bg-black/10 px-4 py-3.5 sm:px-5`}
        >
          <label htmlFor="resume-answer" className="text-sm font-semibold text-cream/80">
            {question.codeTask ? `Explain your code to ${teacher.name}` : "Or write your answer"}
          </label>
          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <ResizableTextarea
              id="resume-answer"
              value={question.codeTask ? notes : draft}
              onChange={(event) =>
                question.codeTask
                  ? onNotesChange(event.target.value)
                  : onDraftChange(event.target.value)
              }
              rows={2}
              placeholder={
                question.codeTask
                  ? "What does your solution do, and why that approach?"
                  : "Type your answer if you would rather write it than say it."
              }
              minHeight={76}
              maxHeight={148}
              containerClassName="min-w-0 flex-1"
              textareaClassName="rounded-xl border-0 bg-black/20 px-3.5 py-2.5 font-sans text-sm leading-6 text-cream outline-none ring-1 ring-inset ring-white/[0.045] transition placeholder:text-cream/26 focus:bg-black/30 focus:ring-white/[0.1]"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={sending || !(question.codeTask ? draft.trim() : draft.trim().length >= 2)}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
            >
              {sending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={15} aria-hidden="true" />
              )}
              {sending
                ? `${teacher.name} is reading`
                : question.codeTask
                  ? "Send solution"
                  : "Send answer"}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-[#ffb4b4]">{error}</p> : null}
        </div>
      ) : null}

      {question && format === "mcq" && error ? (
        <p className={`shrink-0 border-t ${INTERVIEW_PANEL_RULE} px-5 py-3 text-sm text-[#ffb4b4]`}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

function StageRail({
  stages,
  current,
  counts
}: {
  stages: InterviewStageDef[];
  current: InterviewStage;
  counts: StageCounts;
}) {
  return (
    <div
      className={`grid shrink-0 gap-px border-b ${INTERVIEW_PANEL_RULE} bg-white/[0.04]`}
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage) => {
        const { total, done } = counts[stage.id] ?? { total: 0, done: 0 };
        const active = stage.id === current;
        const complete = total > 0 && done >= total;

        return (
          <div
            key={stage.id}
            aria-current={active ? "step" : undefined}
            className={`relative px-4 py-3 transition ${
              active
                ? "bg-[color-mix(in_srgb,var(--workspace-accent)_9%,rgba(17,18,21,0.9))]"
                : "bg-[rgba(17,18,21,0.9)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  active
                    ? "bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]"
                    : complete
                      ? "bg-[var(--workspace-accent)]/55"
                      : "bg-cream/22"
                }`}
              />
              <p
                className={`truncate text-sm font-semibold ${
                  active ? "text-cream" : complete ? "text-cream/60" : "text-cream/38"
                }`}
              >
                {stage.label}
              </p>
              {total > 0 ? (
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-cream/34">
                  {Math.min(done, total)}/{total}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] leading-5 text-cream/32">{stage.caption}</p>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-px bg-[var(--workspace-accent)]"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
