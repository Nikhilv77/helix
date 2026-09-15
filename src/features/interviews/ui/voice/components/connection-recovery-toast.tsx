import { RefreshCw, WifiOff } from "lucide-react";

export function ConnectionRecoveryToast({
  interviewerName = "James",
  message,
  onReconnect
}: {
  interviewerName?: string;
  message?: string | null;
  onReconnect: () => void;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[80] bg-black/30 backdrop-blur-[3px]"
      />
      <aside
        role="alert"
        aria-live="assertive"
        aria-labelledby="connection-recovery-title"
        className="fixed left-1/2 top-1/2 z-[81] w-[min(27rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#151619]/[0.98] shadow-[0_32px_110px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      >
        <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
        <div className="p-5 text-center sm:p-6">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)] text-[var(--workspace-accent)]">
            <WifiOff size={19} aria-hidden="true" />
          </span>
          <h2
            id="connection-recovery-title"
            className="mt-4 text-xl font-semibold tracking-[-0.02em] text-cream"
          >
            {interviewerName} lost the connection
          </h2>
          <p className="mt-2 text-sm leading-6 text-cream/58">
            {message || "Your interview is paused. Your completed answers are safely saved."}
          </p>
          <button
            type="button"
            autoFocus
            onClick={onReconnect}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cream px-4 text-sm font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151619]"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Reconnect now
          </button>
          <p className="mt-3 text-xs text-cream/38">You’ll continue from the same question.</p>
        </div>
      </aside>
    </>
  );
}
