function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/** Matches the first-visit report screen before Maya invites a candidate to interview. */
export function ReportsEmptySkeleton() {
  return (
    <main
      className="min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading your first report"
    >
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <section className="mx-auto flex min-h-[calc(100svh-11rem)] w-full max-w-3xl flex-col items-center justify-center py-8 text-center">
          <div className="h-[15rem] w-full max-w-[26rem] rounded-2xl bg-white/[0.035] sm:h-[18rem] lg:h-[20rem]" />

          <div className="-mt-8 flex w-full max-w-2xl flex-col items-center sm:-mt-10">
            <div className="w-full max-w-xl rounded-2xl bg-[#17181b] px-5 py-4 text-left sm:px-6">
              <Line className="h-5 w-3/4" />
              <Line className="mt-3 h-5 w-full" />
              <Line className="mt-3 h-4 w-11/12" />
              <Line className="mt-2 h-4 w-4/5" />
            </div>
            <span className="mt-6 h-12 w-52 rounded-xl bg-white/[0.085]" />
          </div>
        </section>
      </div>
    </main>
  );
}

/** Matches the latest-interview report layout while its data is loading. */
export function ReportsSkeleton() {
  return (
    <main className="min-h-[100svh] w-full bg-black" aria-busy="true" aria-label="Loading reports">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <section className="mx-auto w-full max-w-6xl animate-pulse">
          <div className="flex items-end justify-between gap-5">
            <div className="space-y-3">
              <Line className="w-28" />
              <div className="skeleton h-12 w-72" />
              <Line className="w-96 max-w-full" />
            </div>
            <div className="skeleton hidden h-11 w-40 !rounded-xl sm:block" />
          </div>
          <div className="mt-9 grid gap-5 lg:grid-cols-2">
            <div className="min-h-[25rem] rounded-[1.5rem] bg-[#17181b] p-7">
              <div className="grid h-full gap-5 sm:grid-cols-[10rem_1fr] sm:items-center">
                <div className="skeleton mx-auto h-48 w-full max-w-40 !rounded-2xl" />
                <div className="space-y-4">
                  <Line className="w-36" />
                  <div className="skeleton h-9 w-44" />
                  <Line className="w-full" />
                  <Line className="w-4/5" />
                </div>
              </div>
            </div>
            <div className="min-h-[25rem] rounded-[1.5rem] bg-[#17181b] p-7">
              <Line className="w-32" />
              <div className="mt-7 grid gap-6 md:grid-cols-[12rem_1fr] md:items-center">
                <div className="skeleton mx-auto h-44 w-44 !rounded-full" />
                <div className="space-y-5">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Line key={index} className="w-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
