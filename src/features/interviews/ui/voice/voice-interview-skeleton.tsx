function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-full bg-white/[0.06] ${className}`} />;
}

/** A stable room-shaped fallback while the interview session is resolved. */
export function VoiceInterviewSkeleton() {
  return (
    <main
      className="interview-workspace-skeleton min-h-[100dvh] bg-[#f8f7f5] px-4 py-4 dark:bg-black sm:px-8 sm:py-5"
      aria-busy="true"
      aria-label="Loading interview"
    >
      <div className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-[96rem] animate-pulse flex-col gap-3 sm:h-[calc(100dvh-2.5rem)]">
        <header className="flex h-14 shrink-0 items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4">
          <SkeletonLine className="h-3 w-48 sm:w-72" />
          <div className="flex gap-2">
            <SkeletonLine className="h-9 w-20" />
            <SkeletonLine className="h-9 w-16" />
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111215] xl:min-h-0">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <SkeletonLine className="h-4 w-36" />
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <SkeletonLine className="h-5 w-3/4" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-5/6" />
              <SkeletonLine className="ml-auto mt-12 h-16 w-2/3" />
              <SkeletonLine className="h-20 w-3/4" />
            </div>
          </section>
          <aside className="hidden rounded-2xl border border-white/[0.08] bg-[#111215] xl:block" />
        </div>
      </div>
    </main>
  );
}
