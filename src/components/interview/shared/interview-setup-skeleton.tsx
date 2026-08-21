import { ArrowRight } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";

export function InterviewSetupSkeleton() {
  return (
    <main
      className="blueprint relative min-h-[100svh] overflow-hidden px-6 py-6 sm:px-10"
      aria-busy="true"
      aria-label="Loading interview setup"
    >
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-cream/15 pb-5">
          <div className="flex items-center gap-3 text-cream">
            <TrailgradMark className="h-8 w-8" />
            <span className="text-xl font-semibold">Trailgrad</span>
          </div>
          <div className="h-3 w-28 rounded-full bg-cream/10" />
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-3xl">
            <div className="mb-10 flex items-center justify-between gap-3">
              {[0, 1, 2, 3, 4].map((step) => (
                <div key={step} className="flex flex-1 items-center gap-3">
                  <span className="h-8 w-8 rounded-full border border-cream/20 bg-cream/[0.06]" />
                  {step < 4 ? <span className="h-px flex-1 bg-cream/10" /> : null}
                </div>
              ))}
            </div>
            <div className="h-3 w-32 rounded-full bg-cream/15" />
            <div className="mt-5 h-12 w-5/6 rounded-xl bg-cream/[0.09] sm:h-14" />
            <div className="mt-4 h-5 w-2/3 rounded-lg bg-cream/[0.06]" />
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 rounded-xl border border-cream/15 bg-cream/[0.035]"
                />
              ))}
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-cream/15 pt-5">
          <div className="h-3 w-40 rounded-full bg-cream/10" />
          <div className="flex h-11 items-center gap-2 rounded-xl bg-cream/[0.08] px-5">
            <span className="h-3 w-20 rounded-full bg-cream/15" />
            <ArrowRight size={15} className="text-cream/35" aria-hidden="true" />
          </div>
        </footer>
      </div>
    </main>
  );
}
