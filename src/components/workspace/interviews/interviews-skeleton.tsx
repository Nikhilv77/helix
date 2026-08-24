import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

/** A quiet transition while the interview sessions and their progress load. */
export function InterviewsSkeleton() {
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col overflow-hidden px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pt-16"
      aria-busy="true"
      aria-label="Loading interviews"
    >
      <RouteProgress />
      <div className="relative flex flex-1 items-center justify-center">
        <span
          aria-hidden
          className="pointer-events-none absolute h-80 w-80 rounded-full bg-[var(--workspace-accent-soft)] blur-[104px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute h-44 w-72 rounded-full bg-[var(--workspace-accent)] opacity-20 blur-[84px]"
        />
      </div>
    </div>
  );
}
