import { describe, expect, it } from "vitest";
import { createTurnTimer } from "./turn-timing";

describe("voice turn timer", () => {
  it("measures one turn from the last word to the first reply audio, once", () => {
    let clock = 0;
    const timer = createTurnTimer(() => clock);
    timer.speech();
    clock = 400;
    timer.speech();
    clock = 1_150;
    timer.requestStarted();
    clock = 1_300;
    timer.speech(); // ignored: the answer is already on its way
    clock = 1_450;
    timer.responseReceived();
    clock = 2_050;

    expect(timer.audioStarted()).toEqual({
      speechToRequestMs: 750,
      requestMs: 300,
      responseToAudioMs: 600,
      speechToAudioMs: 1_650
    });
    // Later audio chunks of the same reply do not start a new turn.
    expect(timer.audioStarted()).toBeNull();
    expect(timer.takeReport()?.speechToAudioMs).toBe(1_650);
    expect(timer.takeReport()).toBeUndefined();
  });
});
