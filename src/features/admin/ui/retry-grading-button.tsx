"use client";

import { RotateCw } from "lucide-react";
import { useActionState } from "react";

import type { RetryGradingState } from "@/app/admin/reliability/actions";

const MESSAGES = {
  graded: "Graded",
  "still-stuck": "Still stuck, see logs",
  "not-found": "Already graded"
} as const;

/** Re-runs grading for one stuck checkpoint room. Grading can take a minute. */
export function RetryGradingButton({
  sessionId,
  action
}: {
  sessionId: string;
  action: (state: RetryGradingState, formData: FormData) => Promise<RetryGradingState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const result = state?.sessionId === sessionId ? state.outcome : null;
  return (
    <form action={formAction} className="flex items-center justify-end gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      {result && !pending ? <span className="text-[13px] text-cream/55">{MESSAGES[result]}</span> : null}
      <button
        type="submit"
        disabled={pending}
        className="admin-tab inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-[13px] font-medium outline-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <RotateCw
          size={15}
          strokeWidth={1.5}
          className={pending ? "animate-spin motion-reduce:animate-none" : ""}
          aria-hidden="true"
        />
        {pending ? "Grading…" : "Retry grading"}
      </button>
    </form>
  );
}
