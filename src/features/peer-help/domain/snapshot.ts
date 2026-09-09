/** Live, read-only learner workspace packets carried over the help room. */

export const SNAPSHOT_VERSION = 3;
export const SNAPSHOT_TOPIC = "help.workspace.v3";
export const MAX_PACKET_BYTES = 12_000;
export const STALE_AFTER_MS = 15_000;

const TEST_OUTPUT_LIMIT = 2_000;
const MAX_VISIBLE_TESTS = 6;
const TEST_VALUE_LIMIT = 180;
const MAX_CHUNKS = 32;
const MAX_CODE_BYTES = 160_000;
const ASSEMBLY_TTL_MS = 30_000;
const MAX_ASSEMBLIES = 4;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface CodeSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface WorkspaceTestCase {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error: string | null;
}

export interface WorkspaceState {
  code: string;
  language: string;
  testOutput: string | null;
  failingTests: number | null;
  selection: CodeSelection | null;
  runStatus?: string | null;
  tests?: WorkspaceTestCase[] | null;
}

export interface HelpSnapshot extends WorkspaceState {
  v: number;
  /** Random per learner tab/connection, so reconnect streams do not mix. */
  streamId: string;
  /** Monotonic inside one stream. */
  seq: number;
  /** Sender time is display metadata only; ordering never trusts clock sync. */
  at: number;
  /** Local receive time, used for the live/stale indicator. */
  receivedAt: number;
}

interface SnapshotChunk extends WorkspaceState {
  v: number;
  type: "workspace";
  streamId: string;
  seq: number;
  at: number;
  part: number;
  total: number;
}

interface Assembly {
  chunk: SnapshotChunk;
  pieces: Array<string | undefined>;
  receivedAt: number;
}

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function packetFor(chunk: SnapshotChunk): Uint8Array<ArrayBuffer> {
  const encoded = encoder.encode(JSON.stringify(chunk));
  if (encoded.byteLength > MAX_PACKET_BYTES) {
    throw new RangeError("Workspace packet exceeded the LiveKit data limit");
  }
  const packet = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  packet.set(encoded);
  return packet;
}

/**
 * Encode one atomic workspace revision into one or more reliable packets.
 *
 * Code is chunked rather than silently trimmed: a helper needs the actively
 * edited tail as much as the imports and signature at the top of the file.
 */
export function encodeSnapshotPackets(
  input: WorkspaceState & { streamId: string; seq: number; at: number }
): Uint8Array<ArrayBuffer>[] {
  const common = {
    v: SNAPSHOT_VERSION,
    type: "workspace" as const,
    streamId: input.streamId,
    seq: input.seq,
    language: input.language,
    testOutput: input.testOutput?.slice(0, TEST_OUTPUT_LIMIT) ?? null,
    failingTests: input.failingTests,
    selection: input.selection,
    runStatus: input.runStatus?.slice(0, 160) ?? null,
    tests: normalizeTests(input.tests),
    at: input.at
  };

  if (byteLength(input.code) > MAX_CODE_BYTES) {
    throw new RangeError("Workspace code is too large to share safely");
  }

  const pieces: string[] = [];
  let offset = 0;
  do {
    let low = offset;
    let high = input.code.length;
    let best = offset;

    // Measure the real JSON bytes; character counts are wrong for Unicode and
    // escaping. Pessimistic part/total values make the final envelope no larger.
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate: SnapshotChunk = {
        ...common,
        code: input.code.slice(offset, middle),
        part: MAX_CHUNKS - 1,
        total: MAX_CHUNKS
      };
      if (byteLength(JSON.stringify(candidate)) <= MAX_PACKET_BYTES) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (best === offset && offset < input.code.length) {
      throw new RangeError("Workspace metadata leaves no room for code");
    }
    pieces.push(input.code.slice(offset, best));
    offset = best;
    if (pieces.length > MAX_CHUNKS) {
      throw new RangeError("Workspace needs too many data packets");
    }
  } while (offset < input.code.length || pieces.length === 0);

  return pieces.map((code, part) => packetFor({ ...common, code, part, total: pieces.length }));
}

