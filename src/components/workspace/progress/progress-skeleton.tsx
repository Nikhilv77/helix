import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function ProgressLine({ className = "" }: { className?: string }) {
  return <div className={["skeleton h-3 bg-cream/20", className].join(" ")} />;
}

export function ProgressSkeleton() {
  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading progress"
    >
      <RouteProgress />

      <section className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center overflow-hidden rounded-[1.75rem] bg-[#151619] px-4 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1fr)] lg:gap-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream sm:block">
          <div className="absolute left-8 top-20 h-20 w-44 rounded-2xl border border-cream/20 opacity-25" />
          <div className="absolute right-16 top-24 h-36 w-36 rounded-full border border-cream/20 opacity-25" />
          <div className="absolute bottom-12 right-[13%] h-20 w-44 border border-cream/20 opacity-20" />
        </div>

        <div className="relative z-10 hidden w-full max-w-[34rem] lg:block" />

        <div className="relative z-10 mx-auto w-full max-w-3xl lg:mx-0">
          <div className="space-y-4">
            <ProgressLine className="h-4 w-full max-w-2xl !rounded-full" />
            <ProgressLine className="h-4 w-5/6 max-w-xl !rounded-full" />
            <ProgressLine className="h-4 w-2/3 max-w-lg !rounded-full" />
          </div>

          <div className="mt-8 space-y-4 pl-8">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="relative">
                <span className="absolute -left-8 top-1 h-4 w-4 rounded-full border border-cream/20" />
                <ProgressLine className={index % 2 === 0 ? "w-11/12" : "w-4/5"} />
              </div>
            ))}
          </div>

          <div className="mt-7 border-t border-cream/20 pt-4">
            <div className="ml-auto h-3 w-36 rounded-full bg-cream/20" />
            <div className="mt-4 flex h-10 items-end gap-3">
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  key={index}
                  className="h-3 flex-1 rounded-full border border-cream/20 bg-cream/[0.06]"
                />
              ))}
            </div>
          </div>

          <div className="mt-6 h-14 w-full max-w-md rounded-2xl bg-cream/20" />
        </div>
      </section>
    </div>
  );
}
