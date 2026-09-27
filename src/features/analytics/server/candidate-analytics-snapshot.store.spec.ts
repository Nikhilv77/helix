import type { PrismaService } from "@/server/database/prisma.service";
import type { CandidateAnalyticsSummary } from "./candidate-analytics-loader";

const afterWork = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", () => ({ after: (work: () => unknown) => afterWork.push(work) }));

import { CANDIDATE_ANALYTICS_SCHEMA_VERSION, CandidateAnalyticsSnapshotStore } from "./candidate-analytics-snapshot.store";

const previous = { progressPage: { firstName: "Old" } } as unknown as CandidateAnalyticsSummary;
const rebuilt = { progressPage: { firstName: "New" } } as unknown as CandidateAnalyticsSummary;

/** A saved summary that is out of date: its sources changed since it was built. */
function stalePrisma() {
  const row = {
    payload: previous,
    schemaVersion: CANDIDATE_ANALYTICS_SCHEMA_VERSION,
    dirtyVersion: 2,
    builtVersion: 1,
    builtDay: new Date().toISOString().slice(0, 10)
  };
  return {
    candidateAnalyticsSnapshot: {
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn().mockResolvedValue({ dirtyVersion: 2 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    $transaction: vi.fn().mockResolvedValue(undefined)
  } as unknown as PrismaService;
}

describe("CandidateAnalyticsSnapshotStore.readSummary with waitForFreshMs", () => {
  afterEach(() => {
    afterWork.length = 0;
    vi.useRealTimers();
  });

  it("serves the rebuilt summary when it finishes within the budget", async () => {
    const store = new CandidateAnalyticsSnapshotStore(stalePrisma());
    const build = vi.fn().mockResolvedValue({ summary: rebuilt, reports: null, cacheable: true });

    await expect(store.readSummary("owner-1", build, { waitForFreshMs: 2_000 })).resolves.toEqual(
      rebuilt
    );
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("falls back to the saved summary when the rebuild is slow, and lets it finish", async () => {
    vi.useFakeTimers();
    const store = new CandidateAnalyticsSnapshotStore(stalePrisma());
    let finish: (value: unknown) => void = () => undefined;
    const build = vi.fn(() => new Promise((resolve) => (finish = resolve)));

    const read = store.readSummary("owner-1", build as never, { waitForFreshMs: 2_000 });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(read).resolves.toEqual(previous);
    // The rebuild is kept alive after the response and still publishes.
    expect(afterWork.length).toBeGreaterThan(0);
    finish({ summary: rebuilt, reports: null, cacheable: true });
    await Promise.all(afterWork.map((work) => work()));
  });

  it("never swaps in a rebuild that failed to read one of its sources", async () => {
    const store = new CandidateAnalyticsSnapshotStore(stalePrisma());
    const build = vi.fn().mockResolvedValue({ summary: rebuilt, reports: null, cacheable: false });

    await expect(store.readSummary("owner-1", build, { waitForFreshMs: 2_000 })).resolves.toEqual(
      previous
    );
  });
});
