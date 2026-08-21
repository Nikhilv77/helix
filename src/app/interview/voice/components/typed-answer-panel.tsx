import type { KeyboardEvent } from "react";
import { Code2, Keyboard, Loader2, Send, X } from "lucide-react";
import type { InterviewQuestion } from "@/lib/types";

export function TypedAnswerPanel({
  question,
  prompt,
  draft,
  notes,
  sending,
  error,
  onDraftChange,
  onNotesChange,
  onClose,
  onSubmit
}: {
  question: InterviewQuestion | null;
  prompt: string;
  draft: string;
  notes: string;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCode = question?.kind === "code";
  const canSubmit = draft.trim().length > 0 && !sending;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="msg-in mb-3 shrink-0 overflow-hidden rounded-2xl bg-cream/[0.045]">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream/[0.06] text-cream">
          {isCode ? (
            <Code2 size={15} aria-hidden="true" />
          ) : (
            <Keyboard size={15} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-cream">
            {isCode ? "Write your solution" : "Answer in writing"}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-cream/40">
            {prompt || "Microphone paused while you type"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-cream/45 transition hover:bg-cream/10 hover:text-cream disabled:opacity-30"
          aria-label="Close typed answer"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {isCode ? (
        <div className="grid max-h-[58dvh] min-h-0 lg:max-h-[42dvh] lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)]">
          <label className="min-h-0">
            <span className="sr-only">Code solution</span>
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              spellCheck={false}
              maxLength={6500}
              className="thin-scroll h-64 w-full resize-none bg-[#08143e] p-4 font-mono text-[12px] leading-6 text-[#d8e2ff] outline-none placeholder:text-cream/20 lg:h-full lg:min-h-56"
            />
          </label>
          <label className="flex min-h-0 flex-col p-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-cream/38">
              Explain your decision
            </span>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              onKeyDown={onKeyDown}
              rows={4}
              maxLength={1200}
              placeholder="What did you change, why is it correct, and how would you verify it?"
              className="mt-3 min-h-24 flex-1 resize-none rounded-xl bg-black/10 p-3 text-sm leading-6 text-cream outline-none placeholder:text-cream/25 focus:bg-black/15"
            />
          </label>
        </div>
      ) : (
        <label className="block p-4 sm:p-5">
          <span className="sr-only">Typed answer</span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={4}
            autoFocus
            maxLength={6500}
            placeholder="Write your answer here..."
            className="thin-scroll w-full resize-none rounded-xl bg-black/10 p-4 text-[15px] leading-7 text-cream outline-none placeholder:text-cream/25 focus:bg-black/15"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        {error ? <p className="text-xs text-[#ffb4b4]">{error}</p> : null}
        <p className="hidden font-mono text-[9px] uppercase tracking-[0.13em] text-cream/28 sm:block">
          Cmd/Ctrl + Enter to submit
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-cream bg-cream px-4 text-xs font-semibold text-blueprint transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={14} aria-hidden="true" />
          )}
          {sending ? "Maya is reviewing" : isCode ? "Submit solution" : "Submit answer"}
        </button>
      </div>
    </section>
  );
}
