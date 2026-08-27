"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface QueuedReport {
  id: string;
  reason: string;
  detail: string | null;
  reporterId: string;
  reportedId: string;
  filedAt: number;
  requestId: string;
  questionTitle: string | null;
  questionSlug: string | null;
  requestStatus: string | null;
}

const REASON_LABEL: Record<string, string> = {
  HARASSMENT: "Harassment or abuse",
  SPAM: "Spam or self-promotion",
  OFF_TOPIC: "Not about the problem",
  SOLUTION_DUMPING: "Gave the answer away",
  OTHER: "Something else"
};

/** Harassment first: the queue is worked top-down and severity should lead. */
const SEVERITY = ["HARASSMENT", "SPAM", "OFF_TOPIC", "SOLUTION_DUMPING", "OTHER"];

function ago(at: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export function ReportQueue() {
  const [reports, setReports] = useState<QueuedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/help/reports");
      const payload = await response.json().catch(() => null);
      if (!payload?.success || !payload.data) return;

      const rows = (payload.data.reports ?? []) as QueuedReport[];
      rows.sort(
        (a, b) =>
          SEVERITY.indexOf(a.reason) - SEVERITY.indexOf(b.reason) || a.filedAt - b.filedAt
      );
      setReports(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await fetch("/api/help/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id })
        });
        setReports((current) => current.filter((report) => report.id !== id));
      } finally {
        setBusy(null);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-cream/45">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Loading queue
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-xl border border-cream/10 bg-cream/[0.03] px-4 py-10 text-center text-[13.5px] text-cream/45">
        Nothing waiting. Reports appear here the moment somebody files one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <article
          key={report.id}
          className="rounded-[1.15rem] border border-cream/10 bg-[linear-gradient(150deg,#1b1c20,#161719)] p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                report.reason === "HARASSMENT"
                  ? "bg-[#f0a3a3]/15 text-[#ffb4b4]"
                  : "bg-cream/[0.06] text-cream/65"
              ].join(" ")}
            >
              {REASON_LABEL[report.reason] ?? report.reason}
            </span>
            <span className="text-[12.5px] text-cream/45">{ago(report.filedAt)}</span>
            {report.questionSlug ? (
              <Link
                href={`/dsa-questions/${report.questionSlug}`}
                className="text-[12.5px] text-cream/60 underline-offset-2 hover:underline"
              >
                {report.questionTitle}
              </Link>
            ) : null}
            {report.requestStatus ? (
              <span className="text-[12.5px] text-cream/35">· {report.requestStatus}</span>
            ) : null}
          </div>

          {report.detail ? (
            <p className="mt-2.5 whitespace-pre-wrap rounded-lg border border-cream/8 bg-[#0b0d10] px-3 py-2.5 text-[13px] leading-5 text-cream/75">
              {report.detail}
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] italic text-cream/40">No detail was given.</p>
          )}

          <dl className="mt-3 grid gap-1 text-[12px] text-cream/45 sm:grid-cols-2">
            <div>
              <dt className="inline text-cream/35">Reported by </dt>
              <dd className="inline font-mono">{report.reporterId}</dd>
            </div>
            <div>
              <dt className="inline text-cream/35">Reported </dt>
              <dd className="inline font-mono">{report.reportedId}</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              disabled={busy === report.id}
              onClick={() => void review(report.id)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-cream px-3.5 text-[13px] font-semibold text-[#171a16] transition hover:bg-white disabled:opacity-45"
            >
              {busy === report.id ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={12} aria-hidden="true" />
              )}
              Mark reviewed
            </button>
            <span className="text-[11.5px] text-cream/30">
              Reviewing only clears it from the queue — it takes no action against anyone.
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
