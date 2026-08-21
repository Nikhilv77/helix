import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { formatClock } from "../utils/voice-interview";

export function VoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint relative h-[100dvh] overflow-hidden px-4 sm:px-8">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col pt-6">{children}</div>
    </main>
  );
}

export function SessionLoadingScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <VoiceShell>
      <StateHeader />
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cream/15 bg-cream/[0.05] text-cream/70">
            {error ? <WifiOff size={20} aria-hidden="true" /> : <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
          </span>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/38">Secure interview room</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {error ? "The room could not be loaded" : "Preparing your interview"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-cream/48">
            {error ?? "Checking your session and getting Maya ready. This usually takes a moment."}
          </p>
          {error ? (
            <button type="button" onClick={onRetry} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white">
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          ) : <div className="mx-auto mt-7 h-1 w-28 overflow-hidden rounded-full bg-cream/10"><span className="interview-loading-bar block h-full w-1/2 rounded-full bg-cream/70" /></div>}
        </div>
      </section>
    </VoiceShell>
  );
}

export function SessionStateScreen({ kind, duration = 0, answers = 0 }: { kind: "expired" | "complete"; duration?: number; answers?: number }) {
  const complete = kind === "complete";
  return (
    <VoiceShell>
      <StateHeader />
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cream/15 bg-cream/[0.05] text-cream">
            {complete ? <CheckCircle2 size={24} aria-hidden="true" /> : <Clock3 size={24} aria-hidden="true" />}
          </span>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/38">{complete ? "Session saved" : "Session closed"}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cream sm:text-5xl">{complete ? "Interview complete" : "This interview has expired"}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-cream/50 sm:text-base">
            {complete ? "Your conversation has been saved. Start another round when you are ready to practice a different role or interview style." : "Interview rooms close after their session window. Start a fresh round to reconnect with Maya."}
          </p>
          {complete ? <div className="mx-auto mt-8 flex w-fit items-center divide-x divide-cream/12 border-y border-cream/12 py-3"><StateMetric label="Duration" value={formatClock(duration)} /><StateMetric label="Answers" value={String(answers)} /></div> : null}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/interview?resume=1" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white">
              {complete ? "Practice another round" : "Start a new interview"} <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/60 transition hover:border-cream/35 hover:text-cream">Return to Trailgrad</Link>
          </div>
        </div>
      </section>
    </VoiceShell>
  );
}

function StateMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-28 px-6 text-left"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/32">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-cream">{value}</p></div>;
}

function StateHeader() {
  return <header className="flex items-center border-b border-cream/10 pb-5"><Link href="/" className="flex items-center gap-2.5 text-cream"><TrailgradMark className="h-7 w-7" /><span className="text-base font-semibold tracking-tight">Trailgrad</span></Link><span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-cream/30">Interview studio</span></header>;
}
