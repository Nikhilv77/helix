"use client";

import { Code2, Eye, MousePointer2, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import {
  STALE_AFTER_MS,
  isStale,
  type HelpSnapshot,
  type WorkspaceState
} from "@/lib/help/snapshot";

/**
 * The learner's live workspace as a genuinely read-only helper view.
 *
 * Helpers can publish shared-board data, but workspace packets are accepted
 * only from the learner identity and this surface exposes no editing action.
 */
export function LearnerWorkspaceView({
  snapshot,
  captured
}: {
  snapshot: HelpSnapshot | null;
  captured: WorkspaceState | null;
}) {
  const [, forceRender] = useState(0);

  // Staleness changes with elapsed time even when no new packet arrives.
  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setInterval(() => forceRender((n) => n + 1), 5_000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  const workspace = snapshot ?? captured;
  if (!workspace) {
    return (
      <div className="rounded-xl border border-cream/10 bg-cream/[0.03] px-4 py-10 text-center text-[13px] text-cream/45">
        Waiting for the candidate’s editor. It appears when they join the call.
      </div>
    );
  }

  const stale = snapshot ? isStale(snapshot) : true;
  const lines = (workspace.code || "// nothing written yet").split("\n");
  const selectedLines = normalizedSelectedLines(workspace.selection, lines.length);

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-cream/10 bg-[#0b0d10] shadow-[0_28px_80px_-48px_rgba(0,0,0,0.95)]">
      <header className="flex flex-wrap items-center gap-2.5 border-b border-cream/8 bg-[#111419] px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-cream/85">
          <Eye size={14} aria-hidden="true" />
          Candidate workspace
        </span>
        <span className="rounded-md bg-cream/[0.055] px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-cream/45">
          {workspace.language}
        </span>
        <span className="flex-1" />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            snapshot && !stale ? "bg-[#71d6a5]/10 text-[#9be8c1]" : "bg-cream/[0.055] text-cream/42"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              snapshot && !stale ? "bg-[#71d6a5]" : "bg-cream/30"
            }`}
          />
          {!snapshot
            ? "Captured state"
            : stale
              ? `Paused >${Math.round(STALE_AFTER_MS / 1000)}s`
              : "Live"}
        </span>
      </header>

      <div className="grid min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 border-b border-cream/8 lg:border-b-0 lg:border-r">
          <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-cream/8 px-4 py-2 text-[11.5px] text-cream/40">
            <Code2 size={13} aria-hidden="true" />
            <span>Read-only editor</span>
            {workspace.selection ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--workspace-accent)]">
                <MousePointer2 size={12} aria-hidden="true" />
                {selectionLabel(workspace.selection)}
              </span>
            ) : null}
          </div>

          <div
            aria-label="Candidate code, read only"
            className="thin-scroll h-[30rem] overflow-auto bg-[#090b0e] py-3 font-mono text-[12.5px] leading-[1.65] text-cream/82 sm:text-[13px] lg:h-[34rem]"
          >
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const selected =
                selectedLines !== null &&
                lineNumber >= selectedLines.start &&
                lineNumber <= selectedLines.end;
              return (
                <div
                  key={lineNumber}
                  className={`grid min-w-max grid-cols-[3.5rem_minmax(0,1fr)] border-l-2 pr-6 ${
                    selected
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]"
                      : "border-transparent"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`select-none pr-4 text-right ${
                      selected ? "text-[var(--workspace-accent)]" : "text-cream/22"
                    }`}
                  >
                    {lineNumber}
                  </span>
                  <code className="whitespace-pre">{line || " "}</code>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 bg-[#0e1115]">
          <div className="border-b border-cream/8 px-4 py-4 sm:px-5">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-cream/70">
              <ScrollText size={13} aria-hidden="true" />
              Latest test run
            </p>
            <p
              className={`mt-3 text-2xl font-semibold tracking-[-0.03em] ${
                workspace.failingTests === null
                  ? "text-cream/35"
                  : workspace.failingTests > 0
                    ? "text-[#ffb4b4]"
                    : "text-[#9be8c1]"
              }`}
            >
              {workspace.failingTests === null
                ? "Not run"
                : workspace.failingTests === 0
                  ? "All tests pass"
                  : `${workspace.failingTests} failing`}
            </p>
          </div>

          <div className="thin-scroll max-h-[25rem] overflow-auto px-4 py-4 sm:px-5 lg:max-h-[29rem]">
            {workspace.testOutput ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-cream/55">
                <code>{workspace.testOutput}</code>
              </pre>
            ) : (
              <p className="text-[12.5px] leading-5 text-cream/32">
                Test output will appear here after the candidate runs their solution.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function normalizedSelectedLines(
  selection: WorkspaceState["selection"],
  lineCount: number
): { start: number; end: number } | null {
  if (!selection || lineCount < 1) return null;
  const start = Math.min(Math.max(selection.startLineNumber, 1), lineCount);
  const end = Math.min(Math.max(selection.endLineNumber, start), lineCount);
  return { start, end };
}

function selectionLabel(selection: NonNullable<WorkspaceState["selection"]>): string {
  const collapsed =
    selection.startLineNumber === selection.endLineNumber &&
    selection.startColumn === selection.endColumn;
  if (collapsed) return `Line ${selection.startLineNumber}`;
  if (selection.startLineNumber === selection.endLineNumber) {
    return `Line ${selection.startLineNumber}, cols ${selection.startColumn}–${selection.endColumn}`;
  }
  return `Lines ${selection.startLineNumber}–${selection.endLineNumber}`;
}
