"use client";

import { Eye, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import {
  STALE_AFTER_MS,
  isStale,
  type HelpSnapshot,
  type WorkspaceState
} from "@/lib/help/snapshot";

/**
 * The learner's workspace, as the helper sees it.
 *
 * Read-only, and not merely visually: the helper's token carries no
 * `canPublishData` grant, so there is no channel back into the learner's editor
 * to disable in the first place. What they get is a window, which is the whole
 * intent — a helper who can edit ends up writing the answer.
 */
export function LearnerWorkspaceView({
  snapshot,
  captured
}: {
  snapshot: HelpSnapshot | null;
  captured: WorkspaceState | null;
}) {
  const [, forceRender] = useState(0);

  // Staleness is a function of elapsed time, so the label has to re-evaluate
  // even when no new snapshot arrives.
  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setInterval(() => forceRender((n) => n + 1), 5_000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  const workspace = snapshot ?? captured;
  if (!workspace) {
    return (
      <div className="rounded-xl border border-cream/10 bg-cream/[0.03] px-4 py-6 text-center text-[13px] text-cream/45">
        Waiting for them to share their editor. It appears once they join the call.
      </div>
    );
  }

  const stale = snapshot ? isStale(snapshot) : true;

  return (
    <div className="overflow-hidden rounded-xl border border-cream/10 bg-[#0b0d10]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-cream/8 px-3.5 py-2.5 text-[12px] text-cream/50">
        <span className="inline-flex items-center gap-1.5 font-medium text-cream/70">
          <Eye size={12} aria-hidden="true" />
          Their editor
        </span>
        <span>· {workspace.language}</span>
        {workspace.failingTests !== null ? (
          <span className={workspace.failingTests > 0 ? "text-[#ffb4b4]" : "text-[#8be6bd]"}>
            · {workspace.failingTests === 0 ? "tests pass" : `${workspace.failingTests} failing`}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className={snapshot && !stale ? "text-[#8be6bd]" : "text-cream/35"}>
          {!snapshot
            ? "captured when they asked"
            : stale
              ? `paused >${Math.round(STALE_AFTER_MS / 1000)}s`
              : "live"}
        </span>
      </div>

      <pre className="max-h-[22rem] overflow-auto px-3.5 py-3 text-[12.5px] leading-5 text-cream/85">
        <code>{workspace.code || "// nothing written yet"}</code>
      </pre>

      {workspace.testOutput ? (
        <div className="border-t border-cream/8">
          <p className="flex items-center gap-1.5 px-3.5 pt-2.5 text-[11.5px] font-medium text-cream/45">
            <ScrollText size={11} aria-hidden="true" />
            Last run
          </p>
          <pre className="max-h-[10rem] overflow-auto px-3.5 pb-3 pt-1 text-[12px] leading-5 text-cream/60">
            <code>{workspace.testOutput}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
