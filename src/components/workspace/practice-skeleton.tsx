import { RouteProgress } from "@/components/workspace/skeletons";

function Line({ className = "" }: { className?: string }) {
  return <div className={["skeleton h-3", className].join(" ")} />;
}

export function PracticeSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 pt-4 text-cream sm:px-8 lg:px-10 lg:pt-6"
      aria-busy="true"
      aria-label="Loading practice"
    >
      <RouteProgress />

      <section className="grid gap-5 rounded-[1.25rem] border border-cream/15 bg-cream/[0.035] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
        <div className="flex min-h-[18rem] flex-col justify-center">
          <Line className="w-32" />
          <div className="skeleton mt-4 h-10 w-5/6 max-w-xl" />
          <div className="skeleton mt-3 h-10 w-2/3 max-w-lg" />
          <Line className="mt-5 w-full max-w-2xl" />
          <Line className="mt-2 w-4/5 max-w-xl" />
          <div className="mt-7 flex flex-wrap gap-3">
            <div className="skeleton h-12 w-40 !rounded-2xl" />
            <div className="skeleton h-12 w-32 !rounded-2xl" />
          </div>
        </div>
        <div className="min-h-[18rem] rounded-2xl bg-cream/[0.055] p-5">
          <div className="skeleton mx-auto mt-8 h-36 w-36 !rounded-full" />
          <Line className="mx-auto mt-8 w-32" />
          <Line className="mx-auto mt-3 w-44" />
        </div>
      </section>

      <section className="mt-8">
        <div className="border-b border-cream/15 pb-4">
          <Line className="w-36" />
          <Line className="mt-3 w-80 max-w-full" />
        </div>
        <div className="divide-y divide-cream/10">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="grid gap-4 py-6 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="skeleton h-7 w-8 !rounded-lg" />
              <div>
                <div className="skeleton h-6 w-64 max-w-full" />
                <Line className="mt-3 w-full max-w-2xl" />
                <Line className="mt-2 w-3/4 max-w-xl" />
                <div className="mt-4 flex gap-2">
                  <div className="skeleton h-5 w-16 !rounded-md" />
                  <div className="skeleton h-5 w-20 !rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="skeleton h-5 w-16 !rounded-full" />
                <div className="skeleton h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
