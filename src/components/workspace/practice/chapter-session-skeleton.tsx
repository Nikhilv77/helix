function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** A black, page-shaped transition for a Practice chapter. */
export function ChapterSessionSkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading practice chapter"
    >
      <div className="mx-auto w-full max-w-[94rem] animate-pulse px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <SkeletonLine className="h-2.5 w-32" />
        <header className="mt-8 flex flex-col items-center border-b border-white/[0.1] pb-10 text-center sm:pb-12">
          <span className="h-28 w-28 rounded-full border border-white/[0.1] bg-black" />
          <SkeletonLine className="mt-5 h-5 w-64 max-w-[75vw]" />
          <SkeletonLine className="mt-4 h-2.5 w-[32rem] max-w-[86vw]" />
        </header>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-24 items-center gap-4 rounded-[1.25rem] border border-white/[0.08] bg-black px-5"
            >
              <span className="h-10 w-10 rounded-xl border border-white/[0.08] bg-black" />
              <div className="flex-1">
                <SkeletonLine className="h-3 w-44" />
                <SkeletonLine className="mt-3 h-2 w-72 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
