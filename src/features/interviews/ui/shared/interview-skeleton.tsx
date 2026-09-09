import { Keyboard, Mic, Square } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";

export function InterviewSkeleton() {
  return (
    <main
      className="blueprint relative h-[100dvh] overflow-hidden px-4 sm:px-8"
      aria-busy="true"
      aria-label="Loading interview"
    >
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col pt-6">
        <header className="flex h-20 items-center justify-between border-b border-cream/30">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-cream">
              <TrailgradMark className="h-9 w-9" />
              <span className="text-2xl font-semibold">Trailgrad</span>
            </div>
            <div className="h-12 w-px bg-cream/20" />
            <div>
              <div className="h-6 w-20 rounded-full bg-cream/20" />
              <div className="mt-3 h-3 w-40 rounded-full bg-cream/10" />
            </div>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            {[0, 1, 2, 3].map((step) => (
              <div key={step} className="h-10 w-10 rounded-full border border-cream/20 bg-cream/10" />
            ))}
          </div>
          <div className="flex items-center gap-5 text-cream/45">
            <div className="h-5 w-28 rounded-full bg-cream/10" />
            <div className="flex h-11 items-center gap-2 rounded-xl bg-cream/10 px-4">
              <Square className="h-4 w-4" />
              <span className="h-4 w-10 rounded-full bg-cream/10" />
            </div>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-8 py-7 lg:grid-cols-[minmax(17rem,0.88fr)_minmax(0,1.12fr)]">
          <div className="relative overflow-hidden">
            <div className="absolute inset-x-8 top-12 h-px bg-cream/20" />
            <div className="absolute left-1/2 top-[45%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cream/20" />
            <div className="absolute left-1/2 top-[45%] h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream/10" />
            <div className="absolute left-1/2 top-[45%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 opacity-50">
              {Array.from({ length: 22 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-cream/45"
                  style={{ height: `${14 + ((index * 7) % 46)}px` }}
                />
              ))}
            </div>
            <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cream/20 bg-cream/10 px-5 py-2 text-cream/60">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="text-sm">Connecting room</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-col justify-center gap-8">
            <div className="space-y-5">
              <div className="h-3 w-48 rounded-full bg-cream/15" />
              <div className="h-9 w-5/6 rounded-full bg-cream/20" />
              <div className="h-9 w-2/3 rounded-full bg-cream/15" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-cream/15" />
              <div className="h-4 w-2/3 rounded-full bg-cream/10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-28 rounded-2xl border border-cream/20 bg-cream/[0.03]" />
              <div className="h-28 rounded-2xl border border-cream/20 bg-cream/[0.03]" />
            </div>
          </div>
        </section>

        <footer className="mb-4 flex items-center justify-between rounded-[1.7rem] border border-cream/20 bg-cream/[0.03] p-5">
          <div className="flex items-center gap-5">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-cream text-blueprint">
              <Mic className="h-7 w-7" />
            </div>
            <div>
              <div className="h-5 w-40 rounded-full bg-cream/20" />
              <div className="mt-3 flex items-end gap-1">
                {Array.from({ length: 16 }).map((_, index) => (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-cream/25"
                    style={{ height: `${8 + index * 1.8}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex h-12 w-52 items-center rounded-xl bg-cream/10 px-4 text-cream/40" />
            <div className="flex h-12 items-center gap-2 rounded-xl bg-cream/10 px-5 text-cream/50">
              <Keyboard className="h-4 w-4" />
              <span className="h-4 w-20 rounded-full bg-cream/10" />
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
