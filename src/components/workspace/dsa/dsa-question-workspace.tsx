"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Code2,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  XCircle
} from "lucide-react";
import {
  DsaCodeEditor,
  type DsaEditorLanguage,
  type DsaEditorSelection
} from "@/components/interview/dsa/dsa-code-editor";
import { AskSomeone } from "./ask-someone";
import { DsaTeacherFeedback, type DsaTeacherFeedbackState } from "./dsa-teacher-feedback";
import { PracticeLanguagePicker } from "./practice-language-picker";
import { dsaStarterCode, supportedDsaCodeLanguages } from "@/lib/dsa/dsa-code-templates";
import { dsaCodeDraftKey, readDsaCodeDraft, writeDsaCodeDraft } from "@/lib/dsa/code-draft";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import type { DsaQuestion } from "@/lib/dsa/dsa";

type RunTest = {
  index: number;
  visible?: boolean;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  error?: string;
  passed: boolean;
};

type RunResult = {
  accepted: boolean;
  status: string;
  compileOutput?: string;
  stderr?: string;
  stdout?: string;
  time?: string | null;
  memory?: number | null;
  tests: RunTest[];
};

const LANGUAGES: Array<{ value: DsaEditorLanguage; label: string }> = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" }
];

export function DsaQuestionWorkspace({
  question,
  initialStatus = null,
  initialLanguage = "javascript"
}: {
  question: DsaQuestion;
  initialStatus?: string | null;
  initialLanguage?: DsaEditorLanguage;
}) {
  const router = useRouter();
  const teacher = useWorkspaceTeacher();
  const [language, setLanguage] = useState<DsaEditorLanguage>(() =>
    preferredLanguageFor(question.slug, initialLanguage)
  );
  const [code, setCode] = useState(() =>
    dsaStarterCode(question, preferredLanguageFor(question.slug, initialLanguage))
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [selection, setSelection] = useState<DsaEditorSelection | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [teacherFeedback, setTeacherFeedback] = useState<DsaTeacherFeedbackState>({
    status: "idle"
  });
  const pendingRunId = useRef<string | null>(null);
  const loadedDraftKey = useRef<string | null>(null);
  const completionRecorded = useRef(initialStatus === "COMPLETED");
  const feedbackShownForQuestion = useRef(initialStatus === "COMPLETED");
  const lastAcceptedRun = useRef<{
    code: string;
    language: DsaEditorLanguage;
    testsPassed: number;
    testCount: number;
  } | null>(null);
  const feedbackSignature = useRef<string | null>(null);

  const examples = useMemo(() => question.examples?.slice(0, 10) ?? [], [question.examples]);
  const languages = useMemo(() => {
    const supported = new Set(supportedDsaCodeLanguages(question.slug));
    return LANGUAGES.filter((item) => supported.has(item.value));
  }, [question.slug]);
  // When this attempt began, so a help request can report time spent. A ref, not
  // state: it must not reset the clock on every keystroke.
  const startedAt = useRef(Date.now());

  useEffect(() => {
    completionRecorded.current = initialStatus === "COMPLETED";
    feedbackShownForQuestion.current = initialStatus === "COMPLETED";
  }, [initialStatus, question.slug]);

  useEffect(() => {
    const key = dsaCodeDraftKey(question.slug, language);
    const saved = readDsaCodeDraft(window.localStorage, question.slug, language);
    setCode(saved ?? dsaStarterCode(question, language));
    setResult(null);
    setError(null);
    setSelection(null);
    setOutputOpen(false);
    loadedDraftKey.current = key;
  }, [language, question]);

  useEffect(() => {
    const key = dsaCodeDraftKey(question.slug, language);
    if (loadedDraftKey.current !== key) return;
    const timer = window.setTimeout(() => {
      writeDsaCodeDraft(window.localStorage, question.slug, language, code);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [code, language, question.slug]);

  const failingTests = result ? result.tests.filter((test) => !test.passed).length : null;
  const testOutput = result
    ? [result.compileOutput, result.stderr, result.stdout].filter(Boolean).join("\n").trim() ||
      `${result.status}: ${failingTests} of ${result.tests.length} failing`
    : null;
  const askSomeone = (
    <AskSomeone
      slug={question.slug}
      title={question.title}
      language={language}
      code={code}
      testOutput={testOutput}
      failingTests={failingTests}
      runStatus={result?.status ?? null}
      tests={
        result?.tests.map((test) => ({
          index: test.index,
          input: test.input,
          expectedOutput: test.expectedOutput,
          actualOutput: test.actualOutput ?? "",
          passed: test.passed,
          error: test.error ?? null
        })) ?? null
      }
      selection={selection}
      startedAt={startedAt.current}
    />
  );

  function changeLanguage(nextLanguage: DsaEditorLanguage) {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setResult(null);
    setError(null);
    setOutputOpen(false);
    void saveDsaEditorLanguage(nextLanguage).catch(() => undefined);
  }

  function resetCode() {
    setCode(dsaStarterCode(question, language));
    setResult(null);
    setError(null);
    setOutputOpen(false);
  }

  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setOutputOpen(true);
    setTeacherFeedback({ status: "idle" });
    const requestId = pendingRunId.current ?? crypto.randomUUID();
    pendingRunId.current = requestId;

    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, code, language, slug: question.slug })
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: RunResult;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(
          payload?.error?.message ?? "The code runner could not execute this solution."
        );
      }

      setResult(payload.data);
      pendingRunId.current = null;
      if (payload.data.accepted && !feedbackShownForQuestion.current) {
        // One debrief belongs to the first successful solve. Subsequent runs
        // remain available for practice, without repeatedly interrupting it.
        feedbackShownForQuestion.current = true;
        const acceptedRun = {
          code,
          language,
          testsPassed: payload.data.tests.filter((test) => test.passed).length,
          testCount: payload.data.tests.length
        };
        lastAcceptedRun.current = acceptedRun;
        void requestTeacherFeedback(acceptedRun);
      }
      if (payload.data.accepted && !completionRecorded.current) {
        completionRecorded.current = true;
        void recordSolved(question.slug)
          .then(() => router.refresh())
          .catch(() => {
            completionRecorded.current = false;
          });
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Code execution failed.");
    } finally {
      setRunning(false);
    }
  }

  async function requestTeacherFeedback(run: NonNullable<typeof lastAcceptedRun.current>) {
    const signature = `${question.slug}:${run.language}:${run.code}`;
    if (feedbackSignature.current === signature) return;
    feedbackSignature.current = signature;
    setTeacherFeedback({ status: "loading", code: run.code, language: run.language });

    try {
      const response = await fetch("/api/dsa/practice-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: question.slug,
          code: run.code,
          language: run.language,
          testsPassed: run.testsPassed,
          testCount: run.testCount,
          teacherId: teacher.id
        })
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { headline: string; markdown: string; voiceScript: string; followUp: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(
          payload?.error?.message ?? "Your teacher could not review this run just now."
        );
      }
      setTeacherFeedback({
        status: "ready",
        feedback: payload.data,
        code: run.code,
        language: run.language
      });
    } catch (feedbackError) {
      feedbackSignature.current = null;
      setTeacherFeedback({
        status: "error",
        code: run.code,
        language: run.language,
        message:
          feedbackError instanceof Error
            ? feedbackError.message
            : "Your teacher could not review this run just now."
      });
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101214] xl:h-full">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[#141619] px-3 py-2 sm:px-4">
        <p className="text-[13.5px] text-cream/38 font-semibold">Need another perspective?</p>
        {askSomeone}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-cream/88">
          <Code2 size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          Solution
        </div>
        <div className="flex items-center gap-2">
          <PracticeLanguagePicker value={language} options={languages} onChange={changeLanguage} />
          <button
            type="button"
            onClick={resetCode}
            disabled={running}
            aria-label="Reset code to the starter template"
            title="Reset starter code"
            className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-cream/48 transition hover:bg-white/[0.085] hover:text-cream disabled:pointer-events-none disabled:opacity-45"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void runCode()}
            disabled={running || !code.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cream px-3.5 text-[12.5px] font-semibold text-[#171a16] transition hover:bg-white disabled:pointer-events-none disabled:opacity-45"
          >
            {running ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={13} aria-hidden="true" />
            )}
            {running ? "Running" : "Run code"}
          </button>
        </div>
      </div>

      <div className="h-[32rem] min-h-0 overflow-hidden bg-[#0b0d10] sm:h-[38rem] xl:h-auto xl:flex-1">
        <DsaCodeEditor
          language={language}
          value={code}
          onChange={setCode}
          onRun={() => void runCode()}
          onSelectionChange={setSelection}
        />
      </div>

      {outputOpen ? (
        <RunOutput examples={examples} result={result} running={running} error={error} />
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] bg-[#141619] px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setOutputOpen((open) => !open)}
          aria-expanded={outputOpen}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.05] hover:text-cream"
        >
          <FlaskConical size={13} aria-hidden="true" />
          Test cases
          {result ? (
            <span
              className={[
                "h-1.5 w-1.5 rounded-full",
                result.accepted ? "bg-[var(--workspace-accent)]" : "bg-[#ff8f8f]"
              ].join(" ")}
            />
          ) : null}
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`transition-transform ${outputOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <DsaTeacherFeedback
        state={teacherFeedback}
        onClose={() => setTeacherFeedback({ status: "idle" })}
        onRetry={() => {
          if (lastAcceptedRun.current) void requestTeacherFeedback(lastAcceptedRun.current);
        }}
      />
    </section>
  );
}

async function recordSolved(slug: string): Promise<void> {
  const response = await fetch("/api/roadmap/question-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      dsaQuestionSlug: slug,
      action: "complete"
    })
  });

  if (!response.ok) throw new Error("Could not save completion");
}

async function saveDsaEditorLanguage(language: DsaEditorLanguage): Promise<void> {
  await fetch("/api/account/dsa-language", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ language })
  });
}

function preferredLanguageFor(slug: string, preferred: DsaEditorLanguage): DsaEditorLanguage {
  const supported = supportedDsaCodeLanguages(slug);
  return supported.includes(preferred) ? preferred : (supported[0] ?? "javascript");
}

function RunOutput({
  examples,
  result,
  running,
  error
}: {
  examples: NonNullable<DsaQuestion["examples"]>;
  result: RunResult | null;
  running: boolean;
  error: string | null;
}) {
  return (
    <section
      className="thin-scroll max-h-[16rem] shrink-0 overflow-y-auto border-t border-white/[0.07] bg-black/10 px-4 py-4 sm:px-5"
      aria-live="polite"
      aria-busy={running}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-cream">Test results</h3>
          <p className="mt-0.5 text-[13px] leading-5 text-cream/45">
            Check the supplied examples before submitting.
          </p>
        </div>
        {running ? (
          <span className="flex items-center gap-2 text-[13px] text-cream/50">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Running tests
          </span>
        ) : result ? (
          <span
            className={
              result.accepted
                ? "text-[13px] font-semibold text-cream"
                : "text-[13px] font-semibold text-[#ffb4b4]"
            }
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: result.accepted ? "var(--workspace-accent)" : "#ff8f8f" }}
            />
            {result.status}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[13px] text-cream/50">
            <span
              className="h-2 w-2 rounded-full shadow-[0_0_12px_var(--workspace-accent)]"
              style={{ background: "var(--workspace-accent)" }}
            />
            Ready to run
          </span>
        )}
      </div>

      <div className="mt-4 pr-1">
        {error ? (
          <p role="alert" className="text-sm leading-6 text-[#ffb4b4]">
            {error}
          </p>
        ) : null}
        {result?.compileOutput || result?.stderr ? (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#ffb4b4]">
            {result.compileOutput || result.stderr}
          </pre>
        ) : result?.tests.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {result.tests.map((test) => (
              <div key={test.index} className="practice-glass-soft rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-cream/75">
                    Case {test.index + 1}
                  </span>
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
                {test.visible === false ? (
                  <p className="mt-3 font-mono text-[12.5px] leading-5 text-cream/35">
                    Hidden case — a correct solution passes it without seeing the input.
                  </p>
                ) : (
                  <dl className="mt-3 grid gap-x-3 gap-y-1.5 font-mono text-[12.5px] leading-5 sm:grid-cols-[4.5rem_1fr]">
                    <dt className="text-cream/35">Input</dt>
                    <dd className="break-words text-cream/65">{test.input}</dd>
                    <dt className="text-cream/35">Expected</dt>
                    <dd className="break-words text-cream/65">{test.expectedOutput}</dd>
                    <dt className="text-cream/35">Output</dt>
                    <dd className="break-words text-cream/65">
                      {test.error || test.actualOutput || "No output"}
                    </dd>
                  </dl>
                )}
              </div>
            ))}
          </div>
        ) : examples.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {examples.map((example, index) => (
              <div
                key={`${example.input}-${index}`}
                className="practice-glass-soft rounded-2xl p-4"
              >
                <p className="text-[13px] font-semibold text-cream/75">Case {index + 1}</p>
                <dl className="mt-3 grid gap-x-3 gap-y-1.5 font-mono text-[12.5px] leading-5 sm:grid-cols-[4.5rem_1fr]">
                  <dt className="text-cream/35">Input</dt>
                  <dd className="break-words text-cream/68">{example.input}</dd>
                  <dt className="text-cream/35">Expected</dt>
                  <dd className="break-words text-cream/68">{example.output}</dd>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-5 text-cream/40">
            No runnable examples are available for this question yet.
          </p>
        )}
      </div>
    </section>
  );
}
