function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Matches the DSA-style prep session while its data is loading. */
export function ChapterSessionSkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading practice session"
    >
      <div className="mx-auto w-full max-w-[86rem] animate-pulse px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
        <div className="h-9 w-36 rounded-lg bg-white/[0.035]" />

        <section className="mt-5 grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SkeletonLine className="h-3 w-28" />
                <SkeletonLine className="mt-4 h-9 w-72 max-w-full" />
                <SkeletonLine className="mt-4 h-3 w-[34rem] max-w-full" />
              </div>
              <div className="w-full rounded-xl border border-white/[0.08] bg-[#17191b] p-4 sm:w-[20rem]">
                <SkeletonLine className="h-4 w-4/5" />
                <SkeletonLine className="mt-4 h-1.5 w-full" />
                <SkeletonLine className="mt-3 h-3 w-3/5" />
              </div>
            </div>

            <section className="mt-7 rounded-[1.45rem] border border-white/[0.08] bg-[#17191b] p-5 sm:p-6">
              <SkeletonLine className="h-3 w-44" />
              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-7 w-64 max-w-full" />
                  <SkeletonLine className="mt-4 h-3 w-full max-w-[36rem]" />
                  <SkeletonLine className="mt-2 h-3 w-4/5 max-w-[28rem]" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-white/[0.055]" />
              </div>
              <div className="mt-5 flex gap-2">
                <SkeletonLine className="h-6 w-20" />
                <SkeletonLine className="h-6 w-24" />
                <SkeletonLine className="h-6 w-16" />
              </div>
            </section>

            <section className="mt-8">
              <SkeletonLine className="h-3 w-20" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="overflow-hidden rounded-[1.4rem] bg-[#17191b]">
                    <div className="flex min-h-[4.75rem] items-center gap-4 px-4 py-4 sm:px-5">
                      <SkeletonLine className="h-10 w-10 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <SkeletonLine className="h-4 w-48 max-w-full" />
                        <SkeletonLine className="mt-3 h-3 w-3/5" />
                      </div>
                      <div className="hidden w-32 sm:block">
                        <SkeletonLine className="ml-auto h-3 w-24" />
                        <SkeletonLine className="ml-auto mt-3 h-1 w-32" />
                      </div>
                    </div>
                    {index === 0 ? (
                      <div className="grid gap-2.5 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-2">
                        {Array.from({ length: 4 }, (_, rowIndex) => (
                          <div
                            key={rowIndex}
                            className="flex min-h-[5.25rem] items-center gap-3 rounded-xl bg-black/[0.28] p-3.5"
                          >
                            <SkeletonLine className="h-8 w-8 shrink-0 rounded-lg" />
                            <div className="flex-1">
                              <SkeletonLine className="h-4 w-3/4" />
                              <SkeletonLine className="mt-3 h-3 w-4/5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="rounded-[1.4rem] border border-white/[0.08] bg-[#17191b] p-5 xl:sticky xl:top-24">
            <SkeletonLine className="h-3 w-28" />
            <SkeletonLine className="mt-4 h-5 w-40" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <SkeletonLine className="h-3 w-6 shrink-0" />
                  <SkeletonLine className="h-3 w-4/5" />
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
