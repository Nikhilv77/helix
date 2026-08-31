function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Page-shaped fallback for the Practice sessions overview. */
export function PracticeSkeleton() {
  return (
    <main className="min-h-[100svh] w-full bg-black" aria-busy="true" aria-label="Loading practice">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col animate-pulse px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
        <section className="order-2 mt-12 md:order-1 md:mt-0" aria-label="Loading practice summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4">
            <div className="flex min-h-52 items-center rounded-[1.45rem] bg-[#17181b] px-5 py-6 sm:px-6">
              <div className="grid w-full grid-cols-7 gap-3 sm:gap-4">
                {Array.from({ length: 7 }, (_, index) => (
                  <span
                    key={index}
                    className={`h-32 rounded-[1.45rem] bg-white/[0.045] ${index === 5 ? "opacity-55" : ""}`}
                  />
                ))}
              </div>
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-52 flex-col items-start justify-center gap-5 rounded-[1.45rem] bg-[#17181b] px-5 py-6 sm:px-6"
              >
                <SkeletonLine className={index === 0 ? "h-5 w-4/5" : "h-5 w-full"} />
                <SkeletonLine className={index === 1 ? "h-3 w-5/6" : "h-3 w-4/5"} />
              </div>
            ))}
          </div>
        </section>

        <section
          className="order-1 md:order-2 md:mt-12 lg:mt-14"
          aria-label="Loading practice sessions"
        >
          <div className="grid gap-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="grid min-h-[13rem] gap-6 rounded-[2rem] bg-[#17181b] p-7 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:gap-7 lg:grid-cols-[6rem_minmax(0,1fr)_auto] lg:p-8"
              >
                <span className="h-20 w-20 rounded-[1.45rem] bg-white/[0.045] lg:h-24 lg:w-24" />
                <div className="min-w-0 self-center">
                  <SkeletonLine className="h-6 w-52 max-w-full" />
                  <SkeletonLine className="mt-5 h-3 w-full max-w-[38rem]" />
                  <SkeletonLine className="mt-2 h-3 w-3/4 max-w-[28rem]" />
                  <div className="mt-5 flex gap-2">
                    <SkeletonLine className="h-6 w-20" />
                    <SkeletonLine className="h-6 w-28" />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-5 md:flex-col md:items-end md:self-stretch">
                  <div className="flex gap-2">
                    <SkeletonLine className="h-6 w-16" />
                    <SkeletonLine className="h-6 w-20" />
                  </div>
                  <SkeletonLine className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/** DSA-session fallback, kept distinct from the Practice home loader. */
export function DsaPracticeSkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading DSA practice"
    >
      <div className="mx-auto w-full max-w-[86rem] animate-pulse px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
        <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14 xl:gap-y-7">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SkeletonLine className="h-8 w-44" />
                <SkeletonLine className="mt-4 h-3 w-80 max-w-full" />
              </div>
              <div className="w-full rounded-xl border border-white/[0.08] bg-[#141619] px-5 py-4 sm:max-w-[19rem]">
                <SkeletonLine className="h-4 w-52 max-w-full" />
                <SkeletonLine className="mt-3 h-1.5 w-full" />
              </div>
            </header>

            <section className="relative mt-6 flex flex-col overflow-hidden rounded-2xl bg-[#17181b] sm:mt-7 md:block md:min-h-[13.5rem]">
              <div aria-hidden className="order-1 h-[17rem] w-full shrink-0 md:hidden" />
              <div className="order-2 flex max-w-none flex-col justify-center px-5 py-7 sm:px-7 md:min-h-[13.5rem] md:max-w-[48%]">
                <SkeletonLine className="h-3 w-40" />
                <SkeletonLine className="mt-5 h-7 w-52" />
                <SkeletonLine className="mt-4 h-3 w-full" />
                <SkeletonLine className="mt-2 h-3 w-4/5" />
                <SkeletonLine className="mt-5 h-11 w-60" />
              </div>
            </section>
          </div>

          <aside className="rounded-[1.45rem] bg-[#17181b] p-5 xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-[9.3rem]">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-4 h-5 w-40" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <SkeletonLine className="h-3 w-6 shrink-0" />
                  <SkeletonLine className="h-3 w-4/5" />
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <SkeletonLine className="h-3 w-20" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index}>
                  <div
                    className={`overflow-hidden rounded-[1.35rem] bg-[#17181b] ${index === 0 ? "min-h-[25rem]" : "min-h-[4.75rem]"}`}
                  >
                    <div className="flex min-h-[4.75rem] items-center gap-4 px-4 py-4 sm:px-5">
                      <SkeletonLine className="h-9 w-9 shrink-0 rounded-xl" />
                      <div className="flex-1">
                        <SkeletonLine className="h-4 w-40" />
                        <SkeletonLine className="mt-3 h-3 w-20" />
                      </div>
                      <SkeletonLine className="hidden h-8 w-24 sm:block" />
                    </div>
                    {index === 0 ? (
                      <>
                        <div className="bg-black/10 px-4 py-5 sm:px-5">
                          <SkeletonLine className="h-3 w-28" />
                          <SkeletonLine className="mt-3 h-2 w-full rounded-full" />
                        </div>
                        <div className="grid gap-2.5 p-3 sm:p-4 lg:grid-cols-2">
                          {Array.from({ length: 4 }, (_, rowIndex) => (
                            <div
                              key={rowIndex}
                              className="flex min-h-[5.4rem] items-start gap-3 rounded-2xl bg-black/20 p-3.5"
                            >
                              <SkeletonLine className="h-8 w-8 shrink-0 rounded-xl" />
                              <div className="flex-1">
                                <SkeletonLine className="h-4 w-3/4" />
                                <SkeletonLine className="mt-3 h-3 w-4/5" />
                              </div>
                              <SkeletonLine className="h-7 w-7 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
