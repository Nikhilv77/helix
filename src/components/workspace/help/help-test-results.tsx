"use client";

import { CheckCircle2, CircleDot, Loader2, ScrollText, XCircle } from "lucide-react";

import type { WorkspaceState } from "@/lib/help/snapshot";
import { HELP_ROOM_PANEL_RULE, HELP_ROOM_PANEL_SHELL } from "./help-room-surface";

export function HelpTestResults({
  workspace,
  running,
  error
}: {
  workspace: WorkspaceState;
  running: boolean;
  error: string | null;
}) {
  const tests = workspace.tests ?? [];
  const passing = tests.filter((test) => test.passed).length;
  const hasRun =
    workspace.failingTests !== null || tests.length > 0 || Boolean(workspace.testOutput);
  const statusSignalsFailure = /error|fail|wrong|timeout|rejected/i.test(workspace.runStatus ?? "");
  const accepted =
    hasRun &&
    !statusSignalsFailure &&
    (tests.length > 0
      ? passing === tests.length
      : workspace.failingTests !== null && workspace.failingTests === 0);

  return (
    <aside
      className={`${HELP_ROOM_PANEL_SHELL} flex min-h-[34rem] min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0`}
    >
      <header
        className={`flex min-h-16 shrink-0 items-center gap-3 border-b ${HELP_ROOM_PANEL_RULE} px-4 py-3.5 sm:px-5`}
      >
        <ScrollText size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-cream">Test results</h2>
          <p className="mt-0.5 truncate text-xs text-cream/36">Output and supplied cases</p>
        </div>
      </header>

      <div className={`shrink-0 border-b ${HELP_ROOM_PANEL_RULE} bg-black/10 px-4 py-4 sm:px-5`}>
        {running ? (
          <span className="flex items-center gap-2 text-sm text-cream/58">
            <Loader2 size={14} className="animate-spin text-[var(--workspace-accent)]" />
            Running tests
          </span>
        ) : hasRun ? (
          <>
            <p
              className={`text-[1.35rem] font-semibold tracking-[-0.035em] ${
                accepted ? "text-[var(--workspace-accent)]" : "text-[#ffb4b4]"
              }`}
            >
              {workspace.runStatus ??
                (accepted
                  ? "All tests pass"
                  : workspace.failingTests === null
                    ? "Run failed"
                    : `${workspace.failingTests} failing`)}
            </p>
            <p className="mt-1.5 text-xs text-cream/38">
              {tests.length
                ? `${passing} of ${tests.length} visible cases passed`
                : "Latest candidate run"}
            </p>
          </>
        ) : (
          <>
            <p className="text-[1.35rem] font-semibold tracking-[-0.035em] text-cream/30">
              Not run
            </p>
            <p className="mt-1.5 text-xs text-cream/34">Results appear after the candidate runs.</p>
          </>
        )}
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
        {error ? (
          <pre className="whitespace-pre-wrap rounded-xl bg-[#dd5f5f]/[0.045] p-3.5 font-mono text-xs leading-5 text-[#ffb4b4] ring-1 ring-inset ring-[#dd5f5f]/10">
            {error}
          </pre>
        ) : tests.length ? (
          tests.map((test) => (
            <article key={test.index} className="rounded-xl bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-cream/72">Case {test.index + 1}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    test.passed ? "text-[var(--workspace-accent)]" : "text-[#ffb4b4]"
                  }`}
                >
                  {test.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {test.passed ? "Passed" : "Failed"}
                </span>
              </div>
              <dl className="mt-3 space-y-2 font-mono text-[11px] leading-5">
                <TestValue label="Input" value={test.input} />
                <TestValue label="Expected" value={test.expectedOutput} />
                <TestValue label="Output" value={test.error || test.actualOutput || "No output"} />
              </dl>
            </article>
          ))
        ) : hasRun ? (
          <p className="rounded-xl bg-white/[0.03] p-4 text-xs leading-5 text-cream/42">
            Individual case details will appear on the next live run.
          </p>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
            <CircleDot size={18} className="text-cream/22" aria-hidden="true" />
            <p className="mt-3 text-xs leading-5 text-cream/32">
              Waiting for test cases and program output.
            </p>
          </div>
        )}
      </div>

      {workspace.testOutput ? (
        <section
          className={`max-h-48 shrink-0 overflow-hidden border-t ${HELP_ROOM_PANEL_RULE} bg-black/10`}
        >
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-cream/58">Console output</p>
          <pre className="thin-scroll max-h-36 overflow-auto whitespace-pre-wrap break-words px-4 pb-4 font-mono text-[11px] leading-5 text-cream/48">
            {workspace.testOutput}
          </pre>
        </section>
      ) : null}
    </aside>
  );
}

function TestValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-cream/30">{label}</dt>
      <dd className="thin-scroll mt-0.5 overflow-x-auto whitespace-pre-wrap break-words text-cream/62">
        {value}
      </dd>
    </div>
  );
}
