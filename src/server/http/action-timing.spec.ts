import { afterEach, describe, expect, it, vi } from "vitest";
import { SLOW_ACTION_MS, timeAction } from "./action-timing";

describe("timeAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the action and exposes its duration as Server-Timing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await timeAction("practice.core-technical/attempt", async () =>
      Response.json({ ok: true }, { status: 201 })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("server-timing")).toMatch(
      /^action;desc="practice\.core-technical\/attempt";dur=\d+$/
    );
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"api.action_timing"');
    expect(line).toContain('"action":"practice.core-technical/attempt"');
    expect(line).toContain('"status":201');
  });

  it("warns for slow actions so they are easy to filter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    await timeAction("dsa.code-run", async () => {
      now = SLOW_ACTION_MS + 1;
      return new Response(null, { status: 200 });
    });

    expect(String(warn.mock.calls[0]?.[0])).toContain('"durationMs":2001');
  });

  it("records a 500 when the action throws and rethrows the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      timeAction("dsa.practice-feedback", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(String(log.mock.calls[0]?.[0])).toContain('"status":500');
  });

  it("tolerates responses whose headers cannot change", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await timeAction("dsa.block-assessment.start", async () =>
      Response.redirect("https://example.com/practice", 307)
    );

    expect(response.status).toBe(307);
  });
});
