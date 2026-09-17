import { MemorySessionStore, interviewReportNotificationCopy } from "./session-store";
import type { InterviewReportSnapshot } from "./report";
import type { InterviewState } from "./types";
import { EMPTY_SYSTEM_DESIGN_CANVAS } from "@/features/interviews/domain/system-design-canvas";

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
  afterEach(() => vi.useRealTimers());

  it("persists state updates and daily starts", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("11111111-1111-4111-8111-111111111111", Date.now());

    await store.create(created, "user-1");
    await store.save({ ...created, phase: "done" }, 0);

    await expect(store.get(created.id)).resolves.toMatchObject({ phase: "done" });
    await expect(store.countStartedSince("user-1", Date.now() - HOUR_MS)).resolves.toBe(1);
  });

  it("rejects a stale session version instead of overwriting newer state", async () => {
    const store = new MemorySessionStore();
    const created = state("55555555-5555-4555-8555-555555555555", Date.now());
    await store.create(created, "user-1");

    await expect(store.save({ ...created, phase: "done" }, 0)).resolves.toBe(1);
    await expect(store.save({ ...created, phase: "wrap" }, 0)).rejects.toMatchObject({
      name: "SessionVersionConflictError"
    });
    await expect(store.getVersioned(created.id)).resolves.toMatchObject({
      version: 1,
      state: { phase: "done" }
    });
  });

  it("expires inactive session state", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("22222222-2222-4222-8222-222222222222", Date.now());
    await store.create(created, "user-1");

    vi.setSystemTime(Date.now() + HOUR_MS + 1);

    await expect(store.get(created.id)).resolves.toBeNull();
  });

  it("keeps expired sessions available to their owner for reports", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("33333333-3333-4333-8333-333333333333", Date.now());
    await store.create(created, "user-1");

    vi.setSystemTime(Date.now() + HOUR_MS + 1);

    await expect(store.get(created.id)).resolves.toBeNull();
    await expect(store.getOwned(created.id, "user-1")).resolves.toMatchObject({
      state: { id: created.id }
    });
    await expect(store.getOwned(created.id, "user-2")).resolves.toBeNull();
    await expect(store.listByOwner("user-1", 10)).resolves.toHaveLength(1);
  });

  it("owner-scopes active session reads", async () => {
    const store = new MemorySessionStore();
    const created = state("44444444-4444-4444-8444-444444444444", Date.now());
    await store.create(created, "user-1");

    await expect(store.getActiveOwned(created.id, "user-1")).resolves.toMatchObject({
      id: created.id
    });
    await expect(store.getActiveOwned(created.id, "user-2")).resolves.toBeNull();
  });

  it("reactivates an owned durable session without changing its version", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:00Z"));
    const store = new MemorySessionStore();
    const created = state("66666666-6666-4666-8666-666666666666", Date.now());
    await store.create(created, "user-1");

    vi.setSystemTime(Date.now() + HOUR_MS + 1);
    await expect(store.getActiveOwned(created.id, "user-1")).resolves.toBeNull();

    await expect(store.reactivateOwned(created.id, "user-1")).resolves.toMatchObject({
      version: 0,
      state: { id: created.id }
    });
    await expect(store.getActiveOwned(created.id, "user-1")).resolves.toMatchObject({
      id: created.id
    });
    await expect(store.reactivateOwned(created.id, "user-2")).resolves.toBeNull();
  });

  it("versions canvas autosaves independently from live interview turns", async () => {
    const store = new MemorySessionStore();
    const created = state("88888888-8888-4888-8888-888888888888", Date.now());
    await store.create(created, "user-1");

    const first = await store.saveDesignCanvas(
      created.id,
      "user-1",
      {
        ...EMPTY_SYSTEM_DESIGN_CANVAS,
        notes: "10k uploads per second"
      },
      0
    );
    expect(first).toMatchObject({ revision: 1 });
    await expect(store.getVersioned(created.id)).resolves.toMatchObject({ version: 0 });

    await expect(
      store.saveDesignCanvas(created.id, "user-1", EMPTY_SYSTEM_DESIGN_CANVAS, 0)
    ).rejects.toMatchObject({
      name: "DesignCanvasVersionConflictError",
      current: { revision: 1 }
    });
    await expect(store.getDesignCanvas(created.id, "user-2")).resolves.toBeNull();
  });
});

describe("interview report notification copy", () => {
  it("names the interview family and highlights the evidence score", () => {
    const completed = {
      ...state("77777777-7777-4777-8777-777777777777", Date.now()),
      phase: "done" as const,
      setup: {
        ...state("unused", Date.now()).setup,
        roundType: "technical" as const,
        technicalDeepDive: {
          kind: "technical-deep-dive" as const,
          version: 2 as const,
          coreBlueprintId: "core-1",
          appliedBlueprintId: "applied-1"
        }
      }
    };
    const snapshot = {
      report: { answerCount: 4, summary: { evidenceScore: 78 } }
    } as InterviewReportSnapshot;

    expect(interviewReportNotificationCopy(completed, snapshot)).toEqual({
      title: "Core Technical & Projects report is ready",
      body: "Your evidence score is 78/100. See what landed, what needs work, and your next step."
    });
  });

  it("uses supportive summary copy when an interview ended without an answer", () => {
    const completed = {
      ...state("88888888-8888-4888-8888-888888888888", Date.now()),
      phase: "done" as const,
      setup: {
        ...state("unused", Date.now()).setup,
        roundType: "hiring-manager" as const
      }
    };
    const snapshot = {
      report: { answerCount: 0, summary: { evidenceScore: 0 } }
    } as InterviewReportSnapshot;

    expect(interviewReportNotificationCopy(completed, snapshot)).toEqual({
      title: "HR & Behavioural report is ready",
      body: "Your session summary is ready. Open it to review the interview and choose your next step."
    });
  });
});
