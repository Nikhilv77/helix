"use client";

import { BackLinkIcon } from "@/components/workspace/shared/back-link-icon";
import { pickLine, TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { blockAssessmentMoment } from "@/features/practice/dsa/domain/block-assessment-speech";
import Link from "next/link";
import {
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
  skipDsaBlockAssessmentCode,
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

export function DsaBlockAssessmentClient({
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
  /** What the teacher last said aloud, for the replay button. */
  const lastSpoken = useRef<string | null>(null);
  const latestSessionRead = useRef(0);
  const activeSessionReads = useRef(0);
  const lastSessionReadAt = useRef(0);

  const poll = useCallback(async () => {
    const readId = ++latestSessionRead.current;
    activeSessionReads.current += 1;
    lastSessionReadAt.current = Date.now();
    try {
      const next = await getSession(sessionId);
      if (next.setup.dsaBlockAssessment?.kind !== "dsa-block-assessment") {
        throw new Error("This session is not a DSA block assessment.");
      }
      if (readId !== latestSessionRead.current) return;
      setSession(next);
      setError(null);
    } catch (caught) {
      if (readId !== latestSessionRead.current) return;
      const message =
        caught instanceof ApiClientError && caught.code === "SESSION_NOT_FOUND"
          ? "This assessment session could not be found."
          : caught instanceof Error
            ? caught.message
            : "The assessment could not be loaded.";
      setError(message);
    } finally {
      activeSessionReads.current -= 1;
      if (readId === latestSessionRead.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void poll();
    return () => {
      latestSessionRead.current += 1;
    };
  }, [poll]);

  useEffect(() => {
    if (session?.phase === "done" || sending) return;
    const onReturn = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      if (activeSessionReads.current > 0 || Date.now() - lastSessionReadAt.current < 1_000) return;
      void poll();
    };
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [poll, sending, session?.phase]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentQuestion = session?.currentQuestion ?? null;
  const currentIndex = session?.questionIndex ?? 0;
  const transfer = currentQuestion?.dsaTransferQuestion ?? null;

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
    if (!transfer) return;
    setDrafts({
      javascript: transfer.starterCode.javascript ?? "",
      python: transfer.starterCode.python ?? "",
      cpp: transfer.starterCode.cpp ?? "",
      java: transfer.starterCode.java ?? ""
    });
  }, [transfer?.slug]);

  const guidanceTurns = useMemo(
    () => session?.turns.filter((turn) => turn.speaker === "agent") ?? [],
    [session?.turns]
  );
  const latestGuidance = guidanceTurns.at(-1) ?? null;

  const speak = useCallback(
    (line: string) => {
      lastSpoken.current = line;
      void voice.speak(line, teacher.id, { delivery: "quality" });
    },
    [teacher.id, voice.speak]
  );

  // The screen shows the full guidance. Aloud, a pre-recorded line gives the
  // verdict and what comes next, so it starts at once and costs nothing.
  useEffect(() => {
    if (!session || !latestGuidance) return;
    const key = turnKey(latestGuidance);
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    const moment = blockAssessmentMoment(session.turns, session.turns.lastIndexOf(latestGuidance), {
      done: session.phase === "done",
      kind: session.currentQuestion?.kind ?? null
    });
    speak(moment ? pickLine(TEACHER_LINES.blockAssessment[moment]) : latestGuidance.text);
  }, [latestGuidance, session, speak]);

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
        ? `I can see your run. All ${payload.data.tests.length} tests passed. Add your reasoning and submit when you are ready.`
        : `I can see the output. ${passed} of ${payload.data.tests.length} tests passed. Review the failing case and try again.`;
      setRunGuidance(cue);
      // The exact counts are on screen; the spoken cue is pre-recorded.
      speak(
        pickLine(
          payload.data.accepted
            ? TEACHER_LINES.assessmentRun.passed
            : TEACHER_LINES.assessmentRun.failed
        )
      );
    } catch (caught) {
      setLastRunCode(null);
      setError(caught instanceof Error ? caught.message : "Code execution failed.");
    } finally {
      setRunning(false);
    }
  };

  const submitCode = async () => {
    if (!session || sending || !lastRunCode || lastRunCode !== drafts[language]) return;
    const code = drafts[language];
    const explanation = notes.trim() || "I implemented the approach shown in the submitted code.";
    setSending(true);
    setError(null);
    setRunGuidance(null);
    try {
      await submitAnswer({
        sessionId,
        userAnswer: `\`\`\`${language}\n${code}\n\`\`\`\n\nReasoning and complexity: ${explanation}`,
        startMs: relativeMs(session.startedAt, questionStartedAt.current),
        endMs: relativeMs(session.startedAt, Date.now()),
        submissionSource: "workspace"
      });
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The solution could not be submitted.");
    } finally {
      setSending(false);
    }
  };

  const skipCode = async () => {
    if (!session || sending) return;
    setSending(true);
    setError(null);
    try {
      await skipDsaBlockAssessmentCode({
        sessionId,
        startMs: relativeMs(session.startedAt, questionStartedAt.current),
        endMs: relativeMs(session.startedAt, Date.now())
      });
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The question could not be skipped.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <AssessmentState message="Preparing your checkpoint…" />;
  if (!session) return <AssessmentState message={error ?? "Assessment unavailable."} error />;

  const durationMs = (session.setup.durationMinutes ?? 25) * 60_000;
  const elapsedMs = Math.max(0, now - session.startedAt);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const isDone = session.phase === "done";
  const isCode = currentQuestion?.kind === "code" && Boolean(transfer);
  const currentCode = drafts[language];
  const codeChangedAfterRun = lastRunCode !== null && lastRunCode !== currentCode;

  return (
    <VoiceShell workspaceAccent={workspaceAccent} wide>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
        <header className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-white/[0.075] bg-[#0d0f11] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/practice/dsa"
              aria-label="Leave assessment"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] text-cream/52 transition hover:bg-white/[0.05] hover:text-cream"
            >
              <BackLinkIcon size={16} />
            </Link>
            <p className="truncate text-sm font-semibold text-cream">Block mastery checkpoint</p>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRail
              index={Math.min(currentIndex, session.questionCount - 1)}
              count={session.questionCount}
              done={isDone}
            />
            <div className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 font-mono text-xs tabular-nums text-cream/68">
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
              if (lastSpoken.current) speak(lastSpoken.current);
            }}
          />

          <section className="thin-scroll min-h-0 overflow-y-auto">
            {isDone ? (
              <CompletionPanel teacherName={teacher.name} />
            ) : isCode && transfer && currentQuestion ? (
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
                count={session.stages?.filter((stage) => stage === "rapid").length ?? 5}
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
            <p className="text-[13px] leading-6 text-cream/72">{turn.text}</p>
          </div>
        ))}
        {runGuidance ? (
          <div className="border-t border-white/[0.05] pt-3">
            <p className="text-[13px] leading-6 text-cream/72">{runGuidance}</p>
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
  const hasCode = Boolean(question.codeSnippet);

  if (!hasCode) {
    return (
      <section className="grid h-full min-h-[38rem] overflow-hidden rounded-2xl border border-white/[0.075] bg-[#111215] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] xl:grid-cols-[minmax(20rem,0.88fr)_minmax(24rem,1.12fr)]">
        <ReviewReference question={question} />

        <div className="flex min-h-[34rem] flex-col border-t border-white/[0.06] px-6 py-7 sm:px-8 lg:px-9 xl:border-l xl:border-t-0">
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
                Knowledge check
              </p>
              <span className="font-mono text-xs tabular-nums text-cream/36">
                {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
            </div>
            <h1 className="mt-4 text-balance font-display text-[1.9rem] font-semibold leading-[1.15] tracking-[-0.03em] text-cream lg:text-[2.15rem]">
              {question.text}
            </h1>
          </div>

          <div className="mt-7 space-y-3">
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
            <p className="max-w-xl text-xs leading-5 text-cream/32">
              Choose the answer you would defend in an interview.
            </p>
            <ReviewSubmitButton selected={selected} sending={sending} onSubmit={onSubmit} />
          </div>
          {error ? <p className="mt-3 text-sm text-[#ffb4b4]">{error}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <div className="grid h-full min-h-[38rem] gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
      <section className="flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.075] bg-[#111215] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] xl:min-h-0">
        <div className="border-b border-white/[0.055] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cream/38">
            {hasCode ? "Saved solution" : "Block concept"}
          </p>
          <h2 className="mt-1 text-base font-semibold text-cream/82">
            {question.evidenceAnchor ?? "DSA foundations"}
          </h2>
        </div>
        {question.codeSnippet ? (
          <div className="min-h-0 flex-1 bg-[#0b0d10]">
            <DsaCodeEditor
              language={reviewLanguage(question.language)}
              value={question.codeSnippet}
              readOnly
              autoFocus={false}
              ariaLabel="Code excerpt from your saved solution"
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <span className="font-mono text-7xl font-semibold tabular-nums text-white/[0.055]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-4 text-sm leading-6 text-cream/42">
                Apply the pattern, complexity, and edge-case reasoning from this completed problem.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="flex min-h-[32rem] flex-col rounded-2xl border border-white/[0.075] bg-[#111215] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-6 xl:min-h-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
          Knowledge check · {index + 1} of {count}
        </p>
        <h1 className="mt-3 text-balance font-display text-[1.7rem] font-semibold leading-[1.18] tracking-[-0.028em] text-cream">
          {question.text}
        </h1>
        <div className="mt-6 space-y-2">
          {(question.options ?? []).map((option, optionIndex) => (
            <ReviewOption
              key={option}
              option={option}
              optionIndex={optionIndex}
              active={selected === option}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div className="mt-auto flex justify-end border-t border-white/[0.06] pt-4">
          <ReviewSubmitButton selected={selected} sending={sending} onSubmit={onSubmit} />
        </div>
        {error ? <p className="mt-3 text-sm text-[#ffb4b4]">{error}</p> : null}
      </section>
    </div>
  );
}

function ReviewReference({ question }: { question: InterviewQuestion }) {
  const reference = question.dsaReviewContext;
  const example = reference?.examples[0];
  return (
    <article className="thin-scroll min-h-0 overflow-y-auto bg-[#0f1113] px-6 py-7 sm:px-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
        Problem reference
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-cream">
          {reference?.title ?? question.evidenceAnchor ?? "Block problem"}
        </h2>
        {reference?.difficulty ? (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/42">
            {reference.difficulty}
          </span>
        ) : null}
      </div>
      <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-cream/62">
        {reference?.problemStatement ??
          question.codeTask ??
          "Review the original problem before answering."}
      </p>

      {example ? (
        <section className="mt-7">
          <h3 className="text-xs font-semibold text-cream/74">Example</h3>
          <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/20 p-4 font-mono text-xs leading-6">
            <p className="break-words text-cream/62">
              <span className="mr-3 text-cream/32">Input</span>
              {example.input}
            </p>
            <p className="mt-1 break-words text-cream/62">
              <span className="mr-3 text-cream/32">Output</span>
              {example.output}
            </p>
            {example.explanation ? (
              <p className="mt-3 border-t border-white/[0.05] pt-3 font-sans text-cream/42">
                {example.explanation}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {reference?.constraints.length ? (
        <section className="mt-7">
          <h3 className="text-xs font-semibold text-cream/74">Constraints</h3>
          <ul className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-cream/48">
            {reference.constraints.slice(0, 5).map((constraint) => (
              <li key={constraint}>• {constraint}</li>
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
      aria-pressed={active}
      className={`group flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${active ? "border-[color:var(--workspace-accent-border)] bg-[color:var(--workspace-accent-muted)] text-cream" : "border-white/[0.065] bg-white/[0.025] text-cream/66 hover:border-white/[0.12] hover:bg-white/[0.04]"}`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold ${active ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-[#0b0c0d]" : "border-white/[0.09] text-cream/38"}`}
      >
        {active ? <Check size={13} /> : String.fromCharCode(65 + optionIndex)}
      </span>
      <span className="text-sm leading-5">{displayAssessmentOption(option)}</span>
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
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#0a0b0c] transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
    >
      {sending ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
      {sending ? "Checking" : "Check answer"}
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
  onLanguageChange: (language: DsaEditorLanguage) => void;
  onCodeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  skipConfirmationVisible: boolean;
  onShowSkipConfirmation: () => void;
  onHideSkipConfirmation: () => void;
  onSkip: () => void;
}) {
  const transfer = question.dsaTransferQuestion!;
  return (
    <div className="grid min-h-[calc(100vh-8.5rem)] gap-3 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(30rem,1.28fr)]">
      <article className="thin-scroll overflow-y-auto rounded-2xl border border-white/[0.065] bg-[#101214] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
          Unseen transfer problem
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-cream">
          {transfer.title}
        </h1>
        <div className="mt-3 flex gap-4 text-xs capitalize text-cream/42">
          <span>{transfer.difficulty}</span>
          <span>{transfer.primaryPattern.replaceAll("-", " ")}</span>
          <span>{transfer.expectedTimeMinutes} min</span>
        </div>
        <section className="mt-7">
          <h2 className="text-sm font-semibold text-cream/82">Problem</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cream/62">
            {transfer.problemStatement ?? transfer.promptSummary}
          </p>
        </section>
        {transfer.examples.length ? (
          <section className="mt-7">
            <h2 className="text-sm font-semibold text-cream/82">Examples</h2>
            <div className="mt-3 space-y-2">
              {transfer.examples.map((example, index) => (
                <div
                  key={`${example.input}-${index}`}
                  className="rounded-xl bg-black/20 p-4 text-xs leading-6"
                >
                  <p>
                    <span className="text-cream/36">Input</span>{" "}
                    <code className="ml-2 text-cream/72">{example.input}</code>
                  </p>
                  <p>
                    <span className="text-cream/36">Output</span>{" "}
                    <code className="ml-2 text-cream/72">{example.output}</code>
                  </p>
                  {example.explanation ? (
                    <p className="mt-2 text-cream/48">{example.explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {transfer.constraints.length ? (
          <section className="mt-7">
            <h2 className="text-sm font-semibold text-cream/82">Constraints</h2>
            <ul className="mt-3 space-y-2 font-mono text-xs leading-5 text-cream/58">
              {transfer.constraints.map((constraint) => (
                <li key={constraint}>• {constraint}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <section className="flex min-h-[46rem] flex-col overflow-hidden rounded-2xl border border-white/[0.065] bg-[#101214]">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-cream">
            <Code2 size={15} className="text-[var(--workspace-accent)]" />
            Solution
          </div>
          <div className="flex items-center gap-2.5">
            <PracticeLanguagePicker
              value={language}
              options={LANGUAGES.map((item) => ({ value: item.id, label: item.label }))}
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
        <div className="min-h-72 flex-1 bg-[#0b0d10]">
          <DsaCodeEditor
            language={language}
            value={code}
            onChange={onCodeChange}
            onRun={onRun}
            ariaLabel="Assessment code editor"
          />
        </div>
        <ResultPanel result={result} running={running} stale={codeChangedAfterRun} />
        <div className="border-t border-white/[0.06] bg-black/10 p-4">
          <label htmlFor="assessment-reasoning" className="text-xs font-semibold text-cream/72">
            Approach and complexity
          </label>
          <textarea
            id="assessment-reasoning"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={3}
            placeholder="Explain the invariant, why the solution is correct, and its time and space complexity…"
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.065] bg-black/20 px-3.5 py-3 text-sm leading-6 text-cream outline-none placeholder:text-cream/25 focus:border-white/[0.13]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {!skipConfirmationVisible ? (
              <button
                type="button"
                onClick={onShowSkipConfirmation}
                disabled={sending}
                className="text-xs font-semibold text-cream/38 transition hover:text-cream/65"
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
                  : "Run the current code before submitting"}
              </p>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || sending}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#090a0b] disabled:opacity-35"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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
        <p className="text-xs font-semibold text-cream/68">Test evidence</p>
        <p
          className={`text-[11px] font-semibold ${result?.accepted && !stale ? "text-[var(--workspace-accent)]" : "text-cream/38"}`}
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
                  Expected {test.expectedOutput}; received{" "}
                  {test.error || test.actualOutput || "no output"}
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
          Checkpoint complete
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] text-cream">
          Nice work—you finished the checkpoint
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-cream/52">
          {teacherName} is preparing your results now. You’ll see what you understood well, which
          ideas need another pass, and the best problem to practise next.
        </p>
        <Link
          href="/practice/dsa"
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
          className={`h-1.5 rounded-full transition-all ${done || item < index ? "w-4 bg-[var(--workspace-accent)]" : item === index ? "w-7 bg-[var(--workspace-accent)]" : "w-3 bg-white/10"}`}
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
            href="/practice/dsa"
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

function reviewLanguage(value: string | null): DsaEditorLanguage {
  return value === "python" || value === "cpp" || value === "java" ? value : "javascript";
}

function displayAssessmentOption(option: string): string {
  const patternLabels: Record<string, string> = {
    "arrays-hashing": "Arrays & hashing",
    "two-pointers": "Two pointers",
    "sliding-window": "Sliding window",
    "binary-search": "Binary search",
    "dynamic-programming": "Dynamic programming",
    kadane: "Kadane’s algorithm",
    greedy: "Greedy"
  };
  if (patternLabels[option]) return patternLabels[option];
  if (option === "Output: (a different recorded value)") return "Output: a different value";
  if (option === "The input was not part of the saved visible run") {
    return "No result is available for this input";
  }
  return option;
}
