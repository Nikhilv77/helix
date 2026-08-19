import { RouteProgress } from "@/components/workspace/skeletons";

function Line({ className = "" }: { className?: string }) {
  return <div className={["skeleton h-3", className].join(" ")} />;
}

export function DsaQuestionSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 pt-4 text-cream sm:px-8 lg:px-10 lg:pt-6"
      aria-busy="true"
      aria-label="Loading question"
    >
      <RouteProgress />

      <div className="flex items-center gap-2 border-b border-cream/15 pb-5">
        <Line className="w-12" />
        <Line className="w-16" />
        <Line className="w-32" />
      </div>

      <section className="mt-6 rounded-[1.25rem] border border-cream/15 bg-cream/[0.035] p-5 sm:p-7">
        <div className="flex flex-wrap gap-2">
          <div className="skeleton h-6 w-16 !rounded-md" />
          <div className="skeleton h-6 w-24 !rounded-md" />
          <div className="skeleton h-6 w-32 !rounded-md" />
        </div>
        <div className="skeleton mt-5 h-10 w-5/6 max-w-3xl" />
        <div className="skeleton mt-3 h-10 w-2/3 max-w-2xl" />
        <Line className="mt-5 w-full max-w-3xl" />
        <Line className="mt-2 w-4/5 max-w-2xl" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="skeleton h-11 w-36 !rounded-xl" />
          <div className="skeleton h-11 w-24 !rounded-xl" />
          <div className="skeleton h-11 w-32 !rounded-xl" />
        </div>

        <div className="mt-8 grid gap-8 border-t border-cream/15 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="space-y-8">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="border-b border-cream/10 pb-7">
                <Line className="w-28" />
                <Line className="mt-4 w-full max-w-3xl" />
                <Line className="mt-2 w-5/6 max-w-2xl" />
                <Line className="mt-2 w-2/3 max-w-xl" />
              </div>
            ))}
          </div>
          <div className="min-h-[24rem] rounded-2xl bg-cream/[0.055] p-5">
            <div className="skeleton mx-auto h-36 w-36 !rounded-full" />
            <Line className="mx-auto mt-6 w-28" />
            <Line className="mx-auto mt-3 w-44" />
            <div className="mt-8 space-y-3">
              <div className="skeleton h-10 w-full !rounded-xl" />
              <div className="skeleton h-10 w-full !rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-cream/15 pt-6">
        <Line className="w-44" />
        <Line className="mt-3 w-96 max-w-full" />
        <div className="mt-5 divide-y divide-cream/10">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 py-5">
              <div className="skeleton h-8 w-8 !rounded-lg" />
              <div className="min-w-0 flex-1">
                <Line className="w-52 max-w-full" />
                <Line className="mt-2 w-80 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
