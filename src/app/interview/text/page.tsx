"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { PathRail } from "@/components/interview/path-rail";
import { ApiClientError, endInterview, getSession, submitAnswer } from "@/lib/api-client";
import { HARD_INTERRUPT_MS, SOFT_INTERRUPT_MS, evaluateInterruption } from "@/lib/interruption";
import type { Phase, Turn } from "@/lib/types";

const HARD_CAP_MS = 15 * 60 * 1000;

const actionStyles: Record<string, { label: string; className: string }> = {
  probe: { label: "Probe", className: "text-[#8fb4ff]" },
  challenge: { label: "Challenge", className: "text-[#ffb27a]" },
  interrupt: { label: "Interrupting", className: "text-[#ff9a9a]" },
  move_on: { label: "Next question", className: "text-[#8fe0b4]" }
};

export default function TextInterviewPage() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <TextInterview />
    </Suspense>
  );
}

function TextInterview() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("session") ?? null;

  const [entries, setEntries] = useState<Turn[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState("");
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>("questioning");
  const [progress, setProgress] = useState({ index: 0, count: 4, followUps: 0 });
  const [error, setError] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/interview");
      return;
    }

    let cancelled = false;

    getSession(sessionId)
      .then((session) => {
        if (cancelled) return;
        setEntries(session.turns);
        setStartedAt(session.startedAt);
        setPhase(session.phase);
        setProgress({
          index: session.questionIndex,
          count: session.questionCount,
          followUps: session.followUpCount
        });
      })
      .catch(() => {
        if (!cancelled) router.replace("/interview");
      });

    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  useEffect(() => {
    if (startedAt === null || phase === "done") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, thinking]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!sessionId || startedAt === null || trimmed.length === 0 || thinking) return;

      const now = Date.now();
      const startMs = Math.max(0, (answerStartedAt ?? now) - startedAt);
      const endMs = Math.max(startMs, now - startedAt);

      setAnswerStartedAt(null);
      setDraft("");
      setInterrupted(false);
      setThinking(true);
      setError(null);
      setEntries((current) => [
        ...current,
        { speaker: "user", text: trimmed, startMs, endMs, questionIndex: progress.index }
      ]);

      try {
        const decision = await submitAnswer({ sessionId, userAnswer: trimmed, startMs, endMs });

        setEntries((current) => [
          ...current,
          {
            speaker: "agent",
            text: decision.utterance,
            startMs: decision.elapsedMs,
            endMs: decision.elapsedMs,
            action: decision.action,
            forcedBy: decision.forcedBy,
            questionIndex: decision.questionIndex
          }
        ]);
        setPhase(decision.phase);
        setProgress({
          index: decision.questionIndex,
          count: decision.questionCount,
          followUps: decision.followUpCount
        });
      } catch (caught) {
        setError(
          caught instanceof ApiClientError ? caught.message : "That answer could not be sent."
        );
      } finally {
        setThinking(false);
      }
    },
    [answerStartedAt, progress.index, sessionId, startedAt, thinking]
  );

  /**
   * Interruption watchdog. In text mode the speech window is time since the
   * user started typing plus what they have typed. Phase 2 swaps that source
   * for speech duration and partial STT without touching the rule.
   */
  useEffect(() => {
    if (thinking || phase === "done" || answerStartedAt === null) return;

    const timer = window.setInterval(() => {
      const decision = evaluateInterruption({
        elapsedMs: Date.now() - answerStartedAt,
        text: draft
      });

      if (!decision) return;

      const at = startedAt ? Date.now() - startedAt : 0;
      setInterrupted(true);
      setEntries((current) => [
        ...current,
        {
          speaker: "agent",
          text: decision.utterance,
          startMs: at,
          endMs: at,
          action: "interrupt",
          questionIndex: progress.index
        }
      ]);
      setAnswerStartedAt(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [answerStartedAt, draft, phase, progress.index, startedAt, thinking]);

  function onDraftChange(value: string) {
    setDraft(value);
    if (value.trim().length === 0) {
      setAnswerStartedAt(null);
      return;
    }
    setAnswerStartedAt((current) => current ?? Date.now());
  }

  async function stop() {
    if (!sessionId) return;
    await endInterview(sessionId).catch(() => null);
    setPhase("done");
  }

  const overCap = elapsed >= HARD_CAP_MS;
  const lastAgentIndex = entries.map((entry) => entry.speaker).lastIndexOf("agent");

  return (
    <Shell>
      {/* Single rule: the elapsed bar doubles as the header divider. */}
      <header className="relative flex flex-wrap items-center gap-4 pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <HelixMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-tight">Helix</span>
        </Link>

        <span className="blueprint-label rounded-full border border-cream/20 px-3 py-1 text-cream/50">
          Text mode
        </span>

        <div className="hidden lg:block">
          <PathRail
            phase={phase}
            questionIndex={progress.index}
            questionCount={progress.count}
            followUpCount={progress.followUps}
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-xs text-cream/45 lg:hidden">
            {Math.min(progress.index + 1, progress.count)}/{progress.count}
          </span>
          <span
            className={`font-mono text-xs tabular-nums ${overCap ? "text-[#ff9a9a]" : "text-cream/60"}`}
          >
            {formatClock(elapsed)}
            <span className="text-cream/25"> / 15:00</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={phase === "done"}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/20 px-3 text-xs font-semibold text-cream/60 transition hover:border-[#dd5f5f]/60 hover:text-cream disabled:opacity-30"
          >
            <Square size={11} aria-hidden="true" />
            End
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-cream/12">
          <div
            className={`h-full transition-all duration-500 ${overCap ? "bg-[#dd5f5f]" : "bg-cream/70"}`}
            style={{ width: `${Math.min(100, (elapsed / HARD_CAP_MS) * 100)}%` }}
          />
        </div>
      </header>

      <div className="thin-scroll fade-top flex flex-1 flex-col overflow-y-auto py-8 pr-2">
        {/* mt-auto keeps a short transcript anchored to the composer. */}
        <div className="mt-auto space-y-8">
          {entries.map((entry, index) => (
            <TurnBlock
              key={`${entry.startMs}-${index}`}
              entry={entry}
              previous={entries[index - 1]}
              emphasised={index === lastAgentIndex && phase !== "done"}
            />
          ))}

          {thinking ? <Thinking /> : null}
          {phase === "done" ? <Completed turns={entries.length} /> : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-[#dd5f5f]/45 bg-[#dd5f5f]/10 px-4 py-3 text-sm text-cream">
          {error}
        </p>
      ) : null}

      {phase !== "done" ? (
        <Composer
          draft={draft}
          thinking={thinking}
          interrupted={interrupted}
          answerStartedAt={answerStartedAt}
          onChange={onDraftChange}
          onSend={() => void send(draft)}
        />
      ) : null}
    </Shell>
  );
}

function TurnBlock({
  entry,
  previous,
  emphasised
}: {
  entry: Turn;
  previous?: Turn;
  emphasised: boolean;
}) {
  const startsNewQuestion =
    previous !== undefined &&
    entry.questionIndex !== undefined &&
    previous.questionIndex !== undefined &&
    entry.questionIndex > previous.questionIndex;

  return (
    <>
      {startsNewQuestion ? <QuestionDivider index={entry.questionIndex ?? 0} /> : null}
      {entry.speaker === "user" ? (
        <UserTurn entry={entry} />
      ) : (
        <AgentTurn entry={entry} emphasised={emphasised} />
      )}
    </>
  );
}

function QuestionDivider({ index }: { index: number }) {
  return (
    <div className="msg-in flex items-center gap-4 pt-2">
      <span className="h-px flex-1 bg-cream/12" />
      <span className="blueprint-label text-cream/30">Question {index + 1}</span>
      <span className="h-px flex-1 bg-cream/12" />
    </div>
  );
}

function AgentTurn({ entry, emphasised }: { entry: Turn; emphasised: boolean }) {
  const action = entry.action && entry.action !== "intro" ? actionStyles[entry.action] : undefined;
  const urgent = entry.action === "interrupt" || entry.action === "challenge";

  return (
    <div className="msg-in flex gap-3.5">
      <span
        className={[
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
          urgent ? "border-[#dd5f5f]/50 text-[#ff9a9a]" : "border-cream/25 text-cream"
        ].join(" ")}
      >
        <HelixMark className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0 max-w-[85%] pt-1">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/35">
            Helix
          </span>
          {action ? (
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.18em] ${action.className}`}
            >
              {action.label}
            </span>
          ) : null}
          {entry.forcedBy ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/25">
              {entry.forcedBy.replace(/-/g, " ")}
            </span>
          ) : null}
        </div>

        <p
          className={[
            "mt-1.5 leading-8 transition-colors",
            emphasised ? "text-[17px] font-medium text-cream" : "text-[15px] text-cream/55"
          ].join(" ")}
        >
          {entry.text}
        </p>
      </div>
    </div>
  );
}

function UserTurn({ entry }: { entry: Turn }) {
  const seconds = Math.round((entry.endMs - entry.startMs) / 1000);

  return (
    <div className="msg-in flex justify-end">
      <div className="max-w-[85%]">
        <div className="flex items-center justify-end gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/35">
            You
          </span>
          {seconds > 0 ? (
            <span
              className={`font-mono text-[10px] ${seconds >= 90 ? "text-[#ff9a9a]" : "text-cream/25"}`}
            >
              {seconds}s
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 rounded-2xl rounded-tr-md bg-cream/[0.09] px-5 py-3">
          <p className="text-[15px] leading-7 text-cream/80">{entry.text}</p>
        </div>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="msg-in flex gap-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cream/25 text-cream">
        <HelixMark className="h-4.5 w-4.5" />
      </span>
      <div className="flex items-center gap-1.5 pt-4">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-cream"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Completed({ turns }: { turns: number }) {
  return (
    <div className="msg-in rounded-2xl border border-cream/25 bg-cream/[0.08] p-6">
      <p className="blueprint-label text-cream/50">Interview complete</p>
      <p className="mt-2.5 text-lg font-semibold tracking-tight text-cream">
        {turns} turns recorded with millisecond timings.
      </p>
      <p className="mt-1.5 text-sm leading-6 text-cream/55">
        Scoring and the transcript report arrive in a later phase.
      </p>
      <Link
        href="/interview"
        className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-cream bg-cream px-4 text-sm font-semibold text-blueprint transition hover:bg-white"
      >
        New interview
      </Link>
    </div>
  );
}

function Composer({
  draft,
  thinking,
  interrupted,
  answerStartedAt,
  onChange,
  onSend
}: {
  draft: string;
  thinking: boolean;
  interrupted: boolean;
  answerStartedAt: number | null;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="pb-6 pt-2">
      {interrupted ? (
        <p className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#ff9a9a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#dd5f5f]" />
          Cut off — answer what was just asked
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="rounded-2xl border border-cream/20 bg-white/[0.05] transition focus-within:border-cream/45 focus-within:bg-white/[0.08]"
      >
        <textarea
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={1}
          disabled={thinking}
          placeholder="Answer as you would out loud…"
          className="max-h-40 w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-7 text-cream outline-none placeholder:text-cream/25 disabled:opacity-50"
        />

        <div className="flex items-center gap-4 px-4 pb-3.5 pt-1">
          <AnswerTimer startedAt={answerStartedAt} />
          <button
            type="submit"
            disabled={thinking || draft.trim().length === 0}
            aria-label="Send answer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cream bg-cream text-blueprint transition hover:bg-white disabled:cursor-not-allowed disabled:border-cream/20 disabled:bg-transparent disabled:text-cream/25"
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

/** Mirrors the watchdog thresholds so the pressure is visible while answering. */
function AnswerTimer({ startedAt }: { startedAt: number | null }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startedAt === null) {
      setElapsedMs(0);
      return;
    }

    setElapsedMs(Date.now() - startedAt);
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 400);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  if (startedAt === null) {
    return (
      <p className="flex-1 font-mono text-[11px] text-cream/25">
        Enter to send · Shift+Enter for a new line
      </p>
    );
  }

  const warn = elapsedMs >= SOFT_INTERRUPT_MS;
  const critical = elapsedMs >= HARD_INTERRUPT_MS;

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-cream/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            critical ? "bg-[#dd5f5f]" : warn ? "bg-[#e0a13c]" : "bg-cream/40"
          }`}
          style={{ width: `${Math.min(100, (elapsedMs / HARD_INTERRUPT_MS) * 100)}%` }}
        />
      </div>
      <span
        className={`font-mono text-[11px] tabular-nums ${
          critical ? "text-[#ff9a9a]" : warn ? "text-[#ffcf8a]" : "text-cream/35"
        }`}
      >
        {Math.round(elapsedMs / 1000)}s
      </span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint relative h-screen overflow-hidden px-5 sm:px-8">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[46rem] flex-col pt-6">
        {children}
      </div>
    </main>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
