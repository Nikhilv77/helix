import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProgressBriefingOverview } from "@/lib/roadmap/progress";

const voiceMocks = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue("started")
}));

vi.mock("@/components/workspace/reports/report-maya-avatar", () => ({
  ReportMayaAvatar: () => <div data-testid="progress-avatar" />
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: voiceMocks.speak,
    awaitingGesture: false,
    setAwaitingGesture: vi.fn()
  })
}));

import { ProgressView } from "./progress-view";

const overview: ProgressBriefingOverview = {
  totals: { totalAttempts: 1, completedQuestions: 1 },
  streak: {
    currentDays: 1,
    longestDays: 1,
    activeDays: 1,
    lastActiveAt: Date.parse("2026-09-02T08:00:00.000Z"),
    lastSolvedAt: Date.parse("2026-09-02T08:00:00.000Z")
  },
  activity: [
    { date: "2026-08-31", solved: 0, attempts: 0 },
    { date: "2026-09-01", solved: 0, attempts: 0 },
    { date: "2026-09-02", solved: 1, attempts: 1 }
  ],
  interview: {
    completedSessions: 3
  }
};

describe("ProgressView", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("speaks a compact progress summary while keeping the full coaching visible", async () => {
    vi.useFakeTimers();
    render(<ProgressView overview={overview} firstName="Arjun" starterQuestions={[]} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const spoken = voiceMocks.speak.mock.calls[0]?.[0] as string;
    expect(spoken).toContain("You completed 1 focused block");
    expect(spoken).toContain("Keep the next session to 1 focused completion");
    expect(spoken.length).toBeLessThan(240);
  });

  it("keeps opened attempts in the simple empty state until the first solve", () => {
    render(
      <ProgressView
        overview={{
          ...overview,
          totals: { totalAttempts: 1, completedQuestions: 0 }
        }}
        firstName="Aditya"
        starterQuestions={[
          {
            title: "Contains Duplicate",
            difficulty: "easy",
            minutes: 15,
            href: "/dsa-questions/contains-duplicate",
            chapterTitle: "Arrays & Hashing"
          }
        ]}
      />
    );

    expect(screen.getByText(/you haven't solved a practice question yet/i)).toBeTruthy();
    expect(screen.getByText("Start here.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Contains Duplicate" })).toBeTruthy();
    expect(screen.queryByText("Pace.")).toBeNull();
    expect(screen.queryByText("Continuity.")).toBeNull();
  });
});
