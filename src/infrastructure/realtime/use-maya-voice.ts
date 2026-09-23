"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { personaById } from "@/lib/avatars/personas";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { attachElement, detachVoice } from "./voice-bus";

export type VoiceState = "idle" | "loading" | "speaking" | "unavailable";
export type SpeakResult = "started" | "blocked" | "unavailable";

export interface VoicePlaybackCallbacks {
  onEnded?: () => void;
  onError?: () => void;
  /** Prefer the streaming voice path for time-sensitive, newly generated copy. */
  delivery?: "quality" | "fast";
}

// Keep warmed media across client-side route transitions. A hook-local pool is
// destroyed with the onboarding page, exactly when the welcome modal needs it.
const preloadedAudio = new Map<string, HTMLAudioElement>();
const PRELOAD_LIMIT = 10;

export function voiceUrl(
  line: string,
  personaId?: string,
  delivery?: VoicePlaybackCallbacks["delivery"]
): string {
  const persona = personaId ? `&persona=${encodeURIComponent(personaId)}` : "";
  const deliveryMode = delivery === "fast" ? "&delivery=fast" : "";
  // Keep a model version in the URL as an extra guard for browser media caches.
  // The API still resolves and validates the model itself.
  const resolvedPersona = personaById(personaId);
  const voiceVersion = resolvedPersona
    ? `&v=${encodeURIComponent(`gemini-teacher-natural-v1:${resolvedPersona.geminiVoice}:${resolvedPersona.voice}`)}`
    : "";
  return `/api/voice/speak?text=${encodeURIComponent(line)}${persona}${voiceVersion}${deliveryMode}`;
}

export function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

export function preloadVoiceLine(line: string, personaId: string): void {
  if (!line.trim()) return;
  const url = voiceUrl(line, personaId);
  if (preloadedAudio.has(url)) return;

  const element = new Audio();
  element.preload = "auto";
  element.crossOrigin = "anonymous";
  element.src = url;
  element.load();
  preloadedAudio.set(url, element);

  if (preloadedAudio.size > PRELOAD_LIMIT) {
    const oldestUrl = preloadedAudio.keys().next().value;
    if (oldestUrl) {
      const oldest = preloadedAudio.get(oldestUrl);
      oldest?.pause();
      oldest?.removeAttribute("src");
      preloadedAudio.delete(oldestUrl);
    }
  }
}

/**
 * The selected teacher speaking outside the interview room. The element
 * streams from the route and is routed through the shared analyser so the
 * avatar's mouth moves with it.
 */
export function useMayaVoice() {
  const teacher = useWorkspaceTeacher();
  const audio = useRef<HTMLAudioElement | null>(null);
  const progressFrame = useRef<number | null>(null);
  const progressUpdatedAt = useRef(0);
  const [state, setState] = useState<VoiceState>("idle");
  const [progress, setProgress] = useState(0);
  const [awaitingGesture, setAwaitingGesture] = useState(false);

  const stop = useCallback(() => {
    if (progressFrame.current !== null) {
      window.cancelAnimationFrame(progressFrame.current);
      progressFrame.current = null;
    }
    const element = audio.current;
    if (element) {
      // Detach handlers first: tearing the element down fires error/ended,
      // which would otherwise report a working voice as broken.
      element.onended = null;
      element.onerror = null;
      element.ontimeupdate = null;
      element.onloadedmetadata = null;
      element.onplaying = null;
      element.pause();
      element.removeAttribute("src");
    }
    audio.current = null;
    detachVoice();
    progressUpdatedAt.current = 0;
    setProgress(0);
    setState("idle");
  }, []);

  const preload = useCallback(
    (line: string, personaId?: string) => {
      if (!line.trim()) return;
      const resolvedPersonaId = personaId ?? teacher.id;
      preloadVoiceLine(line, resolvedPersonaId);
    },
    [teacher.id]
  );

  const speak = useCallback(
    async (
      line: string,
      personaId?: string,
      callbacks?: VoicePlaybackCallbacks
    ): Promise<SpeakResult> => {
      stop();
      setAwaitingGesture(false);
      setState("loading");

      try {
        const resolvedPersonaId = personaId ?? teacher.id;
        const url = voiceUrl(line, resolvedPersonaId, callbacks?.delivery);
        // Reuse the exact element that was warmed during the prior step. A
        // separate Audio instance can trigger another streamed TTS request,
        // which is why a preloaded transition still appeared to be loading.
        const element = preloadedAudio.get(url) ?? new Audio();
        preloadedAudio.delete(url);
        if (!element.src) element.src = url;
        element.pause();
        try {
          element.currentTime = 0;
        } catch {
          // A streaming response may not be seekable until its metadata is
          // available; it is already positioned at its beginning in that case.
        }
        element.preload = "auto";
        element.crossOrigin = "anonymous";
        audio.current = element;
        const updateProgress = () => {
          const duration = element.duration;
          if (Number.isFinite(duration) && duration > 0) {
            const now = Date.now();
            if (now - progressUpdatedAt.current < 50) return;
            progressUpdatedAt.current = now;
            setProgress(Math.min(1, Math.max(0, element.currentTime / duration)));
          }
        };
        const stopProgressTracking = () => {
          if (progressFrame.current !== null) {
            window.cancelAnimationFrame(progressFrame.current);
            progressFrame.current = null;
          }
        };
        const trackProgress = () => {
          updateProgress();
          progressFrame.current = window.requestAnimationFrame(trackProgress);
        };
        element.onloadedmetadata = updateProgress;
        element.ontimeupdate = updateProgress;
        element.onplaying = () => {
          stopProgressTracking();
          progressFrame.current = window.requestAnimationFrame(trackProgress);
        };
        element.onended = () => {
          stopProgressTracking();
          if (audio.current === element) audio.current = null;
          detachVoice();
          setProgress(1);
          setState("idle");
          callbacks?.onEnded?.();
        };
        element.onerror = () => {
          stopProgressTracking();
          if (audio.current === element) audio.current = null;
          detachVoice();
          setState("unavailable");
          callbacks?.onError?.();
        };
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

  return { state, progress, speak, stop, preload, awaitingGesture, setAwaitingGesture } as const;
}
