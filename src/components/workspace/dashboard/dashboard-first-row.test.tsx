import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";

const voiceMocks = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue("started"),
  stop: vi.fn()
}));

vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: ({
    speaking,
    performanceProfile
  }: {
    speaking: boolean;
    performanceProfile: string;
  }) => (
    <div
      data-testid="teacher-avatar"
      data-speaking={String(speaking)}
      data-performance-profile={performanceProfile}
    />
  )
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: voiceMocks.speak,
    stop: voiceMocks.stop,
    awaitingGesture: false
  })
}));

import { DashboardFirstRow } from "./dashboard-first-row";

const data: Pick<DashboardOverviewData, "coaching" | "readiness"> = {
  coaching: {
    state: "interview-with-practice",
    eyebrow: "Latest coaching signal",
    title: "Measurement specificity is the clearest place to improve.",
    body: "Name the metric and threshold. Nice going—maintain the pace.",
    spokenSummary: "Maintain your pace and focus on measurement specificity.",
    actionLabel: "Focus practice",
    actionHref: "/practice?focus=measurement"
  },
  readiness: {
    status: "scored",
    score: 72,
    delta: 8,
    scoredRounds: 3,
    label: "Developing",
    detail: "Based on your 3 most recent scored rounds."
  }
};

describe("DashboardFirstRow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("merges the teacher and coaching into one feature beside readiness", () => {
    render(<DashboardFirstRow data={data} />);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Teacher coaching" })).toBeTruthy();
    expect(screen.queryByText("Your teacher")).toBeNull();
    expect(screen.queryByText("Maya")).toBeNull();
    expect(screen.queryByText("Warm, direct, keeps it moving")).toBeNull();
    expect(screen.queryByText("Latest coaching signal")).toBeNull();
    expect(screen.getByTestId("teacher-avatar").getAttribute("data-performance-profile")).toBe(
      "dashboard"
    );
    expect(
      screen.getByRole("heading", { name: /Measurement specificity is the clearest/ })
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: "Readiness score 72 out of 100" })).toBeTruthy();
    expect(screen.getByText("+8 pts")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Focus practice/ }).getAttribute("href")).toBe(
      "/practice?focus=measurement"
    );
  });

  it("renders a forming state without displaying a fabricated zero", () => {
    render(
      <DashboardFirstRow
        data={{
          ...data,
          readiness: {
            status: "forming",
            score: null,
            delta: null,
            scoredRounds: 0,
            label: "Still forming",
            detail: "Answer an interview question to establish a signal."
          }
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Take your first interview" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Start interview" }).getAttribute("href")).toBe(
      "/interview"
    );
  });

  it("waits for the candidate to request the teacher voice", () => {
    render(<DashboardFirstRow data={data} />);

    expect(voiceMocks.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play teacher summary" }));
    expect(voiceMocks.speak).toHaveBeenCalledWith(data.coaching.spokenSummary);
  });
});
