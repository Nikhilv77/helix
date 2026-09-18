"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Volume2,
  VolumeX
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DsaCodeEditor } from "@/features/interviews/ui/dsa/dsa-code-editor";
import type { DsaEditorLanguage } from "@/features/interviews/ui/dsa/dsa-code-editor";
import { PracticeLanguagePicker } from "@/features/practice/dsa/ui/practice-language-picker";
import type { DsaRunResult } from "@/features/interviews/ui/voice/types";
import { VoiceShell } from "@/features/interviews/ui/voice/components/session-state";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import {
  ApiClientError,
  getSession,
  submitAnswer
} from "@/lib/api/api-client";
import type { InterviewQuestion, SessionResponse, Turn } from "@/lib/shared/types";
import type { WorkspaceAccent } from "@/lib/workspace/accent";

const LANGUAGES: Array<{ id: DsaEditorLanguage; label: string }> = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" }
];

export function CoreTechnicalBlockAssessmentClient({
  sessionId,
  workspaceAccent
}: {
  sessionId: string;
  workspaceAccent: WorkspaceAccent;
}) {
  const teacher = useWorkspaceTeacher();
  const voice = useMayaVoice();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [language, setLanguage] = useState<DsaEditorLanguage>("javascript");
  const [drafts, setDrafts] = useState<Record<DsaEditorLanguage, string>>({
    javascript: "",
    python: "",
    cpp: "",
    java: ""
  });
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DsaRunResult | null>(null);
  const [lastRunCode, setLastRunCode] = useState<string | null>(null);
  const [runGuidance, setRunGuidance] = useState<string | null>(null);
  const [skipConfirmationVisible, setSkipConfirmationVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const questionStartedAt = useRef(Date.now());
  const lastQuestionIndex = useRef<number | null>(null);
  const spoken = useRef(new Set<string>());

  const poll = useCallback(async () => {
    try {
      const next = await getSession(sessionId);
      setSession(next);
      setError(null);
    } catch (caught) {
      const message =
        caught instanceof ApiClientError && caught.code === "SESSION_NOT_FOUND"
          ? "This assessment session could not be found."
          : caught instanceof Error
            ? caught.message
            : "The assessment could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentQuestion = session?.currentQuestion ?? null;
  const currentIndex = session?.questionIndex ?? 0;
  const transfer = currentQuestion?.dsaTransferQuestion ?? null;
  const isCode =
    currentQuestion?.kind === "code" ||
    currentQuestion?.stage === "code" ||
    Boolean(currentQuestion?.codeTask) ||
    Boolean(transfer);

  useEffect(() => {
    if (!session || lastQuestionIndex.current === currentIndex) return;
    lastQuestionIndex.current = currentIndex;
    questionStartedAt.current = Date.now();
    setSelectedOption(null);
    setNotes("");
    setRunResult(null);
    setLastRunCode(null);
    setRunGuidance(null);
    setSkipConfirmationVisible(false);
  }, [currentIndex, session]);

  useEffect(() => {
    if (transfer) {
      const defaultJs =
        transfer.starterCode.javascript?.trim() ||
        `/**
 * Core Technical Mechanism Repair
 * Implement a clean, non-blocking repair satisfying the boundary constraints.
 */
function solution(input) {
  // Your implementation here
  return input;
}

module.exports = { solution };
`;
      setDrafts({
        javascript: defaultJs,
        python: transfer.starterCode.python ?? "",
        cpp: transfer.starterCode.cpp ?? "",
        java: transfer.starterCode.java ?? ""
      });
    } else if (currentQuestion?.codeSnippet) {
      setDrafts((prev) => ({
        ...prev,
        javascript: currentQuestion.codeSnippet ?? ""
      }));
    }
  }, [transfer?.slug, currentQuestion?.codeSnippet]);

  const guidanceTurns = useMemo(
    () => session?.turns.filter((turn) => turn.speaker === "agent") ?? [],
    [session?.turns]
  );
  const latestGuidance = guidanceTurns.at(-1) ?? null;

  useEffect(() => {
    if (!latestGuidance) return;
    const key = turnKey(latestGuidance);
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    void voice.speak(latestGuidance.text, teacher.id, { delivery: "quality" });
  }, [latestGuidance, teacher.id, voice.speak]);

  const submitMcq = async () => {
    if (!session || !selectedOption || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitAnswer({
        sessionId,
        userAnswer: selectedOption,
        startMs: relativeMs(session.startedAt, questionStartedAt.current),
        endMs: relativeMs(session.startedAt, Date.now()),
        submissionSource: "workspace"
      });
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That answer could not be saved.");
    } finally {
      setSending(false);
    }
  };

  const runCode = async () => {
    const code = drafts[language];
    if (!session || !code.trim() || running) return;
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          stdin: "",
          sessionId,
          questionIndex: session.questionIndex
        })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: DsaRunResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "The code runner could not run this solution.");
      }
      setRunResult(payload.data);
      setLastRunCode(code);
      const passed = payload.data.tests.filter((test) => test.passed).length;
      const cue = payload.data.accepted
        ? `I can see your run. All ${payload.data.tests.length} tests passed. Check your boundary edge cases and submit when you are ready.`
        : `I can see the output. ${passed} of ${payload.data.tests.length} tests passed. Review the failing case and try again.`;
      setRunGuidance(cue);
      void voice.speak(cue, teacher.id, { delivery: "quality" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be run.");
    } finally {
      setRunning(false);
    }
  };

  const submitCode = async () => {
    const code = drafts[language];
    if (!session || !code.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitAnswer({
        sessionId,
        userAnswer: code,
        startMs: relativeMs(session.startedAt, questionStartedAt.current),
        endMs: relativeMs(session.startedAt, Date.now()),
        submissionSource: "workspace"
      });
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your solution could not be submitted.");
    } finally {
      setSending(false);
    }
  };

  const skipCode = async () => {
    if (!session || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitAnswer({
        sessionId,
        userAnswer: "// Skipped by candidate",
        startMs: relativeMs(session.startedAt, questionStartedAt.current),
        endMs: relativeMs(session.startedAt, Date.now()),
        submissionSource: "workspace"
      });
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be skipped.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <AssessmentState message="Preparing your Core Technical assessment…" />;
  }

  if (error && !session) {
    return <AssessmentState message={error} error />;
  }

  if (!session) {
    return <AssessmentState message="That assessment could not be found." error />;
  }

  const durationMs = (session.setup.durationMinutes ?? 30) * 60_000;
  const elapsedMs = Math.max(0, now - session.startedAt);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const isDone = session.phase === "done";
  const questionCount = session.questionCount ?? 5;
  const currentCode = drafts[language];
  const codeChangedAfterRun = Boolean(lastRunCode && lastRunCode !== currentCode);

  return (
    <VoiceShell workspaceAccent={workspaceAccent} wide>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
        <header className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-white/[0.075] bg-[#0d0f11] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/practice/core-technical"
              aria-label="Leave assessment"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] text-cream/52 transition hover:bg-white/[0.05] hover:text-cream"
            >
              <ArrowLeft size={16} />
            </Link>
            <p className="truncate text-sm font-semibold text-cream">
              {session.setup.templateTitle ?? "Core Technical Mastery Checkpoint"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ProgressRail
              index={Math.min(currentIndex, questionCount - 1)}
              count={questionCount}
              done={isDone}
            />
            <div className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 font-mono text-sm tabular-nums text-cream/75">
              <Clock3 size={13} className="text-[var(--workspace-accent)]" />
              {formatClock(remainingMs)}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <TeacherRail
            teacherName={teacher.name}
            turns={guidanceTurns}
            latest={latestGuidance}
            runGuidance={runGuidance}
            voiceState={voice.state}
            awaitingGesture={voice.awaitingGesture}
            onReplay={() => {
              const line = runGuidance ?? latestGuidance?.text;
              if (line) void voice.speak(line, teacher.id, { delivery: "quality" });
            }}
          />

          <section className="thin-scroll min-h-0 overflow-y-auto">
            {isDone ? (
              <CompletionPanel teacherName={teacher.name} />
            ) : isCode && currentQuestion ? (
              <CodeCheckpoint
                question={currentQuestion}
                language={language}
                code={currentCode}
                notes={notes}
                running={running}
                sending={sending}
                result={runResult}
                codeChangedAfterRun={codeChangedAfterRun}
                canSubmit={Boolean(lastRunCode && lastRunCode === currentCode)}
                error={error}
                onLanguageChange={setLanguage}
                onCodeChange={(value) =>
                  setDrafts((current) => ({ ...current, [language]: value }))
                }
                onNotesChange={setNotes}
                onRun={() => void runCode()}
                onSubmit={() => void submitCode()}
                skipConfirmationVisible={skipConfirmationVisible}
                onShowSkipConfirmation={() => setSkipConfirmationVisible(true)}
                onHideSkipConfirmation={() => setSkipConfirmationVisible(false)}
                onSkip={() => void skipCode()}
              />
            ) : currentQuestion ? (
              <ReviewCheckpoint
                question={currentQuestion}
                index={currentIndex}
                count={questionCount}
                selected={selectedOption}
                sending={sending}
                error={error}
                onSelect={setSelectedOption}
                onSubmit={() => void submitMcq()}
              />
            ) : (
              <AssessmentState message="Preparing the next question…" />
            )}
          </section>
        </div>
      </div>
    </VoiceShell>
  );
}

function TeacherRail({
  teacherName,
  turns,
  latest,
  runGuidance,
  voiceState,
  awaitingGesture,
  onReplay
}: {
  teacherName: string;
  turns: Turn[];
  latest: Turn | null;
  runGuidance: string | null;
  voiceState: string;
  awaitingGesture: boolean;
  onReplay: () => void;
}) {
  return (
    <aside className="flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-white/[0.075] bg-[#0d0f11] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:min-h-0">
      <div className="relative h-40 shrink-0 overflow-hidden border-b border-white/[0.055] bg-black/20">
        <div className="absolute inset-x-[-22%] bottom-[-10%] top-0">
          <MayaStage
            speaking={voiceState === "speaking"}
            transparent
            performanceProfile="practice"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(13,15,17,0.88)_100%)]" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/45 px-2.5 py-1.5 text-[11px] font-medium text-cream/76 backdrop-blur-xl">
            <span
              className={`h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] ${voiceState === "speaking" ? "animate-pulse" : ""}`}
            />
            {teacherName}
          </div>
          <button
            type="button"
            onClick={onReplay}
            disabled={!latest || voiceState === "loading"}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.07] bg-black/45 text-cream/55 backdrop-blur-xl transition hover:text-cream disabled:opacity-30"
            aria-label={awaitingGesture ? "Play teacher guidance" : "Replay latest guidance"}
          >
            {voiceState === "unavailable" ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>
      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {turns.slice(runGuidance ? -3 : -4).map((turn, index, visibleTurns) => (
          <div
            key={turnKey(turn)}
            className={`${index === visibleTurns.length - 1 && !runGuidance ? "opacity-100" : "opacity-40"} ${index ? "border-t border-white/[0.05] pt-3" : ""}`}
          >
            <p className="text-sm leading-relaxed text-cream/80">{turn.text}</p>
          </div>
        ))}
        {runGuidance ? (
          <div className="border-t border-white/[0.05] pt-3">
            <p className="text-sm leading-relaxed text-cream/80">{runGuidance}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ReviewCheckpoint({
  question,
  index,
  count,
  selected,
  sending,
  error,
  onSelect,
  onSubmit
}: {
  question: InterviewQuestion;
  index: number;
  count: number;
  selected: string | null;
  sending: boolean;
  error: string | null;
  onSelect: (option: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="grid h-full min-h-[38rem] overflow-hidden rounded-2xl border border-white/[0.075] bg-[#111215] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]">
      <ReviewReference question={question} />

      <div className="thin-scroll flex min-h-[34rem] flex-col overflow-y-auto border-t border-white/[0.06] px-6 py-7 sm:px-8 lg:px-9 xl:border-l xl:border-t-0">
        <div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
              Mechanism Check
            </p>
            <span className="font-mono text-sm tabular-nums text-cream/50">
              {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
          </div>
          {error ? <p className="mt-3 text-sm text-[#ffb4b4]">{error}</p> : null}
          <h1 className="mt-4 text-balance font-display text-[1.22rem] font-semibold leading-[1.32] tracking-[-0.02em] text-cream lg:text-[1.35rem]">
            {renderInlineMarkdown(question.text)}
          </h1>
        </div>

        <div className="mt-6 space-y-3">
          {(question.options ?? []).map((option, optionIndex) => {
            const active = selected === option;
            return (
              <ReviewOption
                key={option}
                option={option}
                optionIndex={optionIndex}
                active={active}
                onSelect={onSelect}
              />
            );
          })}
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/[0.06] pt-5">
          <p className="max-w-xl text-sm leading-relaxed text-cream/50">
            Select the mechanism reasoning you would defend in a technical interview.
          </p>
          <ReviewSubmitButton selected={selected} sending={sending} onSubmit={onSubmit} />
        </div>
      </div>
    </section>
  );
}

function MonacoCodeCard({
  code,
  language = "javascript",
  label = "JavaScript"
}: {
  code: string;
  language?: string;
  label?: string;
}) {
  const lineCount = Math.max(1, code.trim().split("\n").length);
  const height = Math.min(360, Math.max(120, lineCount * 23 + 28));

  const editorLang: DsaEditorLanguage =
    language.toLowerCase().includes("py") ? "python"
    : language.toLowerCase().includes("cpp") || language.toLowerCase().includes("c++") ? "cpp"
    : language.toLowerCase().includes("java") ? "java"
    : "javascript";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0d10] shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div style={{ height }}>
        <DsaCodeEditor
          language={editorLang}
          value={code.trim()}
          readOnly
          autoFocus={false}
          wordWrap="on"
          ariaLabel={`${label} code excerpt in Monaco`}
        />
      </div>
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const pattern = /(`[^`]+`|'[a-zA-Z0-9_$.]+(?:\(\))?')/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isBacktick = part.startsWith("`") && part.endsWith("`") && part.length > 2;
    const isSingleQuoted = part.startsWith("'") && part.endsWith("'") && part.length > 2;

    if (isBacktick || isSingleQuoted) {
      const code = part.slice(1, -1);
      return (
        <code
          key={index}
          className="rounded-md border border-white/[0.09] bg-[#14161a] px-1.5 py-0.5 font-mono text-[13px] font-medium text-[var(--workspace-accent)]"
        >
          {code}
        </code>
      );
    }
    return part;
  });
}

function RichMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks: Array<{ kind: "code"; code: string; language: string } | { kind: "prose"; text: string }> = [];
  const fence = /```\s*([^\s`\n]*)\s*\n([\s\S]*?)```/g;
  let cursor = 0;

  for (const match of text.matchAll(fence)) {
    const index = match.index ?? 0;
    const prose = text.slice(cursor, index);
    if (prose.trim()) blocks.push({ kind: "prose", text: prose });
    blocks.push({
      kind: "code",
      language: match[1]?.trim() || "javascript",
      code: (match[2] ?? "").replace(/^\n+|\n+$/g, "")
    });
    cursor = index + match[0].length;
  }

  const remainder = text.slice(cursor);
  if (remainder.trim()) blocks.push({ kind: "prose", text: remainder });

  if (blocks.length === 0) {
    blocks.push({ kind: "prose", text });
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.kind === "code") {
          return (
            <MonacoCodeCard
              key={`block-${idx}-${block.code.length}`}
              code={block.code}
              language={block.language}
              label={block.language || "Code"}
            />
          );
        }

        const paragraphs = block.text.split(/\n\n+/).filter(Boolean);
        return (
          <div key={`prose-${idx}`} className="space-y-3">
            {paragraphs.map((para, pIdx) => (
              <p key={`p-${pIdx}`} className="whitespace-pre-wrap leading-7 text-cream/75">
                {renderInlineMarkdown(para)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ReviewReference({ question }: { question: InterviewQuestion }) {
  const reference = question.dsaReviewContext;
  const example = reference?.examples?.[0];
  const codeSnippet = question.codeSnippet;

  return (
    <article className="thin-scroll min-h-0 overflow-y-auto bg-[#0f1113] p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
          Governing Runtime Mechanism
        </p>
        {reference?.difficulty ? (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-cream/45">
            {reference.difficulty}
          </span>
        ) : null}
      </div>

      <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em] text-cream">
        {reference?.title ?? question.evidenceAnchor ?? "Mechanism Reference"}
      </h2>

      {/* Problem Scenario & Context with Markdown parsing */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-cream/85">System Context & Scenario</h3>
        <RichMarkdown
          text={
            reference?.problemStatement ??
            question.codeTask ??
            "Review the governing runtime mechanisms and system state before answering."
          }
        />
      </section>

      {/* Code Evidence in Monaco style */}
      {codeSnippet ? (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cream/85">Code Evidence</h3>
            <span className="font-mono text-xs text-cream/45">JavaScript</span>
          </div>
          <MonacoCodeCard code={codeSnippet} language="javascript" label="Code Evidence" />
        </section>
      ) : null}

      {/* Concrete Invariant Example in Monaco Inspector style */}
      {example ? (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-cream/85">Concrete Invariant Example</h3>
          <div className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0d10] p-3.5 font-mono text-sm leading-6 space-y-2 shadow-sm">
            <div className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
                <span className="select-none pt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--workspace-accent)]">
                  Action
                </span>
                <code className="flex-1 break-words font-mono text-sm text-cream/90">
                  {example.input}
                </code>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
                <span className="select-none pt-0.5 text-xs font-semibold uppercase tracking-wider text-cream/45">
                  State
                </span>
                <code className="flex-1 break-words font-mono text-sm text-cream/90">
                  {example.output}
                </code>
              </div>
            {example.explanation ? (
              <div className="border-t border-white/[0.05] bg-black/15 px-3.5 py-2.5 font-sans text-sm leading-relaxed text-cream/65">
                {renderInlineMarkdown(example.explanation)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Runtime Constraints & Invariants */}
      {reference?.constraints?.length ? (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-cream/85">Runtime Constraints & Invariants</h3>
          <ul className="space-y-2.5">
            {reference.constraints.map((constraint) => (
              <li key={constraint} className="flex items-start gap-2.5">
                <span className="select-none pt-0.5 text-[var(--workspace-accent)]">•</span>
                <span className="flex-1 break-words font-sans text-sm leading-relaxed text-cream/75">
                  {renderInlineMarkdown(constraint)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function ReviewOption({
  option,
  optionIndex,
  active,
  onSelect
}: {
  option: string;
  optionIndex: number;
  active: boolean;
  onSelect: (option: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`group relative flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition ${
        active
          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold transition ${
          active
            ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-[#090a0b]"
            : "border-white/20 text-cream/60 group-hover:border-white/40"
        }`}
      >
        {String.fromCharCode(65 + optionIndex)}
      </span>
      <span className="text-sm font-medium leading-6 text-cream/90">{renderInlineMarkdown(option)}</span>
    </button>
  );
}

function ReviewSubmitButton({
  selected,
  sending,
  onSubmit
}: {
  selected: string | null;
  sending: boolean;
  onSubmit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!selected || sending}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-[#090a0b] transition hover:bg-white disabled:opacity-35"
    >
      {sending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
      {sending ? "Saving" : "Submit"}
    </button>
  );
}

function CodeCheckpoint({
  question,
  language,
  code,
  notes,
  running,
  sending,
  result,
  codeChangedAfterRun,
  canSubmit,
  error,
  onLanguageChange,
  onCodeChange,
  onNotesChange,
  onRun,
  onSubmit,
  skipConfirmationVisible,
  onShowSkipConfirmation,
  onHideSkipConfirmation,
  onSkip
}: {
  question: InterviewQuestion;
  language: DsaEditorLanguage;
  code: string;
  notes: string;
  running: boolean;
  sending: boolean;
  result: DsaRunResult | null;
  codeChangedAfterRun: boolean;
  canSubmit: boolean;
  error: string | null;
  onLanguageChange: (lang: DsaEditorLanguage) => void;
  onCodeChange: (code: string) => void;
  onNotesChange: (notes: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  skipConfirmationVisible: boolean;
  onShowSkipConfirmation: () => void;
  onHideSkipConfirmation: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="grid h-full min-h-[38rem] gap-3 xl:grid-cols-[minmax(20rem,0.92fr)_minmax(0,1.08fr)]">
      <article className="thin-scroll flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-white/[0.075] bg-[#111215] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
          Practical Transfer Implementation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-cream">
          {question.dsaTransferQuestion?.title ?? "Transfer Mechanism Repair"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-cream/60">
          <span className="capitalize">{question.dsaTransferQuestion?.difficulty ?? "Intermediate"}</span>
          <span>•</span>
          <span className="capitalize">
            {(question.dsaTransferQuestion?.primaryPattern ?? "Runtime resilience").replaceAll("-", " ")}
          </span>
          <span>•</span>
          <span>{question.dsaTransferQuestion?.expectedTimeMinutes ?? 10} min</span>
        </div>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-cream/85">Problem Description</h2>
          <RichMarkdown
            text={question.dsaTransferQuestion?.problemStatement ?? question.codeTask ?? question.text}
          />
        </section>

        {question.dsaTransferQuestion?.examples?.length ? (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-cream/85">Examples & Invariants</h2>
            <div className="space-y-2.5">
              {question.dsaTransferQuestion.examples.map((example, index) => (
                <div
                  key={`${example.input}-${index}`}
                  className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0d10] shadow-sm"
                >
                  <div className="space-y-2 p-3.5 font-mono text-sm leading-6">
                    <div className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
                      <span className="select-none pt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--workspace-accent)]">
                        Input
                      </span>
                      <code className="flex-1 break-words font-mono text-sm text-cream/90">
                        {example.input}
                      </code>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
                      <span className="select-none pt-0.5 text-xs font-semibold uppercase tracking-wider text-cream/45">
                        Output
                      </span>
                      <code className="flex-1 break-words font-mono text-sm text-cream/90">
                        {example.output}
                      </code>
                    </div>
                  </div>
                  {example.explanation ? (
                    <div className="border-t border-white/[0.05] bg-black/15 px-3.5 py-2.5 font-sans text-sm leading-relaxed text-cream/65">
                      {renderInlineMarkdown(example.explanation)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {question.dsaTransferQuestion?.constraints?.length ? (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-cream/85">Constraints & Edge Cases</h2>
            <ul className="space-y-2.5 font-mono text-sm leading-6 text-cream/70">
              {question.dsaTransferQuestion.constraints.map((constraint) => (
                <li key={constraint} className="flex items-start gap-2.5">
                  <span className="select-none pt-0.5 text-[var(--workspace-accent)]">•</span>
                  <span className="flex-1 break-words font-sans text-sm leading-relaxed text-cream/75">
                    {renderInlineMarkdown(constraint)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-auto pt-6">
          <label htmlFor="checkpoint-notes" className="block text-sm font-semibold text-cream/70">
            Notes / Assumptions
          </label>
          <textarea
            id="checkpoint-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Document runtime trade-offs or assumptions..."
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.06] bg-black/25 p-3.5 text-sm leading-6 text-cream/85 outline-none placeholder:text-cream/30 focus:border-[var(--workspace-accent)]"
          />
        </div>
      </article>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.075] bg-[#111215] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
        <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/20 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-cream">
            <Code2 size={15} className="text-[var(--workspace-accent)]" />
            <span>Solution</span>
          </div>
          <div className="flex items-center gap-2.5">
            <PracticeLanguagePicker
              value={language}
              options={LANGUAGES.map((lang) => ({ value: lang.id, label: lang.label }))}
              onChange={onLanguageChange}
            />
            <button
              type="button"
              onClick={onRun}
              disabled={running || !code.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--workspace-accent)] px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? (
                <Loader2 size={14} className="animate-spin text-[#0a0a0b]" aria-hidden="true" />
              ) : (
                <Play size={14} className="fill-transparent stroke-[2.4]" aria-hidden="true" />
              )}
              {running ? "Running" : "Run code"}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#0b0d10]">
          <DsaCodeEditor
            language={language}
            value={code}
            onChange={onCodeChange}
            onRun={onRun}
            ariaLabel="Core Technical implementation workspace"
          />
        </div>

        <ResultPanel result={result} running={running} stale={codeChangedAfterRun} />

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!skipConfirmationVisible ? (
              <button
                type="button"
                onClick={onShowSkipConfirmation}
                disabled={sending}
                className="text-sm font-semibold text-cream/45 transition hover:text-cream/75"
              >
                I can’t solve this
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-cream/46">This records 0 points.</span>
                <button
                  type="button"
                  onClick={onHideSkipConfirmation}
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-cream/60 hover:bg-white/[0.04]"
                >
                  Keep trying
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={sending}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-2 text-xs font-semibold text-cream hover:bg-white/[0.1]"
                >
                  Skip
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <p className="hidden text-[11px] text-cream/35 sm:block">
                {canSubmit
                  ? "Latest code run will be used as evidence"
                  : "Run the code before submitting"}
              </p>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || sending}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-[#090a0b] disabled:opacity-35"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {sending ? "Evaluating" : "Submit solution"}
              </button>
            </div>
          </div>
          {error ? <p className="mt-2 text-sm text-[#ffb4b4]">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}

function ResultPanel({
  result,
  running,
  stale
}: {
  result: DsaRunResult | null;
  running: boolean;
  stale: boolean;
}) {
  return (
    <div className="max-h-56 overflow-y-auto border-t border-white/[0.06] bg-black/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-cream/68">Test Evidence</p>
        <p
          className={`text-[11px] font-semibold ${
            result?.accepted && !stale ? "text-[var(--workspace-accent)]" : "text-cream/38"
          }`}
        >
          {running
            ? "Running…"
            : stale
              ? "Code changed · run again"
              : result
                ? result.status
                : "Not run yet"}
        </p>
      </div>
      {result?.compileOutput || result?.stderr ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#5c2222]/20 p-3 font-mono text-xs leading-5 text-[#ffb4b4]">
          {result.compileOutput || result.stderr}
        </pre>
      ) : null}
      {result?.tests.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.tests.map((test) => (
            <div key={test.index} className="rounded-lg bg-white/[0.025] p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-cream/56">Case {test.index + 1}</span>
                <span className={test.passed ? "text-[var(--workspace-accent)]" : "text-[#ffb4b4]"}>
                  {test.passed ? "Passed" : "Failed"}
                </span>
              </div>
              {!test.passed ? (
                <p className="mt-2 break-words font-mono leading-5 text-cream/44">
                  Expected {test.expectedOutput}; received {test.error || test.actualOutput || "no output"}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompletionPanel({ teacherName }: { teacherName: string }) {
  return (
    <div className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--workspace-accent-border)] bg-[color:var(--workspace-accent-muted)] text-[var(--workspace-accent)]">
          <CheckCircle2 size={30} />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
          Checkpoint Complete
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] text-cream">
          Nice work—you finished the checkpoint
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-cream/52">
          {teacherName} has scored your mechanisms, edge-case defences, and implementation. Your
          feedback and next adaptive block are waiting in your practice overview.
        </p>
        <Link
          href="/practice/core-technical"
          className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#090a0b]"
        >
          View results <ChevronRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function ProgressRail({ index, count, done }: { index: number; count: number; done: boolean }) {
  return (
    <div
      className="hidden items-center gap-1.5 sm:flex"
      aria-label={`Question ${Math.min(index + 1, count)} of ${count}`}
    >
      {Array.from({ length: count }, (_, item) => (
        <span
          key={item}
          className={`h-1.5 rounded-full transition-all ${
            done || item < index
              ? "w-4 bg-[var(--workspace-accent)]"
              : item === index
                ? "w-7 bg-[var(--workspace-accent)]"
                : "w-3 bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function AssessmentState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <main className="fixed inset-0 z-[100] grid place-items-center bg-black p-6 text-center">
      <div>
        <Loader2
          size={22}
          className={`mx-auto ${error ? "hidden" : "animate-spin text-[var(--workspace-accent)]"}`}
        />
        <p className={`mt-4 text-sm ${error ? "text-[#ffb4b4]" : "text-cream/52"}`}>{message}</p>
        {error ? (
          <Link
            href="/practice/core-technical"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cream"
          >
            <RotateCcw size={14} />
            Return to practice
          </Link>
        ) : null}
      </div>
    </main>
  );
}

function relativeMs(startedAt: number, value: number): number {
  return Math.max(0, Math.round(value - startedAt));
}

function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function turnKey(turn: Turn): string {
  return `${turn.startMs}:${turn.endMs}:${turn.text}`;
}

