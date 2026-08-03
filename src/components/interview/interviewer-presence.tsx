"use client";

import { useEffect, useRef } from "react";

export type PresenceState = "connecting" | "listening" | "speaking" | "thinking" | "ended";

interface InterviewerPresenceProps {
  /** The agent's audio. Drives the contour displacement in real time. */
  agentTrack: MediaStreamTrack | null;
  /** The candidate's mic. Drives the listening ring. */
  localTrack: MediaStreamTrack | null;
  state: PresenceState;
}

const TAU = Math.PI * 2;
const CREAM = "239, 232, 214";

/**
 * A figure drawn as blueprint contour lines, sculpted by live audio.
 *
 * Deliberately abstract rather than a rendered face: an almost-real human is
 * unsettling to be interviewed by, and a photoreal avatar would imply a person
 * who is not there. Presence comes from responsiveness, not resemblance —
 * every line here moves because of actual sound in the room.
 */
export function InterviewerPresence({
  agentTrack,
  localTrack,
  state
}: InterviewerPresenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentAnalyser = useAnalyser(agentTrack);
  const localAnalyser = useAnalyser(localTrack);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let width = 0;
    let height = 0;
    let smoothed = 0;
    let localSmoothed = 0;
    let phase = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    function amplitude(analyser: AnalyserNode | null, buffer: Uint8Array | null): number {
      if (!analyser || !buffer) return 0;
      analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centred = ((buffer[i] ?? 128) - 128) / 128;
        sum += centred * centred;
      }
      return Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
    }

    function draw() {
      frame = requestAnimationFrame(draw);

      const current = stateRef.current;
      const agentLevel = amplitude(agentAnalyser.current.node, agentAnalyser.current.buffer);
      const localLevel = amplitude(localAnalyser.current.node, localAnalyser.current.buffer);

      // Ease toward the target so the figure breathes instead of twitching.
      smoothed += (agentLevel - smoothed) * 0.22;
      localSmoothed += (localLevel - localSmoothed) * 0.2;
      phase += reduced ? 0 : 0.012 + smoothed * 0.05;

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.42;

      ctx!.clearRect(0, 0, width, height);

      const idle = current === "listening" || current === "connecting";
      // A slow breath keeps the figure alive when nothing is being said.
      const breath = reduced ? 0 : Math.sin(phase * 0.6) * 0.012;
      const energy = idle ? breath + localSmoothed * 0.08 : smoothed;

      drawHalo(ctx!, cx, cy, radius, energy, current);
      drawOuterRing(ctx!, cx, cy, radius, phase, reduced);
      drawSpectrum(ctx!, cx, cy, radius, agentAnalyser.current, energy, reduced);
      drawFigure(ctx!, cx, cy, radius, energy, phase, current, reduced);
      drawListeningArc(ctx!, cx, cy, radius, localSmoothed, current);
    }

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [agentAnalyser, localAnalyser]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}

