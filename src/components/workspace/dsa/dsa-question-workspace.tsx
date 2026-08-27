"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Code2, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { DsaCodeEditor, type DsaEditorLanguage } from "@/components/interview/dsa/dsa-code-editor";
import { DsaQuestionNotes } from "@/components/interview/dsa/dsa-question-notes";
import { AskSomeone } from "./ask-someone";
import { dsaStarterCode, supportedDsaCodeLanguages } from "@/lib/dsa/dsa-code-templates";
import { dsaCodeDraftKey, readDsaCodeDraft, writeDsaCodeDraft } from "@/lib/dsa/code-draft";
import type { DsaQuestion } from "@/lib/dsa/dsa";

type RunTest = {
  index: number;
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

export function DsaQuestionWorkspace({ question }: { question: DsaQuestion }) {
  const [language, setLanguage] = useState<DsaEditorLanguage>("javascript");
  const [code, setCode] = useState(() => dsaStarterCode(question, "javascript"));
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRunId = useRef<string | null>(null);
  const loadedDraftKey = useRef<string | null>(null);

  const examples = useMemo(() => question.examples?.slice(0, 10) ?? [], [question.examples]);
  const languages = useMemo(() => {
    const supported = new Set(supportedDsaCodeLanguages(question.slug));
    return LANGUAGES.filter((item) => supported.has(item.value));
  }, [question.slug]);
  // When this attempt began, so a help request can report time spent. A ref, not
  // state: it must not reset the clock on every keystroke.
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const key = dsaCodeDraftKey(question.slug, language);
    const saved = readDsaCodeDraft(window.localStorage, question.slug, language);
    setCode(saved ?? dsaStarterCode(question, language));
    setResult(null);
    setError(null);
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

  function changeLanguage(nextLanguage: DsaEditorLanguage) {
    setLanguage(nextLanguage);
    setResult(null);
    setError(null);
  }

  function resetCode() {
    setCode(dsaStarterCode(question, language));
    setResult(null);
    setError(null);
  }

  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
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
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Code execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="practice-editor-shell mt-0 min-w-0 overflow-hidden rounded-[1.5rem]">
      <div className="practice-editor-header flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold text-cream">
          <Code2 size={17} aria-hidden="true" style={{ color: "var(--workspace-accent)" }} />
          Solution
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="question-language" className="sr-only">
            Programming language
          </label>
          <select
            id="question-language"
            value={language}
            onChange={(event) => changeLanguage(event.target.value as DsaEditorLanguage)}
            className="h-10 rounded-xl border border-cream/10 bg-cream/[0.055] px-3.5 text-[13px] font-medium text-cream/80 outline-none transition focus:border-[var(--workspace-accent-border)] focus:bg-cream/[0.08]"
          >
            {languages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetCode}
            disabled={running}
            aria-label="Reset code to the starter template"
            title="Reset starter code"
            className="grid h-10 w-10 place-items-center rounded-xl bg-cream/[0.055] text-cream/55 transition hover:bg-cream/[0.1] hover:text-cream disabled:pointer-events-none disabled:opacity-45"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void runCode()}
            disabled={running || !code.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#171a16] transition hover:bg-white disabled:pointer-events-none disabled:opacity-45"
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

      <div className="h-[31rem] min-h-0 overflow-hidden bg-[#0b0d10] sm:h-[37rem] lg:h-[calc(100svh-19rem)] lg:min-h-[34rem] lg:max-h-[48rem]">
        <DsaCodeEditor
          language={language}
          value={code}
          onChange={setCode}
          onRun={() => void runCode()}
        />
      </div>

      <RunOutput examples={examples} result={result} running={running} error={error} />

      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/10 px-4 pb-3 sm:px-5">
        <p className="text-[12.5px] text-cream/40">
          Stuck after a few tries? Maya explains instantly — a person takes longer but explains it
          their way.
        </p>
        <AskSomeone
          slug={question.slug}
          language={language}
          code={code}
          testOutput={testOutput}
          failingTests={failingTests}
          startedAt={startedAt.current}
        />
      </div>

      <div className="bg-black/10 px-4 pb-4 sm:px-5">
        <p className="mb-3 text-[12px] text-cream/35">Code drafts save on this device.</p>
        <DsaQuestionNotes slug={question.slug} />
      </div>
    </section>
  );
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
    <section className="bg-black/10 px-4 py-4 sm:px-5" aria-live="polite" aria-busy={running}>
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

      <div className="mt-4 max-h-72 overflow-y-auto pr-1">
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
