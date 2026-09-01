function WarmBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-[#dfd6c8] motion-reduce:animate-none ${className}`}
    />
  );
}

export default function TrailguideLoading() {
  return (
    <div
      className="mentor-surface min-h-screen w-full"
      aria-busy="true"
      aria-label="Loading Trailguide"
    >
      <main className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-6 sm:px-8 lg:px-6 xl:px-0">
        <header className="flex items-center justify-between gap-4">
          <WarmBlock className="h-3 w-24 rounded-full" />
          <div className="flex gap-3">
            <WarmBlock className="h-9 w-32 rounded-full" />
            <WarmBlock className="h-9 w-36 rounded-full bg-[#cbc2b4]" />
          </div>
        </header>

        <section className="mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <WarmBlock className="h-14 w-[88%] rounded-2xl sm:h-16" />
            <WarmBlock className="mt-3 h-14 w-[70%] rounded-2xl sm:h-16" />
            <div className="mt-7 space-y-3">
              <WarmBlock className="h-3 w-[82%] rounded-full" />
              <WarmBlock className="h-3 w-[68%] rounded-full" />
            </div>
            <div className="mt-9 grid grid-cols-3 gap-5">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <WarmBlock className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <WarmBlock className="h-3 w-full rounded-full" />
                    <WarmBlock className="h-2.5 w-4/5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-[1.15rem] bg-[#e4dacb]">
            <div className="absolute inset-x-6 bottom-5 grid grid-cols-4 gap-5 rounded-2xl bg-[#f7f2e9] p-5">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <WarmBlock className="h-5 w-12 rounded-md bg-[#e9c7b4]" />
                  <WarmBlock className="h-2.5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14">
          <WarmBlock className="h-7 w-48 rounded-lg" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[1.2rem] bg-[#fbf8f0] shadow-[0_10px_32px_rgba(25,23,19,0.05)]"
              >
                <WarmBlock className="aspect-[1.52/1] w-full" />
                <div className="space-y-3 p-4">
                  <WarmBlock className="h-4 w-2/3 rounded-full" />
                  <WarmBlock className="h-3 w-1/2 rounded-full" />
                  <WarmBlock className="h-12 w-full rounded-lg" />
                  <WarmBlock className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
