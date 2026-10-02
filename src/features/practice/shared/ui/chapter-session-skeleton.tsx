function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Matches the chapter session (teacher column, briefing panel, stats) while it loads. */
export function ChapterSessionSkeleton() {
  return (
    <main
      className="practice-skeleton min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading practice session"
    >
      <div className="mx-auto w-full max-w-[94rem] animate-pulse px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <div className="flex items-center gap-2 py-6">
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="h-3 w-28" />
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)]">
          <div className="flex min-h-[26rem] flex-col justify-between rounded-[1.5rem] bg-[#17181b] p-5 lg:min-h-[34rem]">
            <div>
              <SkeletonLine className="h-4 w-24" />
              <SkeletonLine className="mt-2 h-3 w-32" />
            </div>
            <SkeletonLine className="h-4 w-20" />
          </div>

          <div className="flex min-h-[32rem] flex-col rounded-[1.5rem] bg-[#17181b] p-5 sm:p-6 lg:min-h-[34rem]">
            <div className="flex gap-1.5">
              <SkeletonLine className="h-1.5 w-6" />
              <SkeletonLine className="h-1.5 w-1.5" />
              <SkeletonLine className="h-1.5 w-1.5" />
              <SkeletonLine className="h-1.5 w-1.5" />
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="mt-4 h-8 w-80 max-w-full" />
              <SkeletonLine className="mt-5 h-3 w-full max-w-2xl" />
              <SkeletonLine className="mt-2 h-3 w-4/5 max-w-xl" />
            </div>
            <div className="flex items-center justify-between pt-3">
              <SkeletonLine className="h-4 w-36" />
              <span className="h-11 w-32 rounded-xl bg-white/[0.055]" />
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-[#17181b] p-5">
              <SkeletonLine className="h-3 w-24" />
              <SkeletonLine className="mt-4 h-6 w-16" />
              <SkeletonLine className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
