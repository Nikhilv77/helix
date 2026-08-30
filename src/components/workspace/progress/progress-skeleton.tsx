function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** A black, page-shaped transition for Maya's progress briefing. */
export function ProgressSkeleton() {
  return (
    <main className="min-h-[100svh] w-full bg-black" aria-busy="true" aria-label="Loading progress">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
        <section className="flex min-h-[calc(100svh-9rem)] w-full flex-col items-center justify-center py-8">
          <span className="h-56 w-56 rounded-full border border-white/[0.08] bg-white/[0.035] sm:h-64 sm:w-64" />

          <div className="-mt-8 w-full max-w-2xl sm:-mt-10">
            <div className="rounded-2xl bg-[#17181b] px-5 py-5 sm:px-7 sm:py-6">
              <SkeletonLine className="h-5 w-3/4" />
              <SkeletonLine className="mt-3 h-5 w-full" />
              <SkeletonLine className="mt-3 h-5 w-11/12" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="mt-1 h-5 w-5 shrink-0 rounded-md bg-white/[0.055]" />
                    <div className="flex-1">
                      <SkeletonLine className="h-4 w-24" />
                      <SkeletonLine className="mt-2 h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <span className="mx-auto mt-7 block h-12 w-44 rounded-2xl bg-white/[0.085]" />
          </div>
        </section>
      </div>
    </main>
  );
}
