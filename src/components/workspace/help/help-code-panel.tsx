"use client";

import { Code2, Eye, Loader2, MousePointer2, Play } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DsaCodeEditor,
  type DsaEditorLanguage,
  type DsaEditorSelection
} from "@/components/interview/dsa/dsa-code-editor";
import {
  STALE_AFTER_MS,
  isStale,
  type HelpSnapshot,
  type WorkspaceState
} from "@/lib/help/snapshot";
import { HELP_ROOM_PANEL_RULE, HELP_ROOM_PANEL_SHELL } from "./help-room-surface";

export function HelpCodePanel({
  seat,
  language,
  code,
  onCodeChange,
  onSelectionChange,
  onRun,
  running,
  snapshot,
  captured
}: {
  seat: "learner" | "helper";
  language: DsaEditorLanguage;
  code: string;
  onCodeChange: (value: string) => void;
  onSelectionChange: (selection: DsaEditorSelection) => void;
  onRun: () => void;
  running: boolean;
  snapshot: HelpSnapshot | null;
  captured: WorkspaceState;
}) {
  const [, refreshStaleness] = useState(0);
  const workspace = seat === "helper" ? (snapshot ?? captured) : null;

  useEffect(() => {
    if (seat !== "helper" || !snapshot) return;
    const timer = window.setInterval(() => refreshStaleness((current) => current + 1), 5_000);
    return () => window.clearInterval(timer);
  }, [seat, snapshot]);

  const stale = snapshot ? isStale(snapshot) : true;
  const selected = workspace
    ? normalizedSelectedLines(workspace.selection, workspace.code.split("\n").length)
    : null;

  return (
    <section
      className={`${HELP_ROOM_PANEL_SHELL} flex min-h-[38rem] min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0`}
    >
      <header
        className={`flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b ${HELP_ROOM_PANEL_RULE} px-4 py-3 sm:px-5`}
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-cream">
          {seat === "helper" ? (
            <Eye size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
          ) : (
            <Code2 size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
          )}
          {seat === "helper" ? "Candidate solution" : "Solution"}
        </span>
        <span className="rounded-lg bg-white/[0.045] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/44 ring-1 ring-inset ring-white/[0.045]">
          {workspace?.language ?? language}
        </span>
        <span className="flex-1" />

        {seat === "helper" ? (
          <span
            className={`inline-flex items-center gap-2 text-xs font-medium ${
              snapshot && !stale ? "text-cream/68" : "text-cream/40"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                snapshot && !stale
                  ? "bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]"
                  : "bg-cream/25"
              }`}
            />
            {!snapshot
              ? "Captured state"
              : stale
                ? `Paused >${Math.round(STALE_AFTER_MS / 1000)}s`
                : "Live changes"}
          </span>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={running || !code.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-sm font-semibold text-[#101113] transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
          >
            {running ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={13} aria-hidden="true" />
            )}
            {running ? "Running" : "Run code"}
          </button>
        )}
      </header>

      {seat === "learner" ? (
        <div className="min-h-[34rem] flex-1 overflow-hidden bg-[#0b0d10]">
          <DsaCodeEditor
            language={language}
            value={code}
            onChange={onCodeChange}
            onRun={onRun}
            onSelectionChange={onSelectionChange}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-[#0b0d10]">
          <div
            className={`flex min-h-11 shrink-0 items-center gap-2 border-b ${HELP_ROOM_PANEL_RULE} px-4 text-xs text-cream/38`}
          >
            <Code2 size={13} aria-hidden="true" />
            Read-only editor
            {workspace?.selection ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--workspace-accent)]">
                <MousePointer2 size={12} aria-hidden="true" />
                {selectionLabel(workspace.selection)}
              </span>
            ) : null}
          </div>
          <div
            aria-label="Candidate code, read only"
            className="thin-scroll min-h-[32rem] flex-1 overflow-auto py-4 font-mono text-[13px] leading-[1.7] text-cream/82"
          >
            {(workspace?.code || "// Waiting for the candidate’s code")
              .split("\n")
              .map((line, index) => {
                const lineNumber = index + 1;
                const highlighted =
                  selected !== null && lineNumber >= selected.start && lineNumber <= selected.end;
                return (
                  <div
                    key={lineNumber}
                    className={`grid min-w-max grid-cols-[3.5rem_minmax(0,1fr)] border-l-2 pr-7 ${
                      highlighted
                        ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]"
                        : "border-transparent"
                    }`}
                  >
                    <span
                      className={`select-none pr-4 text-right ${
                        highlighted ? "text-[var(--workspace-accent)]" : "text-cream/22"
                      }`}
                      aria-hidden="true"
                    >
                      {lineNumber}
                    </span>
                    <code className="whitespace-pre">{line || " "}</code>
                  </div>
                );
              })}
          </div>
        </div>
      )}
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
