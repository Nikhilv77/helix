import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "sophia", name: "Sophia" })
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: vi.fn().mockResolvedValue("unavailable"),
    stop: vi.fn(),
    awaitingGesture: false,
    setAwaitingGesture: vi.fn()
  })
}));
vi.mock("@/features/reports/ui/report-maya-avatar", () => ({
  ReportMayaAvatar: () => <div data-testid="teacher-avatar" />
}));

import { SessionLoadingScreen, SessionStateScreen } from "./session-state";

describe("SessionLoadingScreen", () => {
  afterEach(cleanup);

  it("keeps the preparing state minimal", () => {
    render(<SessionLoadingScreen error={null} onRetry={vi.fn()} workspaceAccent="ember" />);

    expect(screen.getByRole("heading", { name: "Preparing your interview" })).toBeVisible();
    expect(screen.getByText("Sophia will join shortly.")).toBeVisible();
    expect(screen.queryByText("Trailgrad")).toBeNull();
    expect(screen.queryByText("Interview studio")).toBeNull();
    expect(screen.queryByText("Secure interview room")).toBeNull();
    expect(screen.queryByText(/checking your session/i)).toBeNull();
  });
});

describe("SessionStateScreen block assessment completion", () => {
  afterEach(cleanup);

  it("returns the teacher first, then links to the overall report and block details", () => {
    const blockId = "11111111-1111-4111-8111-111111111111";
    render(
      <SessionStateScreen
        kind="complete"
        workspaceAccent="ember"
        blockAssessmentBlockId={blockId}
      />
    );

    expect(screen.getByRole("heading", { name: /james has reported back to me/i })).toBeVisible();
    expect(screen.getByTestId("teacher-avatar")).toBeVisible();
    expect(screen.getByRole("link", { name: /review my report with sophia/i })).toHaveAttribute(
      "href",
      "/reports"
    );
    expect(screen.getByRole("link", { name: /view block details/i })).toHaveAttribute(
      "href",
      `/practice/dsa?block=${blockId}`
    );
    expect(screen.queryByText(/time practised/i)).toBeNull();
    expect(screen.queryByText(/responses captured/i)).toBeNull();
  });

  it("returns a completed Core Technical voice assessment to its block report", () => {
    const blockId = "22222222-2222-4222-8222-222222222222";
    render(
      <SessionStateScreen kind="complete" workspaceAccent="ember" coreTechnicalBlockId={blockId} />
    );

    expect(screen.getByRole("link", { name: /view block details/i })).toHaveAttribute(
      "href",
      `/practice/core-technical?block=${blockId}`
    );
  });

  it("returns a completed Applied Engineering voice assessment to its incident report", () => {
    const blockId = "33333333-3333-4333-8333-333333333333";
    render(
      <SessionStateScreen
        kind="complete"
        workspaceAccent="ember"
        storyPracticeAssessment={{
          blockId,
          routeBase: "/practice/applied-engineering",
          label: "Applied Engineering"
        }}
      />
    );

    expect(screen.getByRole("link", { name: /view block details/i })).toHaveAttribute(
      "href",
      `/practice/applied-engineering?block=${blockId}`
    );
  });

  it("introduces the parameters the teacher will explain", () => {
    render(
      <SessionStateScreen
        kind="complete"
        workspaceAccent="ember"
        evaluationLabel="HR & Behavioural"
        evaluationParameters={["Motivation & fit", "Judgement", "Collaboration"]}
      />
    );

    expect(screen.getByText("Motivation & fit")).toBeVisible();
    expect(screen.getByText("Judgement")).toBeVisible();
    expect(screen.getByText("Collaboration")).toBeVisible();
    expect(screen.getByText(/you completed the interview/i)).toBeVisible();
  });
});
