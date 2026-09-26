import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A square wave of the given amplitude has an RMS equal to that amplitude. */
let amplitude = 0;

class FakeAnalyser {
  fftSize = 1024;
  smoothingTimeConstant = 0;
  frequencyBinCount = 512;
  connect() {}
  getByteFrequencyData(target: Uint8Array) {
    target.fill(0);
  }
  getByteTimeDomainData(target: Uint8Array) {
    for (let index = 0; index < target.length; index += 1) {
      target[index] = 128 + Math.round(amplitude * 127 * (index % 2 ? 1 : -1));
    }
  }
}

class FakeAudioContext {
  sampleRate = 48_000;
  destination = {};
  createAnalyser() {
    return new FakeAnalyser();
  }
  createMediaElementSource() {
    return { connect() {}, disconnect() {} };
  }
  resume() {
    return Promise.resolve();
  }
}

async function loadBus() {
  vi.resetModules();
  return import("./voice-bus");
}

/** Plays a voice at one loudness for about two seconds of animation frames. */
function speak(bus: Awaited<ReturnType<typeof loadBus>>, rms: number): number {
  bus.attachElement({} as HTMLMediaElement);
  amplitude = rms;
  let level = 0;
  for (let frame = 0; frame < 120; frame += 1) level = bus.readVoice().level;
  return level;
}

describe("voice bus loudness", () => {
  beforeEach(() => vi.stubGlobal("AudioContext", FakeAudioContext));
  afterEach(() => {
    vi.unstubAllGlobals();
    amplitude = 0;
  });

  it("opens the mouth about equally for quiet and loud voices", async () => {
    const bus = await loadBus();
    // Roughly Deepgram's Zeus (-26 dBFS) against Neptune (-19 dBFS).
    const quiet = speak(bus, 0.05);
    const loud = speak(bus, 0.11);

    expect(quiet).toBeGreaterThan(0.45);
    expect(quiet / loud).toBeGreaterThan(0.85);
    expect(quiet / loud).toBeLessThan(1.15);
  });

  it("keeps the mouth closed on silence", async () => {
    const bus = await loadBus();
    expect(speak(bus, 0.005)).toBe(0);
  });
});
