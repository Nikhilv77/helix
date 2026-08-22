import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/** Keeps the practice chapter layout stable while its personalised brief loads. */
export function ChapterSessionSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading practice chapter"
    >
      <RouteProgress />
      <Line className="mb-6 w-44" />
      <section className="rounded-[1.5rem] border border-white/[0.08] bg-[#151619] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="min-h-[26rem] rounded-2xl bg-[#1b1d20] p-5 lg:min-h-[34rem]">
            <div className="skeleton h-10 w-10 !rounded-xl" />
          </div>
          <div className="rounded-2xl bg-[#1b1d20] p-5 sm:p-6">
            <div className="flex gap-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-1.5 w-6 !rounded-full" />)}</div>
            <div className="mt-7 space-y-3">
              <Line className="w-24" />
              <div className="skeleton h-9 w-4/5" />
              <Line className="w-full" />
              <Line className="w-3/4" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-14 !rounded-xl" />)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
