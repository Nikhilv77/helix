import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProgressBriefingOverview } from "@/features/progress/contracts/progress";

const voiceMocks = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue("started")
}));

vi.mock("@/features/reports/ui/report-maya-avatar", () => ({
  ReportMayaAvatar: () => <div data-testid="progress-avatar" />
}));

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
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

  it("speaks a pre-recorded line for the current rhythm while the numbers stay on screen", async () => {
    vi.useFakeTimers();
    render(<ProgressView overview={overview} firstName="Arjun" starterQuestions={[]} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const spoken = voiceMocks.speak.mock.calls[0]?.[0] as string;
    // A one-day streak is the "building" band; its exact numbers are written below.
    expect(TEACHER_LINES.progress.building).toContain(spoken);
    expect(screen.getByText(/You solved 1 question in the last 7 days/)).toBeInTheDocument();
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
    expect(screen.queryByText("Consistency.")).toBeNull();
  });

  it("never greets a nameless learner as \"there\"", () => {
    render(
      <ProgressView
        overview={{ ...overview, totals: { totalAttempts: 0, completedQuestions: 0 } }}
        firstName=""
        starterQuestions={[]}
      />
    );
    expect(screen.getByText(/^You haven't solved a practice question yet/)).toBeTruthy();
    expect(screen.queryByText(/^there,/i)).toBeNull();
  });

  it("counts solved questions in plain words", () => {
    render(
      <ProgressView
        overview={{
          ...overview,
          totals: { totalAttempts: 9, completedQuestions: 6 },
          streak: { ...overview.streak, currentDays: 4, longestDays: 4 },
          activity: [
            { date: "2026-08-30", solved: 2, attempts: 2 },
            { date: "2026-08-31", solved: 1, attempts: 2 },
            { date: "2026-09-01", solved: 2, attempts: 3 },
            { date: "2026-09-02", solved: 1, attempts: 2 }
          ]
        }}
        firstName="Arjun"
        starterQuestions={[]}
      />
    );
    expect(screen.getByText(/Here's your last 7 days, Arjun/)).toBeTruthy();
    expect(
      screen.getByText(/You solved 6 questions in the last 7 days, over 4 active days, about 1.5 a day/)
    ).toBeTruthy();
    expect(screen.getByText(/you're on a 4-day streak/)).toBeTruthy();
    expect(screen.getByText(/Aim for 1 question next time/)).toBeTruthy();
    expect(screen.queryByText(/focused block/)).toBeNull();
  });
});
