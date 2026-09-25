"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type { WorkspaceAccent } from "@/lib/workspace/accent";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { workspaceMutationFetch } from "@/lib/workspace/summary-cache-invalidation";

export interface InterviewLaunchCopy {
  /** Small label above the headline. */
  eyebrow: string;
  headline: string;
  body: string;
  /** What Maya says out loud. Defaults to the body copy. */
  script?: string | string[];
}

interface InterviewStartPayload {
  success?: boolean;
  data?: { sessionId: string };
  error?: {
    code?: string;
    message?: string;
    details?: { retryAfterMs?: number };
  };
}

/**
 * A start request is idempotent from the candidate's perspective. If another
 * mount is already preparing it, wait for that request to publish the durable
 * session instead of exposing the internal creation lease as a page error.
 */
export async function startInterviewWhenReady(
  startPath: string,
  token: string,
  signal: AbortSignal
): Promise<{ sessionId: string }> {
  while (!signal.aborted) {
    const response = await workspaceMutationFetch(startPath, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal
    });
    const payload = (await response.json()) as InterviewStartPayload;
    if (response.ok && payload.success && payload.data?.sessionId) return payload.data;

    if (response.status === 409 && payload.error?.code === "INTERVIEW_CREATION_IN_PROGRESS") {
      const requestedDelay = payload.error.details?.retryAfterMs;
      await abortableDelay(Math.min(1_000, Math.max(150, requestedDelay ?? 500)), signal);
      continue;
    }

    throw new Error(payload.error?.message || "Could not start this interview.");
  }

  throw new DOMException("The interview start was cancelled.", "AbortError");
}

function abortableDelay(durationMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("The interview start was cancelled.", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(done, durationMs);
    signal.addEventListener("abort", aborted, { once: true });

    function done() {
      signal.removeEventListener("abort", aborted);
      resolve();
    }

    function aborted() {
      window.clearTimeout(timer);
      reject(new DOMException("The interview start was cancelled.", "AbortError"));
    }
  });
}

/**
 * The screen that stands between a workspace card and a live interview room:
 * The candidate's selected workspace coach introduces the round out loud while the session is created in the
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
  startingLabel,
  waitForVoiceBeforeNavigate = false,
  returnHref,
  navigateToInterview
}: {
  ready: boolean;
  startPath: string;
  copy: InterviewLaunchCopy;
  workspaceAccent: WorkspaceAccent;
  startingLabel?: string;
  /** Use the spoken handoff as the gate before entering a live room. */
  waitForVoiceBeforeNavigate?: boolean;
  /** Destination shown when this round is not yet ready. */
  returnHref?: string;
  /** Test seam; production navigation uses a hard replace into the live room. */
  navigateToInterview?: (sessionId: string) => void;
}) {
  const teacher = useWorkspaceTeacher();
  const [error, setError] = useState<string | null>(null);
  const [startAttempt, setStartAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const briefingStartedRef = useRef(false);
  const navigatingRef = useRef(false);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const scriptLines = useMemo(
    () => (Array.isArray(copy.script) ? copy.script : [copy.script ?? copy.body]),
    [copy.body, copy.script]
  );
  const script = scriptLines.join(" ");
  const continueToInterview = useCallback(() => {
    if (!pendingSessionId || navigatingRef.current) return;
    navigatingRef.current = true;
    if (navigateToInterview) {
      navigateToInterview(pendingSessionId);
    } else {
      window.location.replace(`/interview/voice?session=${pendingSessionId}`);
    }
  }, [navigateToInterview, pendingSessionId]);
  const playBriefing = useCallback(
    (lineIndex: number) => {
      const line = scriptLines[lineIndex];
      if (!line) {
        continueToInterview();
        return;
      }
      void speak(line, undefined, {
        onEnded: () => {
          const next = lineIndex + 1;
          if (next < scriptLines.length) {
            playBriefing(next);
          } else {
            continueToInterview();
          }
        },
        onError: continueToInterview
      }).then((result) => {
        if (result === "unavailable") continueToInterview();
        if (result === "blocked") briefingStartedRef.current = false;
      });
    },
    [continueToInterview, scriptLines, speak]
  );

  useEffect(() => {
    if (!ready || error || !isLoaded || !isSignedIn) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    setStarting(true);

    const launch = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Your sign-in session is not ready. Refresh the page and try again.");
        }

        const payload = await startInterviewWhenReady(startPath, token, controller.signal);

        if (cancelled) return;
        if (waitForVoiceBeforeNavigate) {
          setPendingSessionId(payload.sessionId);
          setStarting(false);
        } else {
          window.location.replace(`/interview/voice?session=${payload.sessionId}`);
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
    };

    // Development Strict Mode mounts and immediately discards one effect.
    // Deferring prevents that synthetic mount from starting server work that
    // its replacement would race against.
    const launchTimer = window.setTimeout(() => void launch(), 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(launchTimer);
      window.clearTimeout(timeout);
    };
  }, [
    error,
    getToken,
    isLoaded,
    isSignedIn,
    ready,
    startAttempt,
    startPath,
    teacher.name,
    waitForVoiceBeforeNavigate
  ]);

  useEffect(() => {
    if (waitForVoiceBeforeNavigate && !pendingSessionId) return;
    if (awaitingGesture || briefingStartedRef.current) return;
    const timer = window.setTimeout(() => {
      briefingStartedRef.current = true;
      playBriefing(0);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [awaitingGesture, pendingSessionId, playBriefing, script, stop, waitForVoiceBeforeNavigate]);

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
      if (pendingSessionId) continueToInterview();
      return;
    }

    setAwaitingGesture(false);
    briefingStartedRef.current = true;
    playBriefing(0);
  }

  return (
    <main
      data-workspace-accent={workspaceAccent}
      className="interview-launch-page blueprint workspace-black relative min-h-screen overflow-hidden px-6 py-10 text-cream sm:px-10 lg:px-16"
    >
      <span
        aria-hidden
        className="interview-ambient-glow pointer-events-none absolute -left-28 bottom-[-8rem] h-[30rem] w-[30rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[120px]"
      />
      <span
        aria-hidden
        className="interview-ambient-glow pointer-events-none absolute right-[4%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-20 blur-[140px]"
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
            <MayaStage speaking={state === "speaking"} performanceProfile="interview" />
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

          {!ready && returnHref ? (
            <Link
              href={returnHref}
              className="mt-8 inline-flex w-fit rounded-full border border-cream/20 px-5 py-2.5 text-sm font-semibold text-cream transition hover:border-cream/45"
            >
              Back to interviews
            </Link>
          ) : null}

          {ready && starting ? (
            <p className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cream/78">
              <Loader2
                size={15}
                className="animate-spin text-[var(--workspace-accent)]"
                aria-hidden="true"
              />
              {startingLabel ?? `${teacher.name} is preparing your round…`}
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
              {pendingSessionId && (state === "loading" || state === "speaking")
                ? "Skip intro"
                : state === "loading"
                  ? `Starting ${teacher.name}`
                  : state === "speaking"
                    ? `Stop ${teacher.name}`
                    : state === "unavailable"
                      ? "Voice unavailable"
                      : `Hear ${teacher.name}`}
            </button>
            {pendingSessionId ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  continueToInterview();
                }}
                className="rounded-full bg-cream px-5 py-2.5 text-sm font-semibold text-[#101113] transition hover:bg-cream-soft"
              >
                Continue to interview
              </button>
            ) : null}
            {awaitingGesture ? (
              <span className="text-xs text-cream/42">Tap to hear {teacher.name}</span>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
