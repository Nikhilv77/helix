"use client";

/**
 * One analyser for Maya's voice, wherever it comes from.
 *
 * In the interview room she arrives as a LiveKit MediaStreamTrack; in the
 * welcome dialog and on a session page she is an <audio> element streaming MP3
 * from /api/voice/speak. The avatar should not care which — it reads the bands
 * below and moves its mouth. Without this, everything outside the interview
 * room played audio with a completely still face.
 */

export interface VoiceBands {
  /** Overall loudness, 0-1, already gated against room noise. */
  level: number;
  /** Energy 250-800Hz — open vowels (aa). */
  low: number;
  /** Energy 800-2500Hz — front vowels (E, I). */
  mid: number;
  /** Energy 2500-6000Hz — sibilants and stops. */
  high: number;
  /** True while the signal is below the speech gate. */
  silent: boolean;
}

const SILENT: VoiceBands = { level: 0, low: 0, mid: 0, high: 0, silent: true };

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: AudioNode | null = null;
/** createMediaElementSource throws if the same element is wired twice. */
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let frequencies: Uint8Array<ArrayBuffer> | null = null;
let samples: Uint8Array<ArrayBuffer> | null = null;

function ensureContext(): AudioContext | null {
  if (context) return context;

  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;

  context = new Ctor();
  analyser = context.createAnalyser();
  // Keep syllables responsive while filtering the tiny level spikes that make
  // amplitude-driven lips look jittery rather than intentional.
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.45;
  frequencies = new Uint8Array(analyser.frequencyBinCount);
  samples = new Uint8Array(analyser.fftSize);
  return context;
}

function disconnectSource() {
  if (!source) return;
  try {
    source.disconnect();
  } catch {
    // Already torn down by the page; nothing to clean up.
  }
  source = null;
}

/** Routes an <audio> element through the analyser, keeping it audible. */
export function attachElement(element: HTMLMediaElement): void {
  const ctx = ensureContext();
  if (!ctx || !analyser) return;

  disconnectSource();
  let node = elementSources.get(element);
  if (!node) {
    node = ctx.createMediaElementSource(element);
    elementSources.set(element, node);
  }
  node.connect(analyser);
  // The element still has to reach the speakers, so pass it through.
  node.connect(ctx.destination);
  source = node;
  void ctx.resume().catch(() => null);
}

/** Routes a LiveKit track through the analyser. Playback stays with LiveKit. */
export function attachTrack(track: MediaStreamTrack): void {
  const ctx = ensureContext();
  if (!ctx || !analyser) return;

  disconnectSource();
  const node = ctx.createMediaStreamSource(new MediaStream([track]));
  node.connect(analyser);
  source = node;
  void ctx.resume().catch(() => null);
}

export function detachVoice(): void {
  disconnectSource();
}

function bandEnergy(from: number, to: number, nyquistPerBin: number): number {
  if (!frequencies) return 0;
  const start = Math.max(0, Math.floor(from / nyquistPerBin));
  const end = Math.min(frequencies.length - 1, Math.ceil(to / nyquistPerBin));
  let total = 0;
  for (let index = start; index <= end; index += 1) total += frequencies[index] ?? 0;
  const count = Math.max(1, end - start + 1);
  return total / count / 255;
}

export function readVoice(): VoiceBands {
  if (!analyser || !context || !frequencies || !samples) return SILENT;

  analyser.getByteFrequencyData(frequencies);
  analyser.getByteTimeDomainData(samples);

  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centred = ((samples[index] ?? 128) - 128) / 128;
    sum += centred * centred;
  }
  const rms = Math.sqrt(sum / samples.length);

  const nyquistPerBin = context.sampleRate / 2 / frequencies.length;
  const low = bandEnergy(250, 800, nyquistPerBin);
  const mid = bandEnergy(800, 2500, nyquistPerBin);
  const high = bandEnergy(2500, 6000, nyquistPerBin);

  // Gate: below this the signal is line noise, and an open jaw on silence is
  // what made the old mouth look slack between words.
  const silent = rms < 0.012;

  return {
    level: silent ? 0 : Math.min(1, rms * 5.2),
    low,
    mid,
    high,
    silent
  };
}
