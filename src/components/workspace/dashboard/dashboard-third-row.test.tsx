import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardExplore } from "@/lib/dashboard/dashboard-overview";
import { DashboardThirdRow } from "./dashboard-third-row";

const data: DashboardExplore = {
  progress: {
    state: "active",
    title: "7 questions completed",
    detail: "Your path is moving. Keep the next session focused and repeatable.",
    completedQuestions: 7,
    totalQuestions: 198,
    progressPercent: 4,
    streakDays: 2,
    recentActivity: [0, 1, 0, 3, 2, 0, 1],
    actionHref: "/progress"
  },
  reports: {
    state: "available",
    title: "68% latest signal",
    detail: "Your clearest next focus is answer specificity.",
    latestScore: 68,
    completedRounds: 2,
    actionHref: "/reports"
  },
  trailmate: {
    state: "established",
    title: "3 peers supported",
    detail: "Keep building the circle that helps everyone get unstuck faster.",
    peopleHelped: 3,
    helpReceived: 2,
    actionLabel: "Open Trailmate",
    actionHref: "/trailmate"
  }
};

describe("DashboardThirdRow", () => {
  afterEach(cleanup);

  it("renders live progress, report, and Trailmate summaries", () => {
    render(<DashboardThirdRow data={data} />);

    expect(screen.getByRole("article", { name: "Progress summary" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Activity over the last seven days" })).toBeTruthy();
    expect(screen.getByText("7 questions completed")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View progress" }).getAttribute("href")).toBe(
      "/progress"
    );

    expect(screen.getByRole("article", { name: "Reports summary" })).toBeTruthy();
    expect(screen.getByText("68% latest signal")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View reports" }).getAttribute("href")).toBe(
      "/reports"
    );

    const trailmateCard = screen.getByRole("article", { name: "Trailmate summary" });
    expect(trailmateCard).toBeTruthy();
    expect(screen.getByText("3 peers supported")).toBeTruthy();
    expect(within(trailmateCard).getByText("Helped")).toBeTruthy();
    expect(within(trailmateCard).getByText("3")).toBeTruthy();
    expect(within(trailmateCard).getByText("Supported by")).toBeTruthy();
    expect(within(trailmateCard).getByText("2")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Trailmate" }).getAttribute("href")).toBe(
      "/trailmate"
    );
  });

  it("keeps first-use states useful without fake scores or activity", () => {
    render(
      <DashboardThirdRow
        data={{
          progress: {
            ...data.progress,
            state: "empty",
            title: "Start building your progress signal.",
            detail: "Your activity will appear here after your first attempt.",
            completedQuestions: 0,
            progressPercent: 0,
            streakDays: 0,
            recentActivity: [0, 0, 0, 0, 0, 0, 0]
          },
          reports: {
            ...data.reports,
            state: "empty",
            title: "Your first report starts with one round.",
            latestScore: null,
            completedRounds: 0
          },
          trailmate: {
            ...data.trailmate,
            state: "new",
            title: "Solve with someone beside you.",
            peopleHelped: 0,
            helpReceived: 0
          }
        }}
      />
    );

    expect(screen.getByText("Ready to begin")).toBeTruthy();
    expect(screen.getByText("Your first report starts with one round.")).toBeTruthy();
    expect(screen.getByText("Solve with someone beside you.")).toBeTruthy();
    expect(screen.queryByText("0% latest signal")).toBeNull();
  });
});