function drawHalo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  energy: number,
  state: PresenceState
) {
  if (state === "ended") return;
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * (1.5 + energy));
  const strength = state === "speaking" ? 0.2 + energy * 0.32 : 0.09;
  glow.addColorStop(0, `rgba(${CREAM}, ${strength})`);
  glow.addColorStop(1, `rgba(${CREAM}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (1.5 + energy), 0, TAU);
  ctx.fill();
}

function drawOuterRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  phase: number,
  reduced: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(reduced ? 0 : phase * 0.12);
  ctx.strokeStyle = `rgba(${CREAM}, 0.22)`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.24, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Radial bars driven by the agent's frequency content. */
function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  source: { node: AnalyserNode | null; freq: Uint8Array | null },
  energy: number,
  reduced: boolean
) {
  const bars = 96;
  const inner = radius * 1.05;

  if (source.node && source.freq) {
    source.node.getByteFrequencyData(source.freq as Uint8Array<ArrayBuffer>);
  }

  ctx.strokeStyle = `rgba(${CREAM}, ${0.16 + energy * 0.5})`;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";

  for (let i = 0; i < bars; i += 1) {
    const angle = (i / bars) * TAU - Math.PI / 2;
    const bin = source.freq ? (source.freq[Math.floor((i / bars) * 60) + 2] ?? 0) / 255 : 0;
    const fallback = reduced ? 0.12 : 0.1 + Math.abs(Math.sin(i * 0.7)) * 0.1;
    const length = radius * (0.06 + (source.freq ? bin * 0.34 : fallback * energy));

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * (inner + length), cy + Math.sin(angle) * (inner + length));
    ctx.stroke();
  }
}

/**
 * Head and shoulders, rendered only as horizontal contour lines that ripple
 * with the voice — a topographic reading of a person rather than a portrait.
 */
function drawFigure(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  energy: number,
  phase: number,
  state: PresenceState,
  reduced: boolean
) {
  const r = radius;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.ellipse(0, -r * 0.3, r * 0.27, r * 0.34, 0, 0, TAU);
  ctx.moveTo(-r * 0.72, r * 0.86);
  ctx.bezierCurveTo(-r * 0.68, r * 0.26, -r * 0.3, r * 0.08, 0, r * 0.08);
  ctx.bezierCurveTo(r * 0.3, r * 0.08, r * 0.68, r * 0.26, r * 0.72, r * 0.86);
  ctx.closePath();
  ctx.clip();

  const spacing = Math.max(5, r * 0.052);
  const amplitude = r * (0.012 + energy * 0.16);
  const dim = state === "ended" ? 0.18 : state === "speaking" ? 0.85 : 0.5;

  for (let y = -r; y <= r; y += spacing) {
    // Lines nearer the middle of the face carry more of the movement.
    const falloff = 1 - Math.min(1, Math.abs(y + r * 0.2) / (r * 1.1));
    ctx.beginPath();
    for (let x = -r; x <= r; x += 4) {
      const wave =
        Math.sin(x * 0.035 + phase * 2.2 + y * 0.03) * amplitude * falloff +
        (reduced ? 0 : Math.sin(x * 0.011 - phase * 0.9) * r * 0.006);
      const py = y + wave;
      if (x === -r) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = `rgba(${CREAM}, ${(0.1 + falloff * 0.42) * dim})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  ctx.restore();

  // The silhouette edge, so the figure reads clearly against the grid.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${CREAM}, ${state === "ended" ? 0.18 : 0.4})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.3, r * 0.27, r * 0.34, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, r * 0.86);
  ctx.bezierCurveTo(-r * 0.68, r * 0.26, -r * 0.3, r * 0.08, 0, r * 0.08);
  ctx.bezierCurveTo(r * 0.3, r * 0.08, r * 0.68, r * 0.26, r * 0.72, r * 0.86);
  ctx.stroke();
  ctx.restore();
}

/** A short arc that fills as the candidate speaks, so being heard is visible. */
function drawListeningArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  state: PresenceState
) {
  if (state === "ended" || level < 0.02) return;

  ctx.strokeStyle = `rgba(${CREAM}, ${0.25 + level * 0.6})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  const spread = Math.min(1, level * 2.4) * 0.9;
  ctx.arc(cx, cy, radius * 1.36, Math.PI / 2 - spread, Math.PI / 2 + spread);
  ctx.stroke();
}

/** Web Audio analyser bound to a live MediaStreamTrack. */
function useAnalyser(track: MediaStreamTrack | null) {
  const ref = useRef<{ node: AnalyserNode | null; buffer: Uint8Array | null; freq: Uint8Array | null }>({
    node: null,
    buffer: null,
    freq: null
  });

  useEffect(() => {
    if (!track) {
      ref.current = { node: null, buffer: null, freq: null };
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
    analyser.smoothingTimeConstant = 0.75;

    // Routed through a silent gain node: some browsers will not pump data
    // through an analyser that has no downstream connection.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(analyser);
    analyser.connect(mute);
    mute.connect(context.destination);

    void context.resume().catch(() => null);

    ref.current = {
      node: analyser,
      buffer: new Uint8Array(analyser.fftSize),
      freq: new Uint8Array(analyser.frequencyBinCount)
    };

    return () => {
      ref.current = { node: null, buffer: null, freq: null };
      source.disconnect();
      analyser.disconnect();
      mute.disconnect();
      void context.close().catch(() => null);
    };
  }, [track]);

  return ref;
}
