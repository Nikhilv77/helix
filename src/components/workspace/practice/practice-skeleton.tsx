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
      <div className="mx-auto w-full max-w-[92rem] animate-pulse px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
        <span className="block h-9 w-9 rounded-xl bg-[#17181b]" />
        <div className="mx-auto mt-4 flex min-h-[30rem] w-full max-w-3xl flex-col items-center justify-center py-4 sm:min-h-[34rem]">
          <div className="h-[16rem] w-full max-w-[27rem] rounded-[50%] bg-white/[0.035] sm:h-[19rem]" />
          <div className="-mt-7 w-full max-w-2xl sm:-mt-10">
            <div className="rounded-[1.45rem] bg-[#17181b] px-5 py-5 sm:px-7 sm:py-6">
              <SkeletonLine className="h-3 w-full" />
              <SkeletonLine className="mt-2 h-3 w-5/6" />
              <SkeletonLine className="mt-2 h-3 w-2/3" />
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <SkeletonLine className="h-12 w-44" />
              <SkeletonLine className="h-12 w-28" />
              <span className="h-12 w-12 rounded-xl bg-white/[0.055]" />
            </div>
          </div>
        </div>
        <div className="mt-12 space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="min-h-28 rounded-[1.45rem] bg-[#17181b] p-5 sm:p-6">
              <SkeletonLine className="h-5 w-52" />
              <SkeletonLine className="mt-4 h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
