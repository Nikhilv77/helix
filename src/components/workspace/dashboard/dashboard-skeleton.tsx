import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/** Mirrors the preparation-path dashboard while roadmap data is loading. */
export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[84rem] overflow-x-clip px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading home"
    >
      <RouteProgress />
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(17rem,0.92fr)_minmax(0,1.1fr)] lg:gap-5">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-[17rem] flex-col rounded-2xl border border-white/[0.08] bg-[#1b1d20] p-5 sm:min-h-[20rem] lg:min-h-[23rem]"
          >
            <div className="flex items-center justify-between">
              <Line className="w-24" />
              <div className="skeleton h-8 w-8 !rounded-lg" />
            </div>
            <div className="skeleton mt-5 h-8 w-3/4" />
            <div className="mt-4 space-y-2.5">
              <Line className="w-full" />
              <Line className="w-5/6" />
              <Line className="w-2/3" />
            </div>
            <div className="mt-auto flex gap-2 pt-6">
              <div className="skeleton h-10 w-28 !rounded-xl" />
              <div className="skeleton h-10 w-20 !rounded-xl" />
            </div>
          </div>
        ))}
      </section>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="min-h-40 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex items-start gap-3">
              <div className="skeleton h-10 w-10 !rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Line className="w-3/4" />
                <Line className="w-full" />
                <Line className="w-2/3" />
              </div>
            </div>
            <div className="skeleton mt-5 h-8 w-full !rounded-lg" />
          </div>
        ))}
      </section>
    </div>
  );
}
