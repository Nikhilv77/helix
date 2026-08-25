"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { personaById } from "@/lib/avatars/personas";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { attachElement, detachVoice } from "./voice-bus";

export type VoiceState = "idle" | "loading" | "speaking" | "unavailable";
export type SpeakResult = "started" | "blocked" | "unavailable";

export function voiceUrl(line: string, personaId?: string): string {
  const persona = personaId ? `&persona=${encodeURIComponent(personaId)}` : "";
  // Keep a model version in the URL as an extra guard for browser media caches.
  // The API still resolves and validates the model itself.
  const model = personaById(personaId)?.voice;
  const voiceVersion = model ? `&v=${encodeURIComponent(model)}` : "";
  return `/api/voice/speak?text=${encodeURIComponent(line)}${persona}${voiceVersion}`;
}

export function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

/**
 * The selected teacher speaking outside the interview room. The element
 * streams from the route and is routed through the shared analyser so the
 * avatar's mouth moves with it.
 */
export function useMayaVoice() {
  const teacher = useWorkspaceTeacher();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [awaitingGesture, setAwaitingGesture] = useState(false);

  const stop = useCallback(() => {
    const element = audio.current;
    if (element) {
      // Detach handlers first: tearing the element down fires error/ended,
      // which would otherwise report a working voice as broken.
      element.onended = null;
      element.onerror = null;
      element.pause();
      element.removeAttribute("src");
    }
    audio.current = null;
    detachVoice();
    setState("idle");
  }, []);

  const speak = useCallback(
    async (line: string, personaId?: string): Promise<SpeakResult> => {
      stop();
      setAwaitingGesture(false);
      setState("loading");

      try {
        const resolvedPersonaId = personaId ?? teacher.id;
        const element = new Audio(voiceUrl(line, resolvedPersonaId));
        element.playbackRate = personaById(resolvedPersonaId)?.speechRate ?? 1;
        element.preservesPitch = true;
        element.preload = "auto";
        element.crossOrigin = "anonymous";
        audio.current = element;
        element.onended = () => setState("idle");
        element.onerror = () => setState("unavailable");
        // Wire the analyser before play() so the first syllable is not silent
        // on the avatar's face.
        attachElement(element);
        await element.play();
        setState("speaking");
        return "started";
      } catch (error) {
        stop();
        // Arriving without a click of your own means autoplay was refused, not
        // that the voice is broken. Wait for any gesture instead.
        if (isAutoplayBlocked(error)) {
          setState("idle");
          setAwaitingGesture(true);
          return "blocked";
        }
        setState("unavailable");
        return "unavailable";
      }
    },
    [stop, teacher.id]
  );

  useEffect(() => stop, [stop]);

  return { state, speak, stop, awaitingGesture, setAwaitingGesture } as const;
}
