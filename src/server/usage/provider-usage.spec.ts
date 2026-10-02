import { afterEach, describe, expect, it, vi } from "vitest";

import { configureProviderUsageSink, flushProviderUsage, recordProviderUsage } from "./provider-usage";

describe("provider usage recording", () => {
  afterEach(() => configureProviderUsageSink(null));

  it("does nothing until a sink is configured", async () => {
    recordProviderUsage({ kind: "text", provider: "gemini", model: "m", operation: "op", outcome: "success", durationMs: 5 });
    const sink = vi.fn();
    configureProviderUsageSink(sink);
    await flushProviderUsage();
    expect(sink).not.toHaveBeenCalled();
  });

  it("batches events and normalises the counts", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    configureProviderUsageSink(sink);
    recordProviderUsage({ kind: "speech", provider: "deepgram", model: "aura", operation: "voice.speak", outcome: "success", durationMs: 12.6, units: 40 });
    recordProviderUsage({ kind: "code", provider: "judge0", model: "py", operation: "code.run", outcome: "failure", durationMs: -3 });
    await flushProviderUsage();

    expect(sink).toHaveBeenCalledTimes(1);
    const [events] = sink.mock.calls[0]!;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ durationMs: 13, units: 40, inputTokens: 0, outputTokens: 0 });
    expect(events[1]).toMatchObject({ durationMs: 0, units: 0 });
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });

  it("drops a failed write instead of throwing into the call it describes", async () => {
    configureProviderUsageSink(vi.fn().mockRejectedValue(new Error("db down")));
    recordProviderUsage({ kind: "text", provider: "groq", model: "m", operation: "op", outcome: "success", durationMs: 1 });
    await expect(flushProviderUsage()).resolves.toBeUndefined();
  });
});
