function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Page-shaped fallback for the interview roadmap. */
export function InterviewsSkeleton() {
  return (
    <main
      className="interviews-skeleton min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading interviews"
    >
      <div className="mx-auto w-full max-w-[76rem] animate-pulse px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
        <section className="mx-auto max-w-3xl" aria-label="Loading interview introduction">
          <SkeletonLine className="mx-auto h-5 w-full max-w-[42rem]" />
          <SkeletonLine className="mx-auto mt-3 h-5 w-11/12 max-w-[37rem]" />
          <SkeletonLine className="mx-auto mt-3 h-5 w-3/4 max-w-[29rem]" />
        </section>

        <section className="mt-12 sm:mt-14" aria-label="Loading interview sessions">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <article
                key={index}
                className="interviews-skeleton-card flex min-h-[22rem] flex-col rounded-2xl p-6 lg:p-7"
              >
                <span className="h-11 w-11 rounded-xl bg-white/[0.045]" />
                <SkeletonLine className={`mt-6 h-5 ${index % 3 === 1 ? "w-3/4" : "w-2/3"}`} />
                <SkeletonLine className="mt-4 h-3.5 w-full" />
                <SkeletonLine className="mt-2 h-3.5 w-4/5" />
                <SkeletonLine className="mt-5 h-3 w-28" />
                <div className="mt-5 space-y-2.5 pt-5">
                  <SkeletonLine className="h-3 w-3/4" />
                  <SkeletonLine className="h-3 w-2/3" />
                  <SkeletonLine className="h-3 w-1/2" />
                </div>
                <SkeletonLine className="mt-auto h-3.5 w-28" />
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
