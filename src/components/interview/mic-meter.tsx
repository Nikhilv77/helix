"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live level from the candidate's own microphone.
 *
 * Doubles as a diagnostic: if these bars move, the browser is capturing and
 * publishing audio, which separates a local mic problem from a transcription
 * problem further down the pipeline.
 */
export function MicMeter({ track, muted }: { track: MediaStreamTrack | null; muted: boolean }) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!track || muted) {
      setLevel(0);
      return;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);
    void context.resume().catch(() => null);

    const buffer = new Uint8Array(analyser.fftSize);
    let smoothed = 0;

    function tick() {
      raf.current = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centred = ((buffer[i] ?? 128) - 128) / 128;
        sum += centred * centred;
      }

      const raw = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
      smoothed += (raw - smoothed) * 0.3;
      setLevel(smoothed);
    }

    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => null);
    };
  }, [muted, track]);

  const bars = 14;
  const active = Math.round(level * bars);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
        {Array.from({ length: bars }, (_, index) => {
          const on = index < active;
          const height = 30 + (index / bars) * 70;
          return (
            <span
              key={index}
              className={`w-[3px] rounded-full transition-colors duration-75 ${
                on ? "bg-cream" : "bg-cream/15"
              }`}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/40">
        {muted ? "Muted" : active > 1 ? "Hearing you" : "Say something"}
      </span>
    </div>
  );
}
