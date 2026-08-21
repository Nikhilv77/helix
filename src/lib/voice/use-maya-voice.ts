"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachElement, detachVoice } from "./voice-bus";

export type VoiceState = "idle" | "loading" | "speaking" | "unavailable";
export type SpeakResult = "started" | "blocked" | "unavailable";

export function voiceUrl(line: string): string {
  return `/api/voice/speak?text=${encodeURIComponent(line)}`;
}

export function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

/**
 * Maya speaking on any surface outside the interview room. The element streams
 * straight from the route so playback starts on the first chunk, and it is
 * routed through the shared analyser so the avatar's mouth moves with it.
 */
export function useMayaVoice() {
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
    async (line: string): Promise<SpeakResult> => {
      stop();
      setState("loading");

      try {
        const element = new Audio(voiceUrl(line));
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
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { state, speak, stop, awaitingGesture, setAwaitingGesture } as const;
}
