import { Loader2 } from "lucide-react";

/** Full-screen loading state shown while an assessment room opens. */
export function AssessmentRoomLoading({ label = "Preparing your assessment…" }: { label?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="practice-paper fixed inset-0 z-[100] grid place-items-center bg-black text-cream/56"
    >
      <span className="flex items-center gap-3 text-[15px]">
        <Loader2
          size={18}
          className="text-[var(--workspace-accent)] motion-safe:animate-spin"
          aria-hidden="true"
        />
        {label}
      </span>
    </main>
  );
}
