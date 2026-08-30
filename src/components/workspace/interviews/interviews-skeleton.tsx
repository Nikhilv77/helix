function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Page-shaped fallback for the interview roadmap. */
export function InterviewsSkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading interviews"
    >
      <div className="mx-auto w-full max-w-[92rem] animate-pulse px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
        <section className="mx-auto max-w-3xl" aria-label="Loading interview introduction">
          <SkeletonLine className="mx-auto h-5 w-full max-w-[42rem]" />
          <SkeletonLine className="mx-auto mt-3 h-5 w-11/12 max-w-[37rem]" />
          <SkeletonLine className="mx-auto mt-3 h-5 w-3/4 max-w-[29rem]" />
        </section>

        <section className="mt-12 sm:mt-14" aria-label="Loading interview sessions">
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <article
                key={index}
                className="flex min-h-[28rem] flex-col rounded-[2rem] bg-[#17181b] p-7 lg:p-8"
              >
                <span className="h-20 w-20 rounded-[1.45rem] bg-white/[0.045] lg:h-24 lg:w-24" />

                <div className="mt-16">
                  <SkeletonLine className={index % 3 === 1 ? "h-6 w-3/4" : "h-6 w-2/3"} />
                  <SkeletonLine className="mt-3 h-6 w-1/2" />
                  <SkeletonLine className="mt-5 h-4 w-full" />
                  <SkeletonLine className="mt-2 h-4 w-11/12" />
                  <SkeletonLine className="mt-2 h-4 w-3/5" />
                </div>

                <div className="mt-5 flex gap-2">
                  <SkeletonLine className="h-6 w-16" />
                  <SkeletonLine className="h-6 w-20" />
                </div>
                <div className="mt-5 flex gap-2">
                  <SkeletonLine className="h-7 w-24" />
                  <SkeletonLine className="h-7 w-20" />
                  <SkeletonLine className="h-7 w-16" />
                </div>

                <SkeletonLine className="mt-auto h-4 w-28" />
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
