import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "admin-1" as string | null,
  canView: true,
  dashboard: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  })
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: mocks.userId }))
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

vi.mock("@/features/interviews/server/interview-operations-access", () => ({
  canViewInterviewOperations: vi.fn(() => mocks.canView)
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { interviewOperationsAdminUserId: "admin-1" },
    interviewOperationsService: { dashboard: mocks.dashboard }
  })
}));

import InterviewOperationsPage from "./page";

describe("InterviewOperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "admin-1";
    mocks.canView = true;
    mocks.dashboard.mockResolvedValue(dashboardFixture());
  });

  it("renders the full private operations console and selected time window", async () => {
    const page = await InterviewOperationsPage({
      searchParams: Promise.resolve({ hours: "72" })
    });
    const html = renderToStaticMarkup(page);

    expect(mocks.dashboard).toHaveBeenCalledWith(72);
    expect(html).toContain("Operations console");
    expect(html).toContain("Session health");
    expect(html).toContain("Decision engine");
    expect(html).toContain("Evaluation &amp; recovery");
    expect(html).toContain("Data controls");
    expect(html).toContain("Admin only");
    expect(html).not.toContain("owner-1");
    expect(html).not.toContain("candidate answer");
  });

  it("falls back to the 24-hour window for unsupported input", async () => {
    await InterviewOperationsPage({
      searchParams: Promise.resolve({ hours: "999" })
    });

    expect(mocks.dashboard).toHaveBeenCalledWith(24);
  });

  it("hides the route before reading dashboard data when access is denied", async () => {
    mocks.canView = false;

    await expect(InterviewOperationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NOT_FOUND"
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
});

function dashboardFixture() {
  return {
    generatedAt: "2026-09-14T08:00:00.000Z",
    window: {
      since: "2026-09-11T08:00:00.000Z",
      hours: 72,
      sampleLimit: 5_000,
      sampleTruncated: false
    },
    retention: {
      authenticatedDays: 365,
      anonymousDays: 30,
      operationalDays: 30,
      batchSize: 250
    },
    sessions: {
      total: 12,
      byPhase: { done: 9, interview: 3 },
      byRound: { behavioral: 7, technical: 5 },
      completedRate: 0.75
    },
    decisions: {
      observed: 42,
      fallbackCount: 2,
      fallbackRate: 0.0476,
      forcedCount: 1,
      latencyMs: { p50: 640, p95: 1_480, max: 2_100 }
    },
    evaluations: {
      observed: 31,
      recoveredCount: 2,
      unavailableCount: 0,
      latencyMs: { p50: 820, p95: 1_900, max: 2_600 },
      queue: {
        byStatus: { PENDING: 2, PROCESSING: 1 },
        averageAttemptsByStatus: { PENDING: 1, PROCESSING: 1.5 },
        oldestOutstandingCreatedAt: Date.parse("2026-09-14T07:56:00.000Z"),
        oldestOutstandingAgeMinutes: 4
      }
    },
    alerts: []
  };
}
