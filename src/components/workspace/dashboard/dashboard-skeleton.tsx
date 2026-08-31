import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/** Mirrors the merged teacher/coaching feature and readiness card. */
export function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-hidden bg-black"
      aria-busy="true"
      aria-label="Loading home"
    >
      <RouteProgress />
      <div className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-5">
          <div className="grid min-h-[21rem] overflow-hidden rounded-[1.65rem] bg-[#17181b] md:grid-cols-[minmax(14rem,0.82fr)_minmax(0,1.18fr)]">
            <div className="min-h-[17rem] bg-black/10 md:min-h-[21rem]" aria-hidden="true" />

            <div className="flex min-h-[21rem] flex-col p-5 sm:p-6 lg:p-7">
              <div className="flex justify-end">
                <div className="skeleton h-10 w-10 !rounded-xl" />
              </div>
              <div className="skeleton mt-6 h-8 w-4/5" />
              <div className="mt-5 space-y-2.5">
                <Line className="w-full" />
                <Line className="w-5/6" />
                <Line className="w-2/3" />
              </div>
              <div className="mt-auto flex items-center justify-between gap-4 pt-7">
                <Line className="w-24" />
                <div className="skeleton h-11 w-32 !rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[21rem] flex-col justify-center rounded-[1.65rem] bg-[#151619] p-7">
            <div className="skeleton h-7 w-4/5" />
            <Line className="mt-5 w-full" />
            <Line className="mt-2 w-5/6" />
            <div className="skeleton mt-7 h-11 w-32 !rounded-xl" />
          </div>
        </section>

        <section
          className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)] lg:gap-5"
          aria-label="Loading weekly direction"
        >
          <div className="grid min-h-[14rem] overflow-hidden rounded-[1.65rem] bg-[#17181b] md:grid-cols-[minmax(16rem,0.88fr)_minmax(24rem,1.12fr)]">
            <div className="flex flex-col p-5">
              <div className="flex items-center gap-3">
                <div className="skeleton h-9 w-9 !rounded-xl" />
                <Line className="w-24" />
              </div>
              <div className="skeleton mt-4 h-6 w-4/5" />
              <div className="mt-3 space-y-2">
                <Line className="w-full" />
                <Line className="w-5/6" />
              </div>
              <div className="mt-auto flex items-end justify-between gap-5 pt-5">
                <div className="flex gap-6">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="space-y-2">
                      <Line className="w-14" />
                      <Line className="w-8" />
                    </div>
                  ))}
                </div>
                <Line className="w-24" />
              </div>
            </div>

            <div className="flex items-center px-5 pb-5 md:py-5 md:pl-2">
              <div className="grid w-full grid-cols-7 gap-3 sm:gap-4">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="min-w-0">
                    <div className="skeleton h-32 !rounded-[1.45rem]" />
                    <Line className="mx-auto mt-2 w-5" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-[14rem] flex-col rounded-[1.65rem] bg-[#17181b] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="skeleton h-9 w-9 !rounded-xl" />
                <Line className="w-20" />
              </div>
              <Line className="w-24" />
            </div>
            <div className="skeleton mt-4 h-7 w-3/4" />
            <div className="mt-3 space-y-2">
              <Line className="w-full" />
              <Line className="w-5/6" />
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="space-y-2">
                <Line className="w-20" />
                <Line className="w-28" />
              </div>
              <Line className="w-16" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-4 pt-5">
              <Line className="w-28" />
              <div className="skeleton h-10 w-32 !rounded-xl" />
            </div>
          </div>
        </section>

        <section
          className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5"
          aria-label="Loading continuation cards"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="grid min-h-[14rem] overflow-hidden rounded-[1.65rem] bg-[#151619] sm:grid-cols-[minmax(0,1fr)_17rem]"
            >
              <div className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 !rounded-xl" />
                  <Line className="w-20" />
                </div>
                <div className="skeleton mt-4 h-6 w-3/5" />
                <div className="mt-3 space-y-2">
                  <Line className="w-full" />
                  <Line className="w-4/5" />
                </div>
                <div className="mt-auto pt-4">
                  <div className="skeleton h-10 w-36 !rounded-xl" />
                </div>
              </div>
              <div className="m-2.5 mt-0 grid min-h-[11rem] place-items-center rounded-[1.3rem] bg-black/20 sm:ml-0 sm:mt-2.5">
                {index === 0 ? (
                  <div className="w-44 space-y-3">
                    <Line className="w-24" />
                    <Line className="w-full" />
                    <Line className="w-5/6" />
                    <Line className="w-2/3" />
                    <div className="skeleton mt-6 h-2 w-full !rounded-full" />
                  </div>
                ) : (
                  <div className="w-44 space-y-3">
                    {Array.from({ length: 3 }, (_, step) => (
                      <div key={step} className="flex items-center gap-3">
                        <div className="skeleton h-7 w-7 shrink-0 !rounded-full" />
                        <Line className="w-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <section
          className="mt-5 grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5"
          aria-label="Loading progress and community"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-[13.25rem] flex-col rounded-[1.5rem] bg-[#17181b] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="skeleton h-8 w-8 !rounded-lg" />
                  <Line className="w-16" />
                </div>
                <Line className="w-20" />
              </div>
              <div className="skeleton mt-4 h-6 w-3/4" />
              <div className="mt-3 space-y-2">
                <Line className="w-full" />
                <Line className="w-4/5" />
              </div>
              <div className="mt-auto pt-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex gap-6">
                    <div className="space-y-2">
                      <Line className="w-16" />
                      <Line className="w-10" />
                    </div>
                    <div className="space-y-2">
                      <Line className="w-16" />
                      <Line className="w-10" />
                    </div>
                  </div>
                  <Line className="w-20" />
                </div>
                {index === 0 ? <div className="skeleton mt-2 h-1.5 w-full !rounded-full" /> : null}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
