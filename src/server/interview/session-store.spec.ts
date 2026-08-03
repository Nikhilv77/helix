import { MemorySessionStore } from "./session-store";
import type { InterviewState } from "./types";

const HOUR_MS = 60 * 60 * 1000;

function state(id: string, startedAt: number): InterviewState {
  return {
    id,
    setup: {
      role: "backend",
      level: "3-5",
      roundType: "behavioral",
      intensity: "realistic",
      context: "Built a retry pipeline."
    },
    plan: [],
    phase: "questioning",
    questionIndex: 0,
    followUpCount: 0,
    startedAt,
    turns: []
  };
}

describe("MemorySessionStore", () => {
  afterEach(() => jest.useRealTimers());

  it("persists state updates and daily starts", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("11111111-1111-4111-8111-111111111111", Date.now());

    await store.create(created, "user-1");
    await store.save({ ...created, phase: "done" });

    await expect(store.get(created.id)).resolves.toMatchObject({ phase: "done" });
    await expect(store.countStartedSince("user-1", Date.now() - HOUR_MS)).resolves.toBe(1);
  });

  it("expires inactive session state", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("22222222-2222-4222-8222-222222222222", Date.now());
    await store.create(created, "user-1");

    jest.setSystemTime(Date.now() + HOUR_MS + 1);

    await expect(store.get(created.id)).resolves.toBeNull();
  });

  it("keeps expired sessions available to their owner for reports", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("33333333-3333-4333-8333-333333333333", Date.now());
    await store.create(created, "user-1");

    jest.setSystemTime(Date.now() + HOUR_MS + 1);

    await expect(store.get(created.id)).resolves.toBeNull();
    await expect(store.getOwned(created.id, "user-1")).resolves.toMatchObject({
      state: { id: created.id }
    });
    await expect(store.getOwned(created.id, "user-2")).resolves.toBeNull();
    await expect(store.listByOwner("user-1", 10)).resolves.toHaveLength(1);
  });
});
