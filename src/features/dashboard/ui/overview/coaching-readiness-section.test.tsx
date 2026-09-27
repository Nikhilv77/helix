import { TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";

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

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: voiceMocks.speak,
    stop: voiceMocks.stop,
    awaitingGesture: false
  })
}));

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "daniel", name: "Daniel", portrait: "/daniel.jpg" })
}));

import { CoachingReadinessSection } from "./coaching-readiness-section";

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
    detail: "Based on your 3 most recent scored rounds.",
    actionLabel: "Open reports",
    actionHref: "/reports"
  }
};

describe("CoachingReadinessSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("merges the teacher and coaching into one feature beside readiness", () => {
    render(<CoachingReadinessSection data={data} />);

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
      <CoachingReadinessSection
        data={{
          ...data,
          readiness: {
            status: "forming",
            score: null,
            delta: null,
            scoredRounds: 0,
            label: "Still forming",
            detail: "Answer an interview question to establish a signal.",
            actionLabel: "Start interview",
            actionHref: "/interviews"
          }
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Still forming" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Start interview" }).getAttribute("href")).toBe(
      "/interviews"
    );
  });

  it("waits for the candidate to request the teacher voice", () => {
    render(<CoachingReadinessSection data={data} />);

    expect(voiceMocks.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play teacher summary" }));
    // The spoken line is a pre-recorded phrasing for the coaching state.
    expect(TEACHER_LINES.coaching["interview-with-practice"]).toContain(
      voiceMocks.speak.mock.calls[0]?.[0]
    );
  });

  // The tour's "heard this visit" marker is module state, so each tour test
  // loads a fresh copy of the section.
  async function freshSection() {
    vi.resetModules();
    return (await import("./coaching-readiness-section")).CoachingReadinessSection;
  }

  it("plays the tour on arrival and only then records it as heard", async () => {
    voiceMocks.speak.mockReset();
    voiceMocks.speak.mockResolvedValue("started");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const Section = await freshSection();

    render(<Section data={data} introduce />);

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(voiceMocks.speak.mock.calls[0]).toEqual([TEACHER_LINES.overviewTour[0], "daniel"]);
    expect(fetchSpy.mock.calls[0]![0]).toBe("/api/profile");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body))).toEqual({
      overviewIntroduced: true
    });
    fetchSpy.mockRestore();
  });

  it("does not use up the tour when autoplay is blocked; the speaker button plays it", async () => {
    voiceMocks.speak.mockReset();
    voiceMocks.speak.mockResolvedValueOnce("blocked").mockResolvedValue("started");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const Section = await freshSection();

    render(<Section data={data} introduce />);
    await vi.waitFor(() => expect(voiceMocks.speak).toHaveBeenCalledTimes(1));
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play teacher summary" }));

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(voiceMocks.speak.mock.calls[1]![0]).toBe(TEACHER_LINES.overviewTour[0]);
    fetchSpy.mockRestore();
  });

  it("does not replay within the same visit after it has played", async () => {
    voiceMocks.speak.mockReset();
    voiceMocks.speak.mockResolvedValue("started");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const Section = await freshSection();

    const first = render(<Section data={data} introduce />);
    await vi.waitFor(() => expect(voiceMocks.speak).toHaveBeenCalledTimes(1));
    first.unmount();
    // Back-navigation shows the cached Overview, still rendered with `introduce`.
    render(<Section data={data} introduce />);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voiceMocks.speak).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("does not play a tour for someone who has already heard it", () => {
    voiceMocks.speak.mockClear();
    render(<CoachingReadinessSection data={data} />);
    expect(voiceMocks.speak).not.toHaveBeenCalled();
  });
});
