import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";

vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: ({ speaking }: { speaking: boolean }) => (
    <div data-testid="teacher-avatar" data-speaking={String(speaking)} />
  )
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: vi.fn().mockResolvedValue("started"),
    stop: vi.fn(),
    awaitingGesture: false
  })
}));

import { DashboardFirstRow } from "./dashboard-first-row";

const data: DashboardOverviewData = {
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
  afterEach(cleanup);

  it("renders exactly the teacher, coaching, and readiness cards", () => {
    render(<DashboardFirstRow data={data} />);

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("article", { name: "Teacher" })).toBeTruthy();
    expect(screen.queryByText("Your teacher")).toBeNull();
    expect(screen.queryByText("Maya")).toBeNull();
    expect(screen.queryByText("Warm, direct, keeps it moving")).toBeNull();
    expect(screen.queryByText("Latest coaching signal")).toBeNull();
    expect(screen.queryByText("Short voice summary")).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Measurement specificity is the clearest/ })
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: "Readiness score 72 out of 100" })).toBeTruthy();
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

    expect(screen.getByRole("heading", { name: "Still forming" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("link", { name: /Take an interview/ })).toBeNull();
  });
});
