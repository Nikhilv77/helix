"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 14;
const BAR_HEIGHTS = Array.from(
  { length: BAR_COUNT },
  (_, index) => `${30 + (index / BAR_COUNT) * 70}%`
);

/**
 * Live level from the candidate's own microphone.
 *
 * Doubles as a diagnostic: if these bars move, the browser is capturing and
 * publishing audio, which separates a local mic problem from a transcription
 * problem further down the pipeline.
 */
export function MicMeter({
  track,
  muted,
  onSignalChange
}: {
  track: MediaStreamTrack | null;
  muted: boolean;
  onSignalChange?: (hearing: boolean) => void;
}) {
  const raf = useRef(0);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const statusRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const paint = (active: number, label: string) => {
      for (let index = 0; index < barsRef.current.length; index += 1) {
        const bar = barsRef.current[index];
        if (!bar) continue;
        const on = index < active;
        bar.classList.toggle("bg-cream", on);
        bar.classList.toggle("bg-cream/15", !on);
      }
      if (statusRef.current) statusRef.current.textContent = label;
    };

    if (!track || muted) {
      paint(0, muted ? "Muted" : "Say something");
      onSignalChange?.(false);
      return;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    analyser.fftSize = coarsePointer ? 256 : 512;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);
    void context.resume().catch(() => null);

    const buffer = new Uint8Array(analyser.fftSize);
    let smoothed = 0;
    let lastHearing = false;
    let lastActive = -1;
    let lastSampleAt = 0;
    const sampleInterval = coarsePointer ? 50 : 1000 / 30;

    function tick(now: number) {
      raf.current = requestAnimationFrame(tick);
      if (now - lastSampleAt < sampleInterval) return;
      lastSampleAt = now;
      analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centred = ((buffer[i] ?? 128) - 128) / 128;
        sum += centred * centred;
      }

      const raw = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
      smoothed += (raw - smoothed) * 0.3;
      const active = Math.round(smoothed * BAR_COUNT);
      if (active !== lastActive) {
        lastActive = active;
        paint(active, active > 1 ? "Hearing you" : "Say something");
      }

      const hearing = smoothed > 0.025;
      if (hearing !== lastHearing) {
        lastHearing = hearing;
        onSignalChange?.(hearing);
      }
    }

    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => null);
      onSignalChange?.(false);
    };
  }, [muted, onSignalChange, track]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            ref={(element) => {
              barsRef.current[index] = element;
            }}
            className="w-[3px] rounded-full bg-cream/15 transition-colors duration-75"
            style={{ height }}
          />
        ))}
      </div>

      <span
        ref={statusRef}
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/40"
      >
        {muted ? "Muted" : "Say something"}
      </span>
    </div>
  );
}
