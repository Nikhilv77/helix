"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Code2, Loader2, Play, XCircle } from "lucide-react";
import { DsaCodeEditor, type DsaEditorLanguage } from "@/components/interview/dsa/dsa-code-editor";
import { DsaQuestionNotes } from "@/components/interview/dsa/dsa-question-notes";
import { dsaStarterCode } from "@/lib/dsa/dsa-code-templates";
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
  const [code, setCode] = useState(() => dsaStarterCode(question.slug, "javascript"));
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples = useMemo(() => question.examples?.slice(0, 10) ?? [], [question.examples]);

  function changeLanguage(nextLanguage: DsaEditorLanguage) {
    setLanguage(nextLanguage);
    setCode(dsaStarterCode(question.slug, nextLanguage));
    setResult(null);
    setError(null);
  }

  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, language, slug: question.slug })
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: RunResult;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message ?? "The code runner could not execute this solution.");
      }

      setResult(payload.data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Code execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-0 min-w-0 overflow-hidden rounded-[0.75rem] border border-cream/20 bg-[#182f73] shadow-[0_18px_45px_rgba(8,20,68,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream/15 bg-[#203d8d] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-cream">
          <Code2 size={16} aria-hidden="true" className="text-cream/55" />
          Write your solution
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="question-language" className="sr-only">
            Programming language
          </label>
          <select
            id="question-language"
            value={language}
            onChange={(event) => changeLanguage(event.target.value as DsaEditorLanguage)}
            className="h-9 rounded-lg border border-cream/15 bg-cream/[0.05] px-3 text-xs font-medium text-cream outline-none focus:bg-cream/[0.1]"
          >
            {LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runCode()}
            disabled={running || !code.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cream px-3.5 text-xs font-semibold text-[#171a16] transition hover:bg-white disabled:pointer-events-none disabled:opacity-45"
          >
            {running ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
            {running ? "Running" : "Run code"}
          </button>
        </div>
      </div>

      <div className="h-[34rem] min-h-0 overflow-hidden bg-[#172f78] sm:h-[40rem] lg:h-[calc(100svh-18rem)] lg:min-h-[38rem] lg:max-h-[52rem]">
        <DsaCodeEditor language={language} value={code} onChange={setCode} onRun={() => void runCode()} />
      </div>

      <RunOutput examples={examples} result={result} running={running} error={error} />

      <div className="border-t border-cream/15 bg-[#182f73] px-4 pb-4 sm:px-5">
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
    <section className="border-t border-cream/15 bg-black/10">
      <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-4 py-3 sm:px-5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/45">
          Test results
        </span>
        {running ? (
          <span className="flex items-center gap-1.5 text-xs text-cream/45">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Running tests
          </span>
        ) : result ? (
          <span className={result.accepted ? "text-xs font-semibold text-[#a9f0d0]" : "text-xs font-semibold text-[#ffb4b4]"}>
            {result.status}
          </span>
        ) : (
          <span className="text-xs text-cream/30">Run code to check the examples</span>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-4 sm:px-5">
        {error ? <p className="text-sm leading-6 text-[#ffb4b4]">{error}</p> : null}
        {result?.compileOutput || result?.stderr ? (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#ffb4b4]">
            {result.compileOutput || result.stderr}
          </pre>
        ) : result?.tests.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {result.tests.map((test) => (
              <div key={test.index} className="border border-cream/10 bg-cream/[0.025] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-cream/65">Case {test.index + 1}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${test.passed ? "text-[#a9f0d0]" : "text-[#ffb4b4]"}`}>
                    {test.passed ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                    {test.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-3 gap-y-1 font-mono text-[11px] leading-5 sm:grid-cols-[4.5rem_1fr]">
                  <dt className="text-cream/35">Input</dt><dd className="break-words text-cream/65">{test.input}</dd>
                  <dt className="text-cream/35">Expected</dt><dd className="break-words text-cream/65">{test.expectedOutput}</dd>
                  <dt className="text-cream/35">Output</dt><dd className="break-words text-cream/65">{test.error || test.actualOutput || "No output"}</dd>
                </dl>
              </div>
            ))}
          </div>
        ) : examples.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {examples.map((example, index) => (
              <div key={`${example.input}-${index}`} className="border border-cream/10 p-3.5">
                <p className="text-xs font-semibold text-cream/55">Case {index + 1}</p>
                <p className="mt-2 font-mono text-[11px] leading-5 text-cream/60">Input: {example.input}</p>
                <p className="font-mono text-[11px] leading-5 text-cream/60">Expected: {example.output}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-cream/35">No runnable examples are available for this question yet.</p>
        )}
      </div>
    </section>
  );
}
