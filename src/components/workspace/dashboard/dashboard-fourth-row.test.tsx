import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardDirection } from "@/lib/dashboard/dashboard-overview";
import { DashboardFourthRow } from "./dashboard-fourth-row";

const data: DashboardDirection = {
  rhythm: {
    state: "active",
    title: "3 questions solved",
    detail: "The signal is moving. Add one short session to make the rhythm easier to repeat.",
    solved: 3,
    attempts: 5,
    activeDays: 2,
    days: [
      { date: "2026-08-22", label: "Sat", solved: 0, attempts: 0, level: 0 },
      { date: "2026-08-23", label: "Sun", solved: 1, attempts: 2, level: 4 },
      { date: "2026-08-24", label: "Mon", solved: 0, attempts: 0, level: 0 },
      { date: "2026-08-25", label: "Tue", solved: 0, attempts: 0, level: 0 },
      { date: "2026-08-26", label: "Wed", solved: 2, attempts: 3, level: 4 },
      { date: "2026-08-27", label: "Thu", solved: 0, attempts: 0, level: 0 },
      { date: "2026-08-28", label: "Fri", solved: 0, attempts: 0, level: 0 }
    ],
    actionHref: "/progress"
  },
  focus: {
    state: "interview",
    sourceLabel: "From your interviews",
    title: "Measurement specificity",
    detail: "Name the metric, threshold, and production decision it changes.",
    itemLabel: null,
    supportingLabel: "Seen across 2 scored rounds",
    actionLabel: "Practice this focus",
    actionHref: "/practice?focus=measurement"
  }
};

describe("DashboardFourthRow", () => {
  afterEach(cleanup);

  it("renders a directly labelled weekly rhythm and evidence-backed next focus", () => {
    render(<DashboardFourthRow data={data} />);

    const rhythm = screen.getByRole("article", { name: "Weekly practice rhythm" });
    expect(within(rhythm).getByText("3 questions solved")).toBeTruthy();
    expect(
      within(rhythm).getByRole("img", {
        name: "Seven-day practice activity: 3 solved across 2 active days"
      })
    ).toBeTruthy();
    expect(within(rhythm).getByText("Sun")).toBeTruthy();
    expect(
      within(rhythm).getByRole("link", { name: "View full progress" }).getAttribute("href")
    ).toBe("/progress");

    const focus = screen.getByRole("article", { name: "Recommended next focus" });
    expect(within(focus).getByText("Measurement specificity")).toBeTruthy();
    expect(within(focus).getByText("Seen across 2 scored rounds")).toBeTruthy();
    expect(
      within(focus).getByRole("link", { name: "Practice this focus" }).getAttribute("href")
    ).toBe("/practice?focus=measurement");
  });

  it("keeps first-use states honest and actionable", () => {
    render(
      <DashboardFourthRow
        data={{
          rhythm: {
            ...data.rhythm,
            state: "empty",
            title: "Your weekly rhythm starts with one focused session.",
            solved: 0,
            attempts: 0,
            activeDays: 0,
            days: data.rhythm.days.map((day) => ({
              ...day,
              solved: 0,
              attempts: 0,
              level: 0
            }))
          },
          focus: {
            state: "profile",
            sourceLabel: "From your profile",
            title: "System design",
            detail: "Start here as an initial priority.",
            itemLabel: null,
            supportingLabel: "Profile-based, not measured yet",
            actionLabel: "Start a focused block",
            actionHref: "/practice"
          }
        }}
      />
    );

    expect(screen.getByText("Your weekly rhythm starts with one focused session.")).toBeTruthy();
    expect(screen.getByText("Profile-based, not measured yet")).toBeTruthy();
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it("gives the next practice question its own hierarchy", () => {
    render(
      <DashboardFourthRow
        data={{
          ...data,
          focus: {
            state: "practice",
            sourceLabel: "From your practice path",
            title: "Arrays & Hashing",
            detail: "Take one focused attempt to a clear stopping point before moving forward.",
            itemLabel: "Valid Anagram",
            supportingLabel: "Easy · 10 min",
            actionLabel: "Open next question",
            actionHref: "/dsa-questions/valid-anagram"
          }
        }}
      />
    );

    const focus = screen.getByRole("article", { name: "Recommended next focus" });
    expect(within(focus).getByText("Next question")).toBeTruthy();
    expect(within(focus).getByText("Valid Anagram")).toBeTruthy();
    expect(within(focus).getByText("Easy · 10 min")).toBeTruthy();
  });
});
