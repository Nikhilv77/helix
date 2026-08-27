"use client";

import { Flag, ShieldBan } from "lucide-react";
import { useCallback, useState } from "react";

const REASONS = [
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "SPAM", label: "Spam or self-promotion" },
  { value: "OFF_TOPIC", label: "Not about the problem" },
  { value: "SOLUTION_DUMPING", label: "Just gave me the answer" },
  { value: "OTHER", label: "Something else" }
] as const;

/**
 * Block and report, on every live conversation.
 *
 * Placed inline rather than behind a settings page: somebody who needs these
 * needs them during the interaction, not after hunting for them. Deliberately
 * low-contrast — always reachable, never suggesting anything is wrong.
 */
export function SafetyControls({
  requestId,
  onActioned
}: {
  requestId: string;
  onActioned?: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("HARASSMENT");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (body: Record<string, unknown>, confirmation: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/help/safety", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message ?? "That did not go through. Try again.");
        }
        setDone(confirmation);
        setReporting(false);
        setBlocking(false);
        onActioned?.();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That did not go through. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [onActioned]
  );

  if (done) {
    return <p className="text-[12.5px] text-cream/50">{done}</p>;
  }

  if (blocking) {
    return (
      <div className="rounded-xl border border-cream/12 bg-cream/[0.03] p-3.5">
        <p className="text-[13px] font-semibold text-cream">Block this person?</p>
        <p className="mt-1.5 text-[12.5px] leading-5 text-cream/50">
          This ends the conversation immediately and prevents future matching between you.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void send({ action: "block", requestId }, "Blocked. You will not be paired again.")
            }
            className="inline-flex h-9 items-center rounded-xl bg-[#f0a3a3]/15 px-3.5 text-[13px] font-semibold text-[#ffb4b4] transition hover:bg-[#f0a3a3]/25 disabled:opacity-45"
          >
            Block and leave
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setBlocking(false)}
            className="h-9 px-2.5 text-[13px] text-cream/45 transition hover:text-cream/75 disabled:opacity-45"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="mt-2 text-[12px] text-[#ffb4b4]">{error}</p> : null}
      </div>
    );
  }

  if (reporting) {
    return (
      <div className="rounded-xl border border-cream/12 bg-cream/[0.03] p-3.5">
        <p className="text-[13px] font-semibold text-cream">What happened?</p>

        <div className="mt-2.5 space-y-1.5">
          {REASONS.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-2 text-[12.5px] text-cream/70"
            >
              <input
                type="radio"
                name="report-reason"
                value={item.value}
                checked={reason === item.value}
                onChange={() => setReason(item.value)}
                className="accent-[#F26E01]"
              />
              {item.label}
            </label>
          ))}
        </div>

        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Anything else worth knowing (optional)"
          className="mt-2.5 w-full resize-none rounded-lg border border-cream/12 bg-[#0b0d10] px-3 py-2 text-[12.5px] text-cream/80 outline-none focus:border-cream/25"
        />

        <p className="mt-2 text-[11.5px] leading-4 text-cream/40">
          Reporting also blocks them and ends this conversation. A person reads every report.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void send(
                { action: "report", requestId, reason, detail: detail || undefined },
                "Reported. Thank you — someone will look at this."
              )
            }
            className="inline-flex h-9 items-center rounded-xl bg-cream px-3.5 text-[13px] font-semibold text-[#171a16] transition hover:bg-white disabled:opacity-45"
          >
            Send report
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReporting(false)}
            className="h-9 px-2.5 text-[13px] text-cream/45 transition hover:text-cream/75 disabled:opacity-45"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="mt-2 text-[12px] text-[#ffb4b4]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => setBlocking(true)}
        className="inline-flex items-center gap-1.5 text-[12px] text-cream/35 transition hover:text-cream/70"
      >
        <ShieldBan size={11} aria-hidden="true" />
        Block
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setReporting(true)}
        className="inline-flex items-center gap-1.5 text-[12px] text-cream/35 transition hover:text-cream/70 disabled:opacity-45"
      >
        <Flag size={11} aria-hidden="true" />
        Report
      </button>
      {error ? <span className="text-[12px] text-[#ffb4b4]">{error}</span> : null}
    </div>
  );
}