function decodeChunk(payload: Uint8Array): SnapshotChunk | null {
  if (payload.byteLength === 0 || payload.byteLength > MAX_PACKET_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(payload));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const value = parsed as Record<string, unknown>;

  if (value.v !== SNAPSHOT_VERSION || value.type !== "workspace") return null;
  if (typeof value.streamId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(value.streamId)) {
    return null;
  }
  if (!Number.isSafeInteger(value.seq) || (value.seq as number) < 1) return null;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return null;
  if (
    typeof value.language !== "string" ||
    value.language.length < 1 ||
    value.language.length > 40
  ) {
    return null;
  }
  if (typeof value.code !== "string") return null;
  if (value.testOutput !== null && typeof value.testOutput !== "string") return null;
  if (typeof value.testOutput === "string" && value.testOutput.length > TEST_OUTPUT_LIMIT) {
    return null;
  }
  if (
    value.failingTests !== null &&
    (!Number.isInteger(value.failingTests) ||
      (value.failingTests as number) < 0 ||
      (value.failingTests as number) > 10_000)
  ) {
    return null;
  }
  const selection = decodeSelection(value.selection);
  if (value.selection !== undefined && value.selection !== null && !selection) return null;
  if (!Number.isInteger(value.part) || !Number.isInteger(value.total)) return null;
  const tests = decodeTests(value.tests);
  if (value.tests !== undefined && value.tests !== null && !tests) return null;
  if (
    value.runStatus !== null &&
    value.runStatus !== undefined &&
    typeof value.runStatus !== "string"
  ) {
    return null;
  }
  const part = value.part as number;
  const total = value.total as number;
  if (total < 1 || total > MAX_CHUNKS || part < 0 || part >= total) return null;

  return {
    v: SNAPSHOT_VERSION,
    type: "workspace",
    streamId: value.streamId,
    seq: value.seq as number,
    at: value.at as number,
    part,
    total,
    code: value.code,
    language: value.language,
    testOutput: (value.testOutput as string | null) ?? null,
    failingTests: (value.failingTests as number | null) ?? null,
    selection,
    runStatus: typeof value.runStatus === "string" ? value.runStatus : null,
    tests
  };
}

/** Reassembles bounded chunks and emits only complete, internally consistent revisions. */
export class SnapshotAssembler {
  private readonly assemblies = new Map<string, Assembly>();

  accept(payload: Uint8Array, receivedAt = Date.now()): HelpSnapshot | null {
    this.prune(receivedAt);
    const chunk = decodeChunk(payload);
    if (!chunk) return null;

    const key = `${chunk.streamId}:${chunk.seq}`;
    let assembly = this.assemblies.get(key);
    if (!assembly) {
      assembly = {
        chunk,
        // Fill explicitly: Array#some skips sparse holes and would otherwise
        // mistake the first chunk for a complete revision.
        pieces: new Array<string | undefined>(chunk.total).fill(undefined),
        receivedAt
      };
      this.assemblies.set(key, assembly);
      this.trimOldest();
    } else if (!sameRevision(assembly.chunk, chunk)) {
      this.assemblies.delete(key);
      return null;
    }

    assembly.pieces[chunk.part] = chunk.code;
    assembly.receivedAt = receivedAt;
    if (assembly.pieces.some((piece) => piece === undefined)) return null;

    const code = assembly.pieces.join("");
    this.assemblies.delete(key);
    if (byteLength(code) > MAX_CODE_BYTES) return null;

    return {
      v: SNAPSHOT_VERSION,
      streamId: chunk.streamId,
      seq: chunk.seq,
      code,
      language: chunk.language,
      testOutput: chunk.testOutput,
      failingTests: chunk.failingTests,
      selection: chunk.selection,
      runStatus: chunk.runStatus ?? null,
      tests: chunk.tests ?? null,
      at: chunk.at,
      receivedAt
    };
  }

  reset(): void {
    this.assemblies.clear();
  }

  private prune(now: number): void {
    for (const [key, assembly] of this.assemblies) {
      if (now - assembly.receivedAt > ASSEMBLY_TTL_MS) this.assemblies.delete(key);
    }
  }

  private trimOldest(): void {
    while (this.assemblies.size > MAX_ASSEMBLIES) {
      const oldest = [...this.assemblies.entries()].sort(
        (a, b) => a[1].receivedAt - b[1].receivedAt
      )[0];
      if (!oldest) return;
      this.assemblies.delete(oldest[0]);
    }
  }
}

