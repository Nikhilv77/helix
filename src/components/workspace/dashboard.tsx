"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Mic } from "lucide-react";

interface Quota {
  used: number;
  limit: number;
}

export function Dashboard() {
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/interview/quota", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.success) setQuota(payload.data as Quota);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;
  const exhausted = remaining === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 lg:py-16">
      <p className="blueprint-label text-cream/40">Your workspace</p>
      <h1
        className="display-heading mt-4 text-cream"
        style={{ fontSize: "clamp(2rem, 4.6vw, 3.25rem)" }}
      >
        Ready when you are.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-cream/60">
        Five questions of setup, then fifteen minutes with an interviewer that follows up, pushes
        back, and cuts in when you ramble.
      </p>

      <div className="mt-10 rounded-2xl border border-cream/20 bg-white/[0.05] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cream/25 text-cream">
              <Mic size={18} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-cream">
              Start an interview
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-cream/55">
              Behavioral, technical deep-dive, or hiring manager. Set the intensity and go.
            </p>
          </div>

          <div className="text-right">
            <p className="blueprint-label text-cream/35">Today</p>
            <div className="mt-3 flex items-center justify-end gap-1.5">
              {quota
                ? Array.from({ length: quota.limit }, (_, index) => (
                    <span
                      key={index}
                      className={`h-2 w-6 rounded-full ${index < quota.used ? "bg-cream/25" : "bg-cream/80"}`}
                    />
                  ))
                : null}
            </div>
            <p className="mt-2 font-mono text-[11px] text-cream/40">
              {remaining === null
                ? "—"
                : exhausted
                  ? "None left today"
                  : `${remaining} of ${quota?.limit} left`}
            </p>
          </div>
        </div>

        <Link
          href="/interview"
          aria-disabled={exhausted}
          className={[
            "mt-8 inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-cream bg-cream px-6 text-sm font-semibold text-blueprint transition",
            exhausted ? "pointer-events-none opacity-40" : "hover:-translate-y-0.5 hover:bg-white"
          ].join(" ")}
        >
          {exhausted ? "Come back tomorrow" : "New interview"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-cream/12 bg-white/[0.02] p-6">
        <p className="blueprint-label text-cream/35">Past sessions</p>
        <p className="mt-3 max-w-lg text-sm leading-6 text-cream/40">
          Interviews are held in memory for now, so nothing is kept between runs. Transcripts,
          scores, and history arrive with report generation and persistence.
        </p>
      </div>
    </div>
  );
}
