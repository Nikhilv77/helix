import { describe, expect, it } from "vitest";

import {
  MAX_PACKET_BYTES,
  STALE_AFTER_MS,
  SnapshotAssembler,
  encodeSnapshotPackets,
  hasChanged,
  isNewer,
  isStale,
  type WorkspaceState
} from "./snapshot";

const base = {
  code: "public int maxProfit(int[] prices) { return 0; }",
  language: "java",
  testOutput: "FAILED: expected 5 but was 0",
  failingTests: 2,
  selection: {
    startLineNumber: 1,
    startColumn: 12,
    endLineNumber: 1,
    endColumn: 21
  },
  streamId: "stream-1",
  seq: 1,
  at: 1_700_000_000_000
};

function assemble(
  input: WorkspaceState & { streamId: string; seq: number; at: number } = base,
  receivedAt = base.at + 50
) {
  const assembler = new SnapshotAssembler();
  let completed = null;
  for (const packet of encodeSnapshotPackets(input)) {
    completed = assembler.accept(packet, receivedAt) ?? completed;
  }
  return completed;
}

describe("snapshot packets", () => {
  it("round trips one revision", () => {
    expect(assemble()).toMatchObject({ ...base, v: 3, receivedAt: base.at + 50 });
  });

  it("keeps null output and failure count values", () => {
    expect(assemble({ ...base, testOutput: null, failingTests: null })).toMatchObject({
      testOutput: null,
      failingTests: null
    });
  });

  it("carries bounded visible test-case details to the helper", () => {
    const tests = [
      {
        index: 0,
        input: "nums = [1, 2, 3, 1]",
        expectedOutput: "true",
        actualOutput: "true",
        passed: true,
        error: null
      }
    ];
    expect(assemble({ ...base, runStatus: "1/1 tests passed", tests })).toMatchObject({
      runStatus: "1/1 tests passed",
      tests
    });
  });

  it("chunks and restores a large file without dropping its actively edited tail", () => {
    const code = `class Solution {\n${"  // filler\n".repeat(8_000)}return answer;\n}`;
    const packets = encodeSnapshotPackets({ ...base, code });

    expect(packets.length).toBeGreaterThan(1);
    expect(packets.every((packet) => packet.byteLength <= MAX_PACKET_BYTES)).toBe(true);
    expect(assemble({ ...base, code })?.code).toBe(code);
  });

  it("measures Unicode by bytes and still restores it exactly", () => {
    const code = "日本語のコメント".repeat(5_000);
    const packets = encodeSnapshotPackets({ ...base, code });
    expect(packets.every((packet) => packet.byteLength <= MAX_PACKET_BYTES)).toBe(true);
    expect(assemble({ ...base, code })?.code).toBe(code);
  });

  it("accepts chunks out of order but emits nothing until the revision is complete", () => {
    const packets = encodeSnapshotPackets({ ...base, code: "x".repeat(30_000) }).reverse();
    const assembler = new SnapshotAssembler();
    for (const packet of packets.slice(0, -1)) expect(assembler.accept(packet)).toBeNull();
    expect(assembler.accept(packets.at(-1)!)?.code).toBe("x".repeat(30_000));
  });

  it("rejects junk, oversized packets, and inconsistent chunks", () => {
    const assembler = new SnapshotAssembler();
    expect(assembler.accept(new TextEncoder().encode("not json"))).toBeNull();
    expect(assembler.accept(new Uint8Array(MAX_PACKET_BYTES + 1))).toBeNull();

    const packets = encodeSnapshotPackets({ ...base, code: "x".repeat(30_000) });
    const changed = JSON.parse(new TextDecoder().decode(packets[1])) as Record<string, unknown>;
    changed.language = "python";
    expect(assembler.accept(packets[0]!)).toBeNull();
    expect(assembler.accept(new TextEncoder().encode(JSON.stringify(changed)))).toBeNull();
  });
});

describe("ordering and staleness", () => {
  const current = { ...base, v: 3, receivedAt: base.at + 100 };

  it("orders a stream by sequence, not a potentially skewed wall clock", () => {
    expect(isNewer({ ...current, seq: 2, at: 1 }, current)).toBe(true);
    expect(isNewer({ ...current, seq: 1, at: base.at + 10_000 }, current)).toBe(false);
  });

  it("uses local receipt time for the live indicator", () => {
    expect(isStale(current, current.receivedAt + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale(current, current.receivedAt + STALE_AFTER_MS + 1)).toBe(true);
  });
});

describe("change detection", () => {
  it("publishes only when something visible moved", () => {
    const previous = {
      code: "a",
      language: "java",
      testOutput: null,
      failingTests: null,
      selection: null
    };
    expect(hasChanged(previous, null)).toBe(true);
    expect(hasChanged(previous, previous)).toBe(false);
    expect(hasChanged({ ...previous, code: "b" }, previous)).toBe(true);
    expect(hasChanged({ ...previous, testOutput: "failed" }, previous)).toBe(true);
    expect(
      hasChanged(
        {
          ...previous,
          selection: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1
          }
        },
        previous
      )
    ).toBe(true);
  });
});
