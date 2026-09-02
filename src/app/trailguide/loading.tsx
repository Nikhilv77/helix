function WarmBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-[#dfd6c8] ${className}`} />;
}

export default function TrailguideLoading() {
  return (
    <div
      className="mentor-surface min-h-screen w-full"
      aria-busy="true"
      aria-label="Loading Trailguide"
    >
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-7 sm:px-8 lg:px-10 lg:pt-9">
        <header className="flex items-center justify-between gap-4">
          <WarmBlock className="h-3 w-24 rounded-full" />
          <div className="flex gap-3">
            <WarmBlock className="h-10 w-32 rounded-full" />
            <WarmBlock className="h-10 w-36 rounded-full bg-[#cbc2b4]" />
          </div>
        </header>

        <section className="grid items-center gap-12 pb-20 pt-14 lg:min-h-[690px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
          <div>
            <WarmBlock className="h-3 w-48 rounded-full" />
            <WarmBlock className="mt-6 h-14 w-[88%] rounded-xl sm:h-16" />
            <WarmBlock className="mt-3 h-14 w-[76%] rounded-xl sm:h-16" />
            <WarmBlock className="mt-3 h-14 w-[54%] rounded-xl sm:h-16" />
            <WarmBlock className="mt-8 h-3 w-[92%] rounded-full" />
            <WarmBlock className="mt-3 h-3 w-[72%] rounded-full" />
            <WarmBlock className="mt-8 h-12 w-40 rounded-full bg-[#cbc2b4]" />
            <div className="mt-12 grid grid-cols-3 gap-4 border-t border-black/10 pt-5">
              {Array.from({ length: 3 }, (_, index) => (
                <WarmBlock key={index} className="h-3 w-4/5 rounded-full" />
              ))}
            </div>
          </div>
          <WarmBlock className="min-h-[540px] rounded-[1.25rem] bg-[#cfc6bb] sm:min-h-[610px]" />
        </section>

        <section className="grid gap-12 border-b border-black/10 py-20 lg:grid-cols-2">
          <div className="space-y-4">
            <WarmBlock className="h-3 w-28 rounded-full" />
            <WarmBlock className="h-12 w-[78%] rounded-xl" />
            <WarmBlock className="h-12 w-[60%] rounded-xl" />
          </div>
          <div className="space-y-7 border-y border-black/10 py-7">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="grid grid-cols-2 gap-8">
                <WarmBlock className="h-4 w-4/5 rounded-full" />
                <WarmBlock className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
