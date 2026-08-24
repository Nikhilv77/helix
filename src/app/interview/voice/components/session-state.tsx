import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  WifiOff
} from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { workspaceAccentCssVariables, type WorkspaceAccent } from "@/lib/workspace/accent";
import { formatClock } from "../utils/voice-interview";

export function VoiceShell({
  children,
  workspaceAccent,
  wide = false
}: {
  children: React.ReactNode;
  workspaceAccent: WorkspaceAccent;
  wide?: boolean;
}) {
  return (
    <main
      data-workspace-accent={workspaceAccent}
      style={workspaceAccentCssVariables(workspaceAccent) as CSSProperties}
      className="workspace-black relative h-[100dvh] overflow-hidden bg-black px-4 text-cream sm:px-8"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[140px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-20 blur-[150px]"
      />
      <div
        className={`relative z-10 mx-auto flex h-full w-full flex-col pt-4 sm:pt-5 ${
          wide ? "max-w-[96rem]" : "max-w-7xl"
        }`}
      >
        {children}
      </div>
    </main>
  );
}

export function SessionLoadingScreen({
  error,
  onRetry,
  workspaceAccent
}: {
  error: string | null;
  onRetry: () => void;
  workspaceAccent: WorkspaceAccent;
}) {
  return (
    <VoiceShell workspaceAccent={workspaceAccent}>
      <StateHeader />
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="relative w-full max-w-lg text-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-55 blur-[90px]"
          />
          <span className="relative mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-[var(--workspace-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
            {error ? (
              <WifiOff size={18} aria-hidden="true" />
            ) : (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            )}
          </span>
          <p className="relative mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/52">
            Secure interview room
          </p>
          <h1 className="relative mt-3 font-display text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {error ? "The room could not be loaded" : "Preparing your interview"}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-cream/64">
            {error ?? "Checking your session and getting Maya ready. This usually takes a moment."}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="relative mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          ) : (
            <div className="relative mx-auto mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/[0.07]">
              <span className="interview-loading-bar block h-full w-1/2 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_12px_var(--workspace-accent)]" />
            </div>
          )}
        </div>
      </section>
    </VoiceShell>
  );
}

export function SessionStateScreen({
  kind,
  duration = 0,
  answers = 0,
  workspaceAccent
}: {
  kind: "expired" | "complete";
  duration?: number;
  answers?: number;
  workspaceAccent: WorkspaceAccent;
}) {
  const complete = kind === "complete";

  if (complete) {
    return (
      <VoiceShell workspaceAccent={workspaceAccent}>
        <section className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="w-full max-w-xl">
            <div className="text-center">
              <CheckCircle2
                size={36}
                strokeWidth={1.65}
                className="mx-auto text-[var(--workspace-accent)] drop-shadow-[0_0_18px_var(--workspace-accent)]"
                aria-hidden="true"
              />
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-cream/45">
                Session saved
              </p>
              <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-cream sm:text-6xl">
                Interview complete.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-7 text-cream/62 sm:text-base">
                Your conversation is safely recorded. Take a breath, then review the signals Maya
                found or begin another focused round.
              </p>
            </div>

            <div className="mt-8 rounded-3xl  bg-[rgba(28,29,33,0.52)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:px-8 sm:py-7">
              <div className="space-y-5">
                <CompletionMetric
                  icon={<Clock3 size={17} aria-hidden="true" />}
                  label="Time practised"
                  value={formatClock(duration)}
                />
                <CompletionMetric
                  icon={<MessageSquareText size={17} aria-hidden="true" />}
                  label="Responses captured"
                  value={String(answers)}
                />
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-cream">Keep the momentum useful.</p>
                <p className="mt-1 text-sm leading-6 text-cream/48">
                  Review this round before repeating it, or switch focus for the next interview.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2.5">
              <Link
                href="/reports"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
              >
                <FileText size={15} aria-hidden="true" />
                View report
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                href="/interview?resume=1"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-cream/58 transition hover:bg-white/[0.04] hover:text-cream"
              >
                Practice another round
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                href="/"
                className="py-1 text-center text-sm font-medium text-cream/36 transition hover:text-cream/70"
              >
                Return to Trailgrad
              </Link>
            </div>
          </div>
        </section>
      </VoiceShell>
    );
  }

  return (
    <VoiceShell workspaceAccent={workspaceAccent}>
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.035] text-[var(--workspace-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
            <Clock3 size={24} aria-hidden="true" />
          </span>
          <p className="mt-7 text-sm font-mono uppercase tracking-[0.2em] text-cream/38">
            Session closed
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-cream sm:text-5xl">
            This interview has expired
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-cream/64 sm:text-base">
            Interview rooms close after their session window. Start a fresh round to reconnect with
            Maya.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/interview?resume=1"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white"
            >
              Start a new interview
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/60 transition hover:border-cream/35 hover:text-cream"
            >
              Return to Trailgrad
            </Link>
          </div>
        </div>
      </section>
    </VoiceShell>
  );
}

function CompletionMetric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 text-[var(--workspace-accent)]">{icon}</span>
      <div>
        <p className="text-sm font-medium text-cream/42">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-cream">{value}</p>
      </div>
    </div>
  );
}

function StateHeader() {
  return (
    <header className="flex items-center pb-5">
      <Link href="/" className="flex items-center gap-2.5 text-cream">
        <TrailgradMark className="h-7 w-7" />
        <span className="text-base font-semibold tracking-tight">Trailgrad</span>
      </Link>
      <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-cream/42">
        Interview studio
      </span>
    </header>
  );
}
