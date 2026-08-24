import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

/** A quiet transition that lets the Maya stage arrive without placeholder cards. */
export function ProgressSkeleton() {
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col overflow-hidden px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading progress"
    >
      <RouteProgress />
      <div className="relative flex flex-1 items-center justify-center">
        <span
          aria-hidden
          className="pointer-events-none absolute h-72 w-72 rounded-full bg-[var(--workspace-accent-soft)] blur-[96px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute h-40 w-64 rounded-full bg-[var(--workspace-accent)] opacity-20 blur-[80px]"
        />
      </div>
    </div>
  );
}
