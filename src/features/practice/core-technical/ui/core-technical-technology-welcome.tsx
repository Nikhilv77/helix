"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentTitle } from "@/components/document-title";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type {
  CoreTechnicalTechnology,
  CoreTechnicalTechnologyOption
} from "@/features/practice/core-technical/domain/technology-focus";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";

type PreparationPhase = "choosing" | "confirming" | "generating";

export function CoreTechnicalTechnologyWelcome({
  technologies
}: {
  technologies: CoreTechnicalTechnologyOption[];
}) {
  const router = useRouter();
  const requestPending = useRef(false);
  const [phase, setPhase] = useState<PreparationPhase>("choosing");
  const [selected, setSelected] = useState<CoreTechnicalTechnology | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state: voiceState, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = voiceState === "speaking";
  const script =
    phase === "choosing"
      ? `Good. This is your complete practice workspace. What technology do you want to learn? I found a few useful starting points from your resume.`
      : phase === "confirming"
        ? "Great choice. Let me understand where you are and pull together the right interview questions."
        : "I’m building your practice now: clear questions, practical examples, and the explanations you’ll need afterward.";

  useEffect(() => {
    if (awaitingGesture) return;
    const timer = window.setTimeout(() => void speak(script), 160);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [awaitingGesture, script, speak, stop]);

  const prepare = useCallback(
    async (technology: CoreTechnicalTechnology) => {
      if (requestPending.current) return;
      requestPending.current = true;
      setSelected(technology);
      setError(null);
      setAwaitingGesture(false);
      setPhase("confirming");

      try {
        const confirmation = await post("/api/practice/core-technical/confirm", { technology });
        const focusId = readFocusId(confirmation);
        if (!focusId) throw new Error("Your practice focus was not returned.");

        setPhase("generating");
        const storageKey = `core-technical-personalized:${focusId}`;
        const requestId = window.sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
        window.sessionStorage.setItem(storageKey, requestId);
        await post("/api/practice/core-technical/prepare", {
          requestId,
          focusRevisionId: focusId,
          personalized: true
        });
        window.sessionStorage.removeItem(storageKey);
        router.replace("/practice/core-technical");
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "I couldn’t finish the practice set. Your progress is safe—please try again."
        );
        setPhase("choosing");
        setSelected(null);
        requestPending.current = false;
      }
    },
    [router, setAwaitingGesture]
  );

  return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[86rem] items-center px-4 py-10 sm:px-8 lg:px-10">
      <DocumentTitle title="Practice" />
      <section
        aria-labelledby="practice-welcome-title"
        className="grid w-full items-center gap-8 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(30rem,1.28fr)] lg:gap-16"
      >
        <div className="relative mx-auto h-[17rem] w-full max-w-[25rem] sm:h-[23rem] lg:h-[31rem]">
          <svg
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute h-0 w-0"
          >
            <defs>
              <filter
                id="core-technical-avatar-edge-feather"
                x="-5%"
                y="-5%"
                width="110%"
                height="110%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur
                  in="SourceAlpha"
                  stdDeviation="1.35"
                  result="softenedAlpha"
                />
                <feComposite in="SourceGraphic" in2="softenedAlpha" operator="in" />
              </filter>
            </defs>
          </svg>
          <div
            data-avatar-feather="alpha-edge"
            className="relative h-full w-full"
            style={{
              maskImage:
                "linear-gradient(to bottom, #000 0%, #000 68%, rgba(0,0,0,.92) 76%, rgba(0,0,0,.48) 88%, transparent 100%), linear-gradient(to right, transparent 0%, rgba(0,0,0,.38) 7%, rgba(0,0,0,.9) 16%, #000 23%, #000 77%, rgba(0,0,0,.9) 84%, rgba(0,0,0,.38) 93%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to bottom, #000 0%, #000 68%, rgba(0,0,0,.92) 76%, rgba(0,0,0,.48) 88%, transparent 100%), linear-gradient(to right, transparent 0%, rgba(0,0,0,.38) 7%, rgba(0,0,0,.9) 16%, #000 23%, #000 77%, rgba(0,0,0,.9) 84%, rgba(0,0,0,.38) 93%, transparent 100%)",
              WebkitMaskComposite: "source-in",
              filter: "url(#core-technical-avatar-edge-feather)"
            }}
          >
            <MayaStage speaking={speaking} transparent performanceProfile="practice" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[44rem] lg:mx-0">
          <h1
            id="practice-welcome-title"
            className="max-w-[42rem] font-display text-[2.45rem] font-semibold leading-[1.03] tracking-[-0.045em] text-cream sm:text-[3.5rem]"
          >
            {phase === "choosing"
              ? "What do you want to get better at?"
              : "I’m building this around you."}
          </h1>
          {phase === "choosing" ? (
            <div className="mt-9">
              <div className="grid gap-2 sm:grid-cols-2">
                {technologies.map((technology) => (
                  <button
                    key={technology.value}
                    type="button"
                    aria-label={`${technology.label}: ${technology.detail}`}
                    onClick={() => void prepare(technology.value)}
                    className="group flex min-h-[6rem] items-center gap-3.5 rounded-xl border border-white/[0.075] px-5 py-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.09] text-cream/34 transition group-hover:text-[var(--workspace-accent)]">
                      {technology.resumeMatched ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] font-semibold tracking-[-0.012em] text-cream/90">
                        {technology.label}
                      </span>
                      <span className="mt-1.5 block text-[14px] leading-5 text-cream/48">
                        {technology.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="mt-9 flex items-center gap-3 text-[13px] font-medium text-cream/52"
              role="status"
            >
              <Loader2
                size={16}
                className="animate-spin text-[var(--workspace-accent)]"
                aria-hidden="true"
              />
              {phase === "confirming"
                ? "Reading your interview context…"
                : "Preparing your questions and learning guides…"}
              <span className="sr-only">Selected technology: {selected}</span>
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-5 text-[13px] leading-6 text-[#e7bd83]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

async function post(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(payload));
  return payload;
}

function readFocusId(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.focus)) return null;
  return typeof payload.data.focus.id === "string" ? payload.data.focus.id : null;
}

function readError(payload: unknown): string {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return "I couldn’t finish the practice set. Your progress is safe—please try again.";
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
