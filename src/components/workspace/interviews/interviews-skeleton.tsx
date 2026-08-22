import { Mic } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function InterviewsSkeleton() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[84rem] overflow-x-clip px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading interviews"
    >
      <div className="mb-6 flex items-center justify-between border-b border-cream/15 pb-5">
        <div className="flex items-center gap-3">
          <TrailgradMark className="h-8 w-8 opacity-60" />
          <Line className="w-28" />
        </div>
        <Line className="w-20" />
      </div>

      <section className="grid gap-5 rounded-2xl border border-cream/15 bg-cream/[0.035] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
        <div className="flex min-h-[17rem] flex-col justify-center">
          <Line className="w-32" />
          <div className="skeleton mt-4 h-10 w-5/6 max-w-xl" />
          <div className="skeleton mt-3 h-10 w-2/3 max-w-lg" />
          <Line className="mt-5 w-full max-w-2xl" />
          <Line className="mt-2 w-4/5 max-w-xl" />
          <div className="mt-7 flex gap-3">
            <div className="skeleton h-12 w-40 !rounded-2xl" />
            <div className="skeleton h-12 w-36 !rounded-2xl" />
          </div>
        </div>
        <div className="min-h-[17rem] rounded-2xl bg-cream/[0.055] p-5">
          <div className="mx-auto mt-8 h-36 w-36 rounded-full bg-cream/[0.08]" />
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
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="grid gap-4 py-6 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="skeleton h-7 w-8 !rounded-lg" />
              <div>
                <div className="skeleton h-6 w-64 max-w-full" />
                <Line className="mt-3 w-full max-w-2xl" />
                <Line className="mt-2 w-3/4 max-w-xl" />
              </div>
              <div className="flex items-center gap-3">
                <div className="skeleton h-5 w-16 !rounded-full" />
                <div className="skeleton h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-7 flex items-center gap-3 border-t border-cream/15 pt-5">
        <Mic size={16} className="text-cream/30" aria-hidden="true" />
        <Line className="w-72 max-w-[70%]" />
      </div>
    </div>
  );
}
