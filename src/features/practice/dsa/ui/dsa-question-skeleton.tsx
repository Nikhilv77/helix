import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={["skeleton h-3", className].join(" ")} />;
}

export function DsaQuestionSkeleton() {
  return (
    <div
      className="w-full bg-black p-2 text-cream sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden"
      aria-busy="true"
      aria-label="Loading question"
    >
      <RouteProgress />

      <div className="mx-auto flex min-h-0 w-full max-w-[112rem] flex-col gap-2 xl:h-full">
        <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2.5 sm:px-4">
          <div className="skeleton h-9 w-9 !rounded-lg" />
          <Line className="h-4 w-44" />
          <div className="flex gap-1.5">
            <div className="skeleton h-6 w-12 !rounded-md" />
            <div className="skeleton h-6 w-16 !rounded-md" />
            <div className="skeleton hidden h-6 w-24 !rounded-md sm:block" />
          </div>
          <div className="ml-auto flex gap-1">
            <div className="skeleton h-9 w-32 !rounded-lg" />
          </div>
          <div className="flex w-full gap-2 border-t border-white/[0.06] pt-2.5 xl:w-auto xl:border-0 xl:pt-0">
            <div className="skeleton h-9 w-24 !rounded-lg" />
            <div className="skeleton h-9 w-16 !rounded-lg" />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
          <section className="min-h-[34rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619] xl:min-h-0">
            <div className="flex h-12 items-end gap-5 border-b border-white/[0.07] px-5 pb-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Line key={index} className={index === 0 ? "w-20" : "w-12"} />
              ))}
            </div>
            <div className="space-y-7 p-6">
              <div>
                <Line className="w-20" />
                <Line className="mt-4 w-full" />
                <Line className="mt-2 w-11/12" />
                <Line className="mt-2 w-4/5" />
              </div>
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="rounded-xl bg-black/20 p-4">
                  <Line className="w-16" />
                  <Line className="mt-4 w-5/6" />
                  <Line className="mt-2 w-3/5" />
                </div>
              ))}
            </div>
          </section>

          <section className="flex min-h-[38rem] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101214] xl:min-h-0">
            <div className="flex h-14 items-center gap-3 border-b border-white/[0.07] px-4">
              <Line className="w-20" />
              <div className="ml-auto skeleton h-9 w-32 !rounded-lg" />
              <div className="skeleton h-9 w-9 !rounded-lg" />
              <div className="skeleton h-9 w-24 !rounded-lg" />
            </div>
            <div className="flex-1 bg-[#0b0d10] p-5">
              <Line className="w-2/3" />
              <Line className="mt-3 w-1/2" />
              <Line className="mt-3 w-3/4" />
              <Line className="mt-8 w-3/5" />
              <Line className="mt-3 w-2/5" />
            </div>
            <div className="flex h-14 items-center justify-between border-t border-white/[0.07] bg-[#141619] px-4">
              <Line className="w-20" />
              <div className="skeleton h-9 w-28 !rounded-lg" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
