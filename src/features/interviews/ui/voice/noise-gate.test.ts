import { describe, expect, it } from "vitest";
import { createNoiseGate } from "./gemini-live-interviewer";

const FRAME_MS = 32;
const frame = (level: number) => new Float32Array(512).fill(level);

function run(gate: ReturnType<typeof createNoiseGate>, levels: number[], start = 0) {
  return levels.map((level, index) => gate(frame(level), start + index * FRAME_MS));
}

describe("createNoiseGate", () => {
  it("passes speech and closes on boosted room noise from a distant microphone", () => {
    const gate = createNoiseGate();
    // 2 s of AGC-lifted hiss well above the fixed minimum.
    expect(run(gate, Array(62).fill(0.02)).slice(-10)).toEqual(Array(10).fill(false));
    // Speech about five times louder than the hiss opens the gate.
    expect(run(gate, [0.1, 0.12, 0.09], 62 * FRAME_MS)).toEqual([true, true, true]);
  });

  it("holds through a short pause, then closes so the turn can end", () => {
    const gate = createNoiseGate();
    run(gate, Array(30).fill(0.003));
    run(gate, Array(10).fill(0.08), 30 * FRAME_MS);
    const after = run(gate, Array(30).fill(0.003), 40 * FRAME_MS);
    expect(after.slice(0, 10).every(Boolean)).toBe(true); // within 450 ms
    expect(after.slice(-10).some(Boolean)).toBe(false);
  });

  it("hears a quiet speaker in a quiet room", () => {
    const gate = createNoiseGate();
    run(gate, Array(30).fill(0.001));
    expect(run(gate, [0.015], 30 * FRAME_MS)).toEqual([true]);
  });
});