function sameRevision(a: SnapshotChunk, b: SnapshotChunk): boolean {
  return (
    a.total === b.total &&
    a.language === b.language &&
    a.testOutput === b.testOutput &&
    a.failingTests === b.failingTests &&
    sameSelection(a.selection, b.selection) &&
    a.runStatus === b.runStatus &&
    sameTests(a.tests, b.tests) &&
    a.at === b.at
  );
}

export function isNewer(incoming: HelpSnapshot, current: HelpSnapshot | null): boolean {
  if (!current) return true;
  return incoming.streamId === current.streamId
    ? incoming.seq > current.seq
    : incoming.receivedAt > current.receivedAt;
}

export function isStale(snapshot: HelpSnapshot, now = Date.now()): boolean {
  return now - snapshot.receivedAt > STALE_AFTER_MS;
}

export function hasChanged(next: WorkspaceState, previous: WorkspaceState | null): boolean {
  if (!previous) return true;
  return (
    next.code !== previous.code ||
    next.language !== previous.language ||
    next.testOutput !== previous.testOutput ||
    next.failingTests !== previous.failingTests ||
    next.runStatus !== previous.runStatus ||
    !sameTests(next.tests, previous.tests) ||
    !sameSelection(next.selection, previous.selection)
  );
}

function normalizeTests(tests: WorkspaceState["tests"]): WorkspaceTestCase[] | null {
  if (!tests?.length) return null;
  return tests.slice(0, MAX_VISIBLE_TESTS).map((test, index) => ({
    index: Number.isInteger(test.index) && test.index >= 0 ? test.index : index,
    input: test.input.slice(0, TEST_VALUE_LIMIT),
    expectedOutput: test.expectedOutput.slice(0, TEST_VALUE_LIMIT),
    actualOutput: test.actualOutput.slice(0, TEST_VALUE_LIMIT),
    passed: test.passed,
    error: test.error?.slice(0, TEST_VALUE_LIMIT) ?? null
  }));
}

function decodeTests(value: unknown): WorkspaceTestCase[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length > MAX_VISIBLE_TESTS) return null;
  const tests: WorkspaceTestCase[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return null;
    const test = candidate as Record<string, unknown>;
    if (
      !Number.isInteger(test.index) ||
      (test.index as number) < 0 ||
      typeof test.input !== "string" ||
      test.input.length > TEST_VALUE_LIMIT ||
      typeof test.expectedOutput !== "string" ||
      test.expectedOutput.length > TEST_VALUE_LIMIT ||
      typeof test.actualOutput !== "string" ||
      test.actualOutput.length > TEST_VALUE_LIMIT ||
      typeof test.passed !== "boolean" ||
      (test.error !== null && typeof test.error !== "string") ||
      (typeof test.error === "string" && test.error.length > TEST_VALUE_LIMIT)
    ) {
      return null;
    }
    tests.push({
      index: test.index as number,
      input: test.input,
      expectedOutput: test.expectedOutput,
      actualOutput: test.actualOutput,
      passed: test.passed,
      error: test.error as string | null
    });
  }
  return tests;
}

function sameTests(a: WorkspaceState["tests"], b: WorkspaceState["tests"]): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function decodeSelection(value: unknown): CodeSelection | null {
  if (value === undefined || value === null || typeof value !== "object") return null;
  const selection = value as Record<string, unknown>;
  const fields = [
    selection.startLineNumber,
    selection.startColumn,
    selection.endLineNumber,
    selection.endColumn
  ];
  if (
    fields.some(
      (field) => !Number.isInteger(field) || (field as number) < 1 || (field as number) > 1_000_000
    )
  ) {
    return null;
  }

  return {
    startLineNumber: selection.startLineNumber as number,
    startColumn: selection.startColumn as number,
    endLineNumber: selection.endLineNumber as number,
    endColumn: selection.endColumn as number
  };
}

function sameSelection(left: CodeSelection | null, right: CodeSelection | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.startLineNumber === right.startLineNumber &&
    left.startColumn === right.startColumn &&
    left.endLineNumber === right.endLineNumber &&
    left.endColumn === right.endColumn
  );
}
