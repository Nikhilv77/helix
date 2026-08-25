"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

export interface InterviewLaunchCopy {
  /** Small label above the headline. */
  eyebrow: string;
  headline: string;
  body: string;
  /** What Maya says out loud. Defaults to the body copy. */
  script?: string;
}

/**
 * The screen that stands between a workspace card and a live interview room:
 * Maya introduces the round out loud while the session is created in the
 * background, then the browser is sent straight into the room.
 *
 * `ready` decides whether that start actually happens, so the same screen also
 * carries the "not yet" states without a second layout.
 */
export function InterviewLaunchStage({
  ready,
  startPath,
  copy,
  workspaceAccent,
  startingLabel = "Maya is preparing your round…"
}: {
  ready: boolean;
  startPath: string;
  copy: InterviewLaunchCopy;
  workspaceAccent: WorkspaceAccent;
  startingLabel?: string;
}) {
  const teacher = useWorkspaceTeacher();
  const [error, setError] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const script = copy.script ?? copy.body;

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

        const response = await fetch(startPath, {
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
          throw new Error(
            payload.error?.message || `${teacher.name} could not start this interview.`
          );
        }

        if (!cancelled) {
          window.location.assign(`/interview/voice?session=${payload.data.sessionId}`);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof DOMException && caught.name === "AbortError"
              ? `${teacher.name} is taking too long to prepare this round. Try again.`
              : caught instanceof Error
                ? caught.message
                : `${teacher.name} could not start the interview.`
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
  }, [error, getToken, isLoaded, isSignedIn, ready, startAttempt, startPath, teacher.name]);

  useEffect(() => {
    if (awaitingGesture) return;
    const timer = window.setTimeout(() => void speak(script), 120);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [awaitingGesture, script, speak, stop]);

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

  function toggleMayaVoice() {
    if (state === "speaking" || state === "loading") {
      stop();
      return;
    }

    setAwaitingGesture(false);
    void speak(script);
  }

  return (
    <main
      data-workspace-accent={workspaceAccent}
      className="blueprint workspace-black relative min-h-screen overflow-hidden px-6 py-10 text-cream sm:px-10 lg:px-16"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-28 bottom-[-8rem] h-[30rem] w-[30rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[120px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[4%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-20 blur-[140px]"
      />

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="relative flex min-h-[25rem] items-end justify-center pb-0 lg:min-h-[34rem] lg:pr-16">
          <span
            aria-hidden
            className="report-maya-glow-a pointer-events-none absolute bottom-8 left-1/2 z-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[90px]"
          />
          <span
            aria-hidden
            className="report-maya-glow-b pointer-events-none absolute bottom-4 left-1/2 z-0 h-28 w-64 -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-20 blur-[70px]"
          />
          <div className="absolute inset-x-[-8%] bottom-0 top-0 z-10">
            <MayaStage speaking={state === "speaking"} />
          </div>
        </div>

        <div className="identity-stage-in flex flex-col justify-center py-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/52">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-xl font-semibold leading-[1.08] tracking-tight text-cream sm:text-2xl lg:text-3xl">
            {copy.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-cream/72 sm:text-lg">{copy.body}</p>

          {ready && starting ? (
            <p className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cream/78">
              <Loader2
                size={15}
                className="animate-spin text-[var(--workspace-accent)]"
                aria-hidden="true"
              />
              {startingLabel.replaceAll("Maya", teacher.name)}
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

          <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-cream/10 pt-5">
            <button
              type="button"
              onClick={toggleMayaVoice}
              disabled={state === "unavailable"}
              aria-label={state === "speaking" ? `Stop ${teacher.name}` : `Hear ${teacher.name}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-cream/76 transition hover:text-cream disabled:opacity-40"
            >
              {state === "loading" ? (
                <Loader2
                  size={16}
                  className="animate-spin text-[var(--workspace-accent)]"
                  aria-hidden="true"
                />
              ) : state === "speaking" ? (
                <VolumeX size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
              ) : (
                <Volume2 size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
              )}
              {state === "loading"
                ? `Starting ${teacher.name}`
                : state === "speaking"
                  ? `Stop ${teacher.name}`
                  : state === "unavailable"
                    ? "Voice unavailable"
                    : `Hear ${teacher.name}`}
            </button>
            {awaitingGesture ? (
              <span className="text-xs text-cream/42">Tap to hear {teacher.name}</span>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
