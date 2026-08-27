import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

/** A quiet loading state that preserves the black Practice canvas. */
export function PracticeSkeleton() {
  return (
    <div
      className="relative mx-auto flex min-h-[72svh] w-full max-w-[94rem] items-center justify-center overflow-hidden px-5 py-16 text-cream sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading practice"
    >
      <RouteProgress />
      <div className="practice-accent-glow absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 opacity-80" />
      <div className="relative flex flex-col items-center text-center">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--workspace-accent)] shadow-[0_0_22px_var(--workspace-accent)]" />
        <p className="mt-5 text-[15px] font-semibold text-cream">
          Preparing your practice sessions
        </p>
        <p className="mt-2 text-sm leading-6 text-cream/48">
          Matching your roadmap with the same focused path as your interviews.
        </p>
      </div>
    </div>
  );
}
