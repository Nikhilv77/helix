"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function ArchitectureDesignError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[72svh] w-full max-w-[86rem] items-center px-5 py-16 sm:px-8">
      <section role="alert" className="max-w-xl">
        <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-cream">
          This design scenario could not be loaded.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-cream/58">
          Your saved progress is safe. Retry the read or return to Practice.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-5 text-[14px] font-semibold text-[#17181a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <RotateCcw size={14} aria-hidden="true" /> Retry
          </button>
          <Link
            href="/practice"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/[0.08] px-5 text-[14px] font-semibold text-cream/68 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            Back to Practice
          </Link>
        </div>
      </section>
    </main>
  );
}
