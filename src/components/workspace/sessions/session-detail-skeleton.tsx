import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function SessionDetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading interview session"
    >
      <RouteProgress />
      <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#151619] p-5 sm:p-7">
        <Line className="w-28" />
        <div className="skeleton mt-5 h-10 w-full max-w-3xl" />
        <div className="mt-5 space-y-3">
          <Line className="w-full max-w-4xl" />
          <Line className="w-5/6 max-w-3xl" />
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-[24rem] rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          {Array.from({ length: 5 }, (_, index) => <Line key={index} className={index === 4 ? "mt-5 w-2/3" : "mb-4 w-full"} />)}
        </div>
        <div className="min-h-[18rem] rounded-2xl border border-white/[0.08] bg-[#1b1d20] p-5">
          <div className="skeleton h-32 w-32 !rounded-full" />
        </div>
      </div>
    </div>
  );
}
