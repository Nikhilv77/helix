/**
 * Route skeletons. Each mirrors the real page's structure — same containers,
 * same card rhythm — so the layout does not jump when the data lands.
 */

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/** A hairline bar across the top of the page while a route resolves. */
export function RouteProgress() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <div className="route-progress h-full w-full bg-gradient-to-r from-transparent via-cream to-transparent" />
    </div>
  );
}

function CardSkeleton({ className = "", lines = 3 }: { className?: string; lines?: number }) {
  return (
    <section className={`surface p-6 sm:p-7 ${className}`}>
      <div className="flex items-center gap-3.5">
        <div className="skeleton h-10 w-10 !rounded-xl" />
        <Line className="w-36" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Line key={index} className={index === lines - 1 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="pb-4" aria-busy="true" aria-label="Loading workspace">
      <RouteProgress />

      <header className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-transparent">
        <div className="mx-auto grid w-full max-w-[110rem] gap-8 px-5 pb-9 pt-8 sm:px-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-center lg:gap-12 lg:px-10">
          <div className="skeleton mx-auto h-56 w-full max-w-[18rem] !rounded-3xl sm:h-64 lg:h-72 lg:max-w-none" />
          <div>
            <Line className="w-32" />
            <div className="skeleton mt-4 h-9 w-3/4 max-w-lg" />
            <Line className="mt-4 w-full max-w-2xl" />
            <Line className="mt-2.5 w-2/3 max-w-xl" />
            <div className="mt-6 flex flex-wrap gap-2.5">
              <div className="skeleton h-12 w-44 !rounded-xl" />
              <div className="skeleton h-12 w-36 !rounded-xl" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[110rem] px-5 sm:px-8 lg:px-10">
        <div className="mt-10">
          <Line className="w-28" />
          <div className="skeleton mt-3 h-7 w-72" />
          <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="surface p-5">
                <div className="flex items-start justify-between">
                  <div className="skeleton h-11 w-11 !rounded-xl" />
                  <div className="skeleton h-6 w-16 !rounded-full" />
                </div>
                <div className="skeleton mt-5 h-4 w-40" />
                <Line className="mt-3 w-full" />
                <Line className="mt-2 w-4/5" />
                <div className="mt-6 flex items-center justify-between">
                  <div className="skeleton h-5 w-20 !rounded-full" />
                  <div className="skeleton h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[110rem] px-5 py-6 sm:px-8 lg:px-10 lg:py-8"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <RouteProgress />

      <header className="surface-raised relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="skeleton h-32 w-32 !rounded-full sm:h-[10.5rem] sm:w-[10.5rem]" />
          <div className="min-w-0 flex-1">
            <Line className="w-24" />
            <div className="skeleton mt-3 h-9 w-64" />
            <Line className="mt-4 w-full max-w-md" />
            <div className="mt-5 flex gap-2.5">
              <div className="skeleton h-8 w-28 !rounded-full" />
              <div className="skeleton h-8 w-24 !rounded-full" />
            </div>
          </div>
          <div className="skeleton hidden h-52 w-64 !rounded-2xl lg:block" />
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)] lg:items-stretch">
        <div className="grid gap-5">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading report"
    >
      <RouteProgress />
      <Line className="w-24" />
      <div className="skeleton mt-3 h-8 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="surface p-5">
            <Line className="w-20" />
            <div className="skeleton mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <CardSkeleton className="mt-4" lines={5} />
      <CardSkeleton className="mt-4" lines={4} />
    </div>
  );
}
