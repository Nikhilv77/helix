function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

function SkeletonCard() {
  return (
    <div className="rounded-[1.2rem] border border-white/[0.1] bg-[#17181b] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <div className="flex items-center gap-3">
        <span className="h-12 w-12 shrink-0 rounded-full border border-white/[0.1] bg-white/[0.035]" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-2.5 w-32" />
          <SkeletonLine className="h-2 w-52 max-w-full" />
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.035] p-3.5">
        <SkeletonLine className="h-2.5 w-40" />
        <SkeletonLine className="mt-2 h-2 w-56 max-w-full" />
      </div>
    </div>
  );
}

function SkeletonSection() {
  return (
    <section className="mt-14">
      <SkeletonLine className="h-2 w-20" />
      <SkeletonLine className="mt-3 h-5 w-48" />
      <SkeletonLine className="mt-3 h-2 w-80 max-w-full" />
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}

export function HelpHubSkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading Trailmate"
    >
      <div className="mx-auto w-full max-w-[88rem] animate-pulse px-4 pb-24 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <header className="flex flex-col items-center border-b border-white/[0.12] pb-10 sm:pb-12">
          <span className="h-24 w-24 rounded-full border border-white/[0.1] bg-[#17181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:h-28 sm:w-28" />
          <SkeletonLine className="mt-4 h-3 w-28" />
          <SkeletonLine className="mt-3 h-2 w-20" />
          <span className="mt-4 h-8 w-28 rounded-full border border-white/[0.1] bg-[#17181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]" />
        </header>

        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
      </div>
    </main>
  );
}
