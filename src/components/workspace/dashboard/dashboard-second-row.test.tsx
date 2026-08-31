import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardContinuation } from "@/lib/dashboard/dashboard-overview";
import { DashboardSecondRow } from "./dashboard-second-row";

const data: DashboardContinuation = {
  practice: {
    state: "continue",
    statusLabel: "7/20 complete",
    title: "Valid Anagram",
    detail: "Arrays & Hashing · Easy · 15 min",
    actionLabel: "Continue question",
    actionHref: "/dsa-questions/valid-anagram",
    teacherAdvice: "State the invariant, test one edge case, and then code it cleanly.",
    completedQuestions: 7,
    totalQuestions: 20,
    progressPercent: 35,
    solvedThisWeek: 2
  },
  interviews: {
    state: "next",
    statusLabel: "2 completed rounds",
    title: "Take your next interview.",
    detail: "Your latest technical round points to answer specificity.",
    actionLabel: "Choose next interview",
    actionHref: "/interviews",
    completedRounds: 2,
    latestScore: 68
  }
};

describe("DashboardSecondRow", () => {
  afterEach(cleanup);

  it("renders live practice and interview continuation actions", () => {
    render(<DashboardSecondRow data={data} />);

    expect(screen.getByRole("article", { name: "Practice continuation" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Valid Anagram" })).toBeTruthy();
    expect(screen.getByText("Arrays & Hashing · Easy · 15 min")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Teacher note" })).toBeTruthy();
    expect(screen.getByText(/State the invariant/)).toBeTruthy();
    expect(screen.getByText("7 of 20 questions complete")).toBeTruthy();
    expect(screen.getByText("35%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue question" }).getAttribute("href")).toBe(
      "/dsa-questions/valid-anagram"
    );

    expect(screen.getByRole("article", { name: "Interview continuation" })).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.getByText("Latest score")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choose next interview" }).getAttribute("href")).toBe(
      "/interviews"
    );
  });

  it("keeps true empty states direct and free of fabricated metrics", () => {
    render(
      <DashboardSecondRow
        data={{
          practice: {
            ...data.practice,
            state: "start",
            statusLabel: "Ready to start",
            title: "Start your first practice block.",
            actionLabel: "Start practice",
            actionHref: "/practice",
            teacherAdvice: "Read the constraints twice before you begin.",
            completedQuestions: 0,
            totalQuestions: 0,
            progressPercent: 0,
            solvedThisWeek: 0
          },
          interviews: {
            state: "start",
            statusLabel: "No rounds yet",
            title: "Take your first interview.",
            detail: "Answer one question to establish a readiness signal.",
            actionLabel: "Start first interview",
            actionHref: "/interviews",
            completedRounds: 0,
            latestScore: null
          }
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Start your first practice block." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Take your first interview." })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Interview steps" })).toBeTruthy();
    expect(screen.getByText("Choose your focus")).toBeTruthy();
    expect(screen.getByText("Answer naturally")).toBeTruthy();
    expect(screen.getByText("Review the evidence")).toBeTruthy();
    expect(screen.queryByText(/Latest 0%/)).toBeNull();
    expect(screen.queryByText(/0 of 0 questions/)).toBeNull();
  });
});
