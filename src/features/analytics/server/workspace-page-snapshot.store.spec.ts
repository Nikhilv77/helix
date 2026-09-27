import type { PrismaService } from "@/server/database/prisma.service";

const afterWork = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", () => ({ after: (work: () => unknown) => afterWork.push(work) }));

import { WORKSPACE_PAGE_SCHEMA_VERSION, WorkspacePageSnapshotStore } from "./workspace-page-snapshot.store";

/** A saved Reports payload whose sources changed after it was built. */
function stalePrisma() {
  const row = {
    ownerId: "owner-1",
    page: "reports",
    payload: { rounds: "old" },
    schemaVersion: WORKSPACE_PAGE_SCHEMA_VERSION.reports,
    dirtyVersion: 2,
    builtVersion: 1,
    expiresAt: null
  };
  return {
    workspacePageSnapshot: {
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row)
    }
  } as unknown as PrismaService;
}

describe("WorkspacePageSnapshotStore.readOrBuild with waitForFreshMs", () => {
  afterEach(() => {
    afterWork.length = 0;
    vi.useRealTimers();
  });

  it("serves the rebuilt payload when it finishes within the budget", async () => {
    const store = new WorkspacePageSnapshotStore(stalePrisma());
    const build = vi.fn().mockResolvedValue({ data: { rounds: "new" }, cacheable: true });

    await expect(
      store.readOrBuild("owner-1", "reports", build, { waitForFreshMs: 2_000 })
    ).resolves.toEqual({ rounds: "new" });
  });

  it("serves the saved payload when the rebuild is slow or fails", async () => {
    vi.useFakeTimers();
    const slow = new WorkspacePageSnapshotStore(stalePrisma());
    const read = slow.readOrBuild(
      "owner-1",
      "reports",
      () => new Promise<never>(() => undefined),
      { waitForFreshMs: 2_000 }
    );
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(read).resolves.toEqual({ rounds: "old" });
    expect(afterWork.length).toBeGreaterThan(0);
    vi.useRealTimers();

    const failing = new WorkspacePageSnapshotStore(stalePrisma());
    await expect(
      failing.readOrBuild("owner-1", "reports", () => Promise.reject(new Error("db down")), {
        waitForFreshMs: 2_000
      })
    ).resolves.toEqual({ rounds: "old" });
  });

  it("still serves stale payloads without waiting when no budget is given", async () => {
    const store = new WorkspacePageSnapshotStore(stalePrisma());
    const build = vi.fn().mockResolvedValue({ data: { rounds: "new" }, cacheable: true });

    await expect(store.readOrBuild("owner-1", "reports", build)).resolves.toEqual({ rounds: "old" });
    expect(build).not.toHaveBeenCalled();
    expect(afterWork).toHaveLength(1);
  });
});
