"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice } from "@/lib/use-maya-voice";

const MIN_SOLVED = 10;

export function DsaInterviewEntry({
  completedCount,
  firstName
}: {
  completedCount: number;
  firstName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);
  const [muted, setMuted] = useState(false);
  const [starting, setStarting] = useState(false);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();

  const ready = completedCount >= MIN_SOLVED;
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";
  const script = ready
    ? `${greeting} let's start. I'll choose three important function-based problems, prioritizing ones you've already solved. I'll ask one at a time, follow up when it matters, and keep the conversation moving.`
    : `${greeting} you've solved ${completedCount} practice question${completedCount === 1 ? "" : "s"} so far. Solve at least ${MIN_SOLVED} before we start a DSA interview, so the problems Maya asks about are ones you actually know.`;

  useEffect(() => {
    if (!ready || error || !isLoaded || !isSignedIn) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    setStarting(true);

    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Your sign-in session is not ready. Refresh the page and try again.");
        }

        const response = await fetch("/api/interview/dsa/start", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: { sessionId: string };
          error?: { message?: string };
        };
        if (!response.ok || !payload.success || !payload.data?.sessionId) {
          throw new Error(payload.error?.message || "Maya could not start the DSA interview.");
        }

        if (!cancelled) window.location.assign(`/interview/voice?session=${payload.data.sessionId}`);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof DOMException && caught.name === "AbortError"
              ? "Maya is taking too long to prepare this round. Try again."
              : caught instanceof Error
                ? caught.message
                : "Maya could not start the interview."
          );
          setStarting(false);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [error, getToken, isLoaded, isSignedIn, ready, startAttempt]);

  useEffect(() => {
    if (muted || awaitingGesture) return;
    const timer = window.setTimeout(() => void speak(script), 120);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [awaitingGesture, muted, script, speak, stop]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture]);

  function hearMaya() {
    if (muted) return;
    setAwaitingGesture(false);
    void speak(script);
  }

  return (
    <main className="blueprint relative min-h-screen overflow-hidden px-6 py-10 text-cream sm:px-10 lg:px-16">
      <div className="blueprint-glow" />
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="relative flex min-h-[25rem] items-end justify-center border-b border-cream/15 pb-0 lg:min-h-[34rem] lg:border-b-0 lg:border-r lg:pr-16">
          <div className="absolute inset-x-[-8%] bottom-0 top-0">
            <MayaStage speaking={state === "speaking"} />
          </div>

        </div>

        <div className="flex flex-col justify-center py-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/40">
            DSA interview
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-xl font-semibold leading-[1.05] tracking-tight sm:text-2xl lg:text-3xl">
            {ready ? `${greeting} let's start.` : `${greeting} let's get you ready first.`}
          </h1>
          <p className="mt-7 max-w-2xl text-[16px] leading-8 text-cream/65">
            {ready
              ? "I'll choose three important function-based problems, prioritizing ones you've already solved. I'll ask one at a time, follow up when it matters, and keep the conversation moving."
              : `You've solved ${completedCount} question${completedCount === 1 ? "" : "s"} so far. Solve at least ${MIN_SOLVED} practice questions first, then Maya can interview you on problems you actually know.`}
          </p>
          {ready && starting ? (
            <p className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cream/75">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Maya is choosing your questions…
            </p>
          ) : null}
          {error ? (
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <p className="text-sm text-[#f0a3a3]">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStartAttempt((value) => value + 1);
                }}
                className="text-sm font-semibold text-cream underline decoration-cream/35 underline-offset-4 transition hover:decoration-cream"
              >
                Try again
              </button>
            </div>
          ) : null}
          <div className="mt-9 flex items-center gap-4 border-t border-cream/15 pt-5">
            <button
              type="button"
              onClick={hearMaya}
              disabled={muted || state === "loading"}
              className="inline-flex items-center gap-2 text-sm font-semibold text-cream/75 transition hover:text-cream disabled:opacity-40"
            >
              <Volume2 size={16} aria-hidden="true" />
              {state === "speaking" ? "Maya is speaking" : "Hear Maya"}
            </button>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Unmute Maya" : "Mute Maya"}
              className="text-cream/45 transition hover:text-cream"
            >
              {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            </button>
            {awaitingGesture ? <span className="text-xs text-cream/40">Tap to hear Maya</span> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
