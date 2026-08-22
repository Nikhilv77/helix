import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function ManageSkeleton() {
  return (
    <section
      className="relative mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading manage account"
    >
      <RouteProgress />
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-4xl flex-col items-center justify-center py-10 text-center">
        <div className="skeleton h-32 w-32 !rounded-full" />
        <div className="skeleton mt-8 h-12 w-full max-w-xl" />
        <Line className="mx-auto mt-6 w-full max-w-2xl" />
        <Line className="mx-auto mt-2 w-2/3 max-w-xl" />
        <div className="mx-auto mt-10 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <Line className="w-24" />
              <Line className="mt-4 w-full" />
              <Line className="mt-2 w-3/4" />
              <div className="skeleton mt-5 h-8 w-24 !rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
