"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, MessageCircleQuestion, RefreshCw, X } from "lucide-react";
import { DsaCodeEditor, type DsaEditorLanguage } from "@/components/interview/dsa/dsa-code-editor";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import type { DsaPracticeFeedback } from "@/server/dsa/practice-feedback.service";

/**
 * What the run scored, carried so the debrief can say it.
 *
 * With hidden cases a candidate sees three examples pass and has no way to know
 * six more were graded — so the modal states the tally rather than leaving the
 * solve feeling smaller than it was.
 */
export interface DsaRunTally {
  passed: number;
  total: number;
  hidden: number;
}

export type DsaTeacherFeedbackState =
  | { status: "idle" }
  | { status: "loading"; code: string; language: DsaEditorLanguage; tally?: DsaRunTally }
  | {
      status: "ready";
      feedback: DsaPracticeFeedback;
      code: string;
      language: DsaEditorLanguage;
      tally?: DsaRunTally;
    }
  | {
      status: "error";
      message: string;
      code: string;
      language: DsaEditorLanguage;
      tally?: DsaRunTally;
    };

/** A focused, centered teacher moment after a successful run. */
export function DsaTeacherFeedback({
  state,
  onClose,
  onRetry
}: {
  state: DsaTeacherFeedbackState;
  onClose: () => void;
  onRetry: () => void;
}) {
  const teacher = useWorkspaceTeacher();
  const { state: voiceState, speak, stop } = useMayaVoice();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const spokenFeedback = useRef<string | null>(null);

  const feedback = state.status === "ready" ? state.feedback : null;
  const isOpen = state.status !== "idle";
  const isSpeaking = voiceState === "speaking";
  const snippet = useMemo(() => codeExcerpt(state.status === "idle" ? "" : state.code), [state]);
  const feedbackLanguage = state.status === "ready" ? state.language : "javascript";

  // The workspace has nested scrolling panels. Rendering at document.body
  // makes this truly viewport-centered on desktop and mobile.
  useEffect(() => setPortalRoot(document.body), []);

  useEffect(() => {
    setFeedbackVisible(false);
  }, [feedback?.voiceScript]);

  useEffect(() => {
    if (!feedback || spokenFeedback.current === feedback.voiceScript) return;
    spokenFeedback.current = feedback.voiceScript;
    void speak(feedback.voiceScript, teacher.id).then((result) => {
      if (result !== "started") setFeedbackVisible(true);
    });
  }, [feedback, speak, teacher.id]);

  useEffect(() => {
    if (voiceState === "speaking") setFeedbackVisible(true);
  }, [voiceState]);

  if (!isOpen || !portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="presentation"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/70 backdrop-blur-[3px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-feedback-title"
        className="relative grid h-[min(48rem,calc(100dvh-1.5rem))] w-full max-w-[44rem] grid-rows-[16rem_minmax(0,1fr)] overflow-hidden rounded-[1.6rem] border border-white/[0.11] bg-[#141719] shadow-[0_32px_120px_rgba(0,0,0,0.62)] sm:grid-rows-[18rem_minmax(0,1fr)]"
      >
        <TeacherStage
          teacherName={teacher.name}
          speaking={isSpeaking}
          onClose={() => {
            stop();
            onClose();
          }}
        />

        <div className="thin-scroll min-h-0 overflow-y-auto bg-[#15181a] px-5 py-5 sm:px-7 sm:py-6">
          {state.status === "loading" ? <FeedbackLoading teacherName={teacher.name} /> : null}
          {state.status === "error" ? (
            <FeedbackError message={state.message} onRetry={onRetry} />
          ) : null}
          {feedback ? (
            <>
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-cream/55">
                <CheckCircle2
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--workspace-accent)" }}
                />
                {runSummary(state)}
              </div>
              <h2
                id="teacher-feedback-title"
                className="mt-3 text-[21px] font-semibold leading-tight tracking-[-0.025em] text-cream sm:text-[24px]"
              >
                {feedback.headline}
              </h2>

              {snippet ? <CodeMoment snippet={snippet} language={feedbackLanguage} /> : null}

              {feedbackVisible ? (
                <div className="mt-5">
                  <MarkdownFeedback markdown={feedback.markdown} />
                  <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-3.5">
                    <div className="flex gap-2.5">
                      <MessageCircleQuestion
                        size={15}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--workspace-accent)" }}
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/42">
                          {teacher.name} would ask
                        </p>
                        <p className="mt-1 text-[13.5px] leading-5 text-cream/82">
                          {feedback.followUp}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="thinking-shimmer mt-5 text-[13px] font-medium text-cream/48">
                  {teacher.name} is getting ready to walk you through it…
                </p>
              )}
            </>
          ) : null}
        </div>
      </aside>
    </div>,
    portalRoot
  );
}

function TeacherStage({
  teacherName,
  speaking,
  onClose
}: {
  teacherName: string;
  speaking: boolean;
  onClose: () => void;
}) {
  return (
    <div className="relative min-h-0 overflow-hidden border-b border-white/[0.07] bg-[#0c0e0f]">
      <div className="practice-accent-glow absolute inset-x-[8%] bottom-[-28%] z-0 h-[65%] opacity-85" />
      <div className="absolute inset-x-0 bottom-0 top-5 z-0">
        <MayaStage speaking={speaking} />
      </div>
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/55 to-transparent p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/45">
            Teacher debrief
          </p>
          <p className="mt-1 text-[16px] font-semibold text-cream">{teacherName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close teacher feedback"
          className="grid h-9 w-9 place-items-center rounded-xl bg-black/25 text-cream/60 transition hover:bg-black/45 hover:text-cream"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0c0e0f] via-[#0c0e0f]/65 to-transparent px-4 pb-4 pt-12 sm:px-5 sm:pb-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[12px] font-medium text-cream/68">
          <span
            className={`h-1.5 w-1.5 rounded-full ${speaking ? "shadow-[0_0_12px_var(--workspace-accent)]" : "bg-cream/35"}`}
            style={speaking ? { background: "var(--workspace-accent)" } : undefined}
          />
          {speaking ? "Speaking" : "Ready when you are"}
        </span>
      </div>
    </div>
  );
}

function CodeMoment({ snippet, language }: { snippet: string; language: DsaEditorLanguage }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.065] bg-[#0c0e0f]">
      <div className="flex items-center gap-2 border-b border-white/[0.055] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/40">
          A good part of your code
        </p>
      </div>
      <div className="h-40 overflow-hidden">
        <DsaCodeEditor
          language={language}
          value={snippet}
          readOnly
          ariaLabel="Your highlighted solution code"
        />
      </div>
    </div>
  );
}

function FeedbackLoading({ teacherName }: { teacherName: string }) {
  return (
    <div className="flex min-h-48 items-center rounded-2xl bg-white/[0.035] p-4">
      <p className="thinking-shimmer text-[14px] font-medium text-cream/55">
        {teacherName} is reading your solution and picking out what matters most…
      </p>
    </div>
  );
}

function FeedbackError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-48 items-center">
      <div className="practice-glass-soft w-full rounded-2xl p-4">
        <p className="text-sm font-semibold text-cream">Your solution passed.</p>
        <p className="mt-1.5 text-[13px] leading-5 text-cream/52">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.07] px-3 text-[12.5px] font-semibold text-cream/78 transition hover:bg-white/[0.11] hover:text-cream"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Try feedback again
        </button>
      </div>
    </div>
  );
}

function MarkdownFeedback({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => toMarkdownBlocks(markdown).slice(0, 4), [markdown]);
  return (
    <div className="mt-5 space-y-2.5">
      {blocks.map((block, index) => (
        <div key={`${block.kind}-${index}`}>
          {block.kind === "heading" ? (
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/42">
              {block.text}
            </h3>
          ) : block.kind === "list" ? (
            <ul className="space-y-1.5">
              {block.items.slice(0, 2).map((item) => (
                <li key={item} className="flex gap-2 text-[13.5px] leading-5 text-cream/76">
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-[var(--workspace-accent)]"
                  />
                  <span>{inlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] leading-6 text-cream/78">{inlineMarkdown(block.text)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

type MarkdownBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function toMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    if (list.length) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) flush();
    else if (line.startsWith("### ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(4) });
    } else if (/^[-*]\s+/.test(line)) {
      if (paragraph.length) flush();
      list.push(line.replace(/^[-*]\s+/, ""));
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Lines that are setup, never the interesting part of a solution. */
const BOILERPLATE = /^\s*(import|package|using|#include|from\s+\S+\s+import|public\s+class|class\s+\w+\s*\{?\s*$)/;

/**
 * Picks the part of a solution worth showing back.
 *
 * The previous heuristic searched every line for `HashMap`, `for (` and friends
 * — and `import java.util.HashMap;` matches, so a Java solve was shown its own
 * import block under the heading "a good part of your code". Boilerplate is
 * excluded before the search so the anchor lands on real logic.
 */
function codeExcerpt(code: string): string {
  const lines = code.split("\n");
  const interesting = /\b(new\s+(Set|Map)|HashSet|HashMap|for\s*\(|while\s*\(|if\s*\(|return\s+)/;

  // The signature first when there is one: it names what the code does, and
  // the lines under it are the solution. Anchoring on the first `return`
  // instead showed Python solves the middle of their own loop.
  const definition = /^\s*(def\s+\w+|(public|private|protected|static|final|\s)*[\w<>[\]]+\s+\w+\s*\(|function\s+\w+|const\s+\w+\s*=\s*(\(|function|async))/;
  let index = lines.findIndex((line) => !BOILERPLATE.test(line) && definition.test(line));

  if (index < 0) {
    index = lines.findIndex((line) => !BOILERPLATE.test(line) && interesting.test(line));
  }

  // Nothing matched — fall back to the first line that is not setup.
  if (index < 0) {
    index = lines.findIndex((line) => line.trim() && !BOILERPLATE.test(line));
  }
  if (index < 0) return "";

  // A signature is the top of the excerpt; a logic anchor gets a line of lead-in.
  const start = definition.test(lines[index] ?? "") ? index : Math.max(0, index - 1);
  return lines
    .slice(start, start + 6)
    .join("\n")
    .trim();
}

function inlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={index} className="font-semibold text-cream">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          key={index}
          className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.9em] text-cream/88"
        >
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={index}>{part}</Fragment>;
  });
}


/**
 * States what the run actually cleared.
 *
 * "Your solution passed the supplied tests" was true when every case was a
 * visible example, and undersells a solve that also cleared cases the candidate
 * never saw. The count is stated, but not the shown/hidden split — reading
 * "3 shown, 4 hidden" at the moment of success makes the win feel qualified.
 * The split belongs on the Test cases panel, not in the congratulation.
 */
function runSummary(state: DsaTeacherFeedbackState): string {
  const tally = state.status === "idle" ? undefined : state.tally;
  if (!tally || tally.total === 0) return "Your solution passed the supplied tests";

  return `Passed all ${tally.total} test ${tally.total === 1 ? "case" : "cases"}`;
}
