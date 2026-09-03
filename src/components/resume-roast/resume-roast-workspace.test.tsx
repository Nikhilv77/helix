import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeRoastResult, ResumeRoastTarget } from "@/lib/resume-roast/contracts";
import type { CandidateResume } from "@/lib/shared/types";
import { encodeResumeRoastStreamEvent, resumeRoastResultEvents } from "@/lib/resume-roast/stream";
import { WORKSPACE_NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/notification-ui-events";
import { ResumeRoastWorkspace, resumeRoastProgressMessage } from "./resume-roast-workspace";

const voice = vi.hoisted(() => ({
  speak: vi.fn(
    async (
      _line: string,
      _persona?: string,
      callbacks?: { onEnded?: () => void; onError?: () => void; playbackRate?: number }
    ) => {
      callbacks?.onEnded?.();
      return "started" as const;
    }
  ),
  stop: vi.fn(),
  setAwaitingGesture: vi.fn()
}));

vi.mock("@/lib/voice/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    progress: 0,
    speak: voice.speak,
    stop: voice.stop,
    awaitingGesture: false,
    setAwaitingGesture: voice.setAwaitingGesture
  })
}));

vi.mock("@/components/workspace/reports/report-maya-avatar", () => ({
  ReportMayaAvatar: ({ personaId }: { personaId?: string }) => (
    <div data-testid="live-avatar">{personaId}</div>
  )
}));

const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};

const resume: CandidateResume = {
  fileName: "nikhil-resume.pdf",
  uploadedAt: 1,
  confidence: 94,
  fullName: "Nikhil Verma",
  skills: ["TypeScript", "PostgreSQL", "AWS"],
  warnings: [],
  experience: [
    {
      organization: "Trailgrad",
      role: "Backend Engineer",
      period: "2024 — now",
      location: "Remote",
      summary: "Built the interview platform.",
      achievements: ["Improved API performance.", "Migrated payment services."],
      skills: ["TypeScript"]
    }
  ],
  education: [],
  projects: [],
  achievements: [],
  practiceQuestions: [],
  roadmap: [],
  document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
  evidence: {
    dateRanges: 1,
    achievementLines: 2,
    quantifiedAchievements: 0,
    experienceEntries: 1,
    projectEntries: 0,
    educationEntries: 0
  },
  interviewKit: null
};

const result: ResumeRoastResult = {
  openingRoast: "Your impact metrics have entered witness protection.",
  spokenSummary:
    "You’ve done useful backend work, but the proof keeps disappearing right when things get interesting. The payments migration sounds solid, while the performance claim gives me absolutely nothing to measure. Add the real outcomes and this starts looking much more senior.",
  strength: {
    headline: "Ownership exists",
    explanation: "The payments migration proves you owned meaningful work.",
    evidenceAnchors: ["experience-1-achievement-2"]
  },
  problems: [
    {
      joke: "Improved performance is wearing a fake moustache.",
      issue: "The performance claim has no measurement.",
      recruiterImpact: "Nobody can judge the scale.",
      improvement: "Add the verified latency change.",
      evidenceAnchors: ["experience-1-achievement-1"]
    }
  ],
  rewrite: {
    before: "Improved API performance.",
    after: "Reduced checkout latency by [verified amount] through query batching.",
    rationale: "It names the system and mechanism.",
    evidenceAnchor: "experience-1-achievement-1"
  },
  verdict: {
    band: "has-potential",
    explanation: "Relevant experience, hidden impact. Make the proof impossible to miss.",
    targetFitScore: 62
  },
  actionPlan: [
    {
      priority: 1,
      action: "Measure the migration",
      rationale: "Verified impact makes the strongest work believable."
    }
  ]
};

const roastId = "d754aa0d-c1fb-42b8-85f6-b1063f54fc9c";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function streamResponse() {
  const body = resumeRoastResultEvents({ roastId, replayed: false, target, result })
    .map(encodeResumeRoastStreamEvent)
    .join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function errorStreamResponse(code: "timeout" | "invalid-response" | "generation-failed") {
  return new Response(encodeResumeRoastStreamEvent({ type: "error", code, retryable: true }), {
    headers: { "content-type": "text/event-stream" }
  });
}

function readyState(
  previousRoast: { id: string; target: ResumeRoastTarget; result: ResumeRoastResult } | null = null
) {
  return {
    data: {
      hasResume: true,
      target: previousRoast?.target ?? null,
      suggestedTarget: null,
      previousRoast
    }
  };
}

async function chooseTarget() {
  fireEvent.click(await screen.findByRole("button", { name: "Backend Engineer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Product company" }));
  fireEvent.click(await screen.findByRole("button", { name: "Senior" }));
}

describe("ResumeRoastWorkspace", () => {
  let originalScrollTo: PropertyDescriptor | undefined;
  let scrollToMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    scrollToMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToMock
    });
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    );
  });

  afterEach(() => {
    cleanup();
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends users without a stored resume to Profile", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        data: { hasResume: false, target: null, suggestedTarget: null, previousRoast: null }
      })
    );

    render(<ResumeRoastWorkspace resume={null} />);

    expect(await screen.findByText("James needs a resume first.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Profile" })).toHaveAttribute("href", "/profile");
  });

  it("asks three chat questions before streaming the roast", async () => {
    const notificationChanged = vi.fn();
    window.addEventListener(WORKSPACE_NOTIFICATIONS_CHANGED_EVENT, notificationChanged);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            hasResume: true,
            target: null,
            suggestedTarget: { role: target.role, level: target.level },
            previousRoast: null
          }
        })
      )
      .mockResolvedValueOnce(streamResponse());

    render(<ResumeRoastWorkspace resume={resume} />);

    expect(await screen.findByText("james")).toBeVisible();
    expect(await screen.findByText("Nikhil Verma", {}, { timeout: 2_000 })).toBeVisible();
    expect(
      await screen.findByText(
        "Okay, I’ve got your resume. Three quick questions, then we’ll get into it."
      )
    ).toBeVisible();
    expect(await screen.findByText("What role are you aiming for?")).toBeVisible();

    fireEvent.click(await screen.findByRole("button", { name: "Backend Engineer" }));
    expect(await screen.findByText("What kind of company are we trying to impress?")).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: "Product company" }));
    expect(await screen.findByText("What level are you applying for?")).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: "Senior" }));

    expect(await screen.findByText((text) => text.includes(result.openingRoast))).toBeVisible();
    expect(
      await screen.findByText((text) => text.includes(result.problems[0]!.joke))
    ).toBeVisible();
    expect(
      await screen.findByText((text) => text.includes(result.actionPlan[0]!.action))
    ).toBeVisible();
    expect(await screen.findByLabelText("Target fit score: 62 out of 100")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Weak points" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ways to fix it" })).toBeVisible();
    expect(screen.queryByText("James is speaking")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete roast" })).toBeNull();
    expect(notificationChanged).toHaveBeenCalledOnce();
    window.removeEventListener(WORKSPACE_NOTIFICATIONS_CHANGED_EVENT, notificationChanged);

    const [, request] = vi.mocked(fetch).mock.calls;
    expect(request?.[0]).toBe("/api/resume-roast");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ target });
  });

  it("summarizes the latest saved roast and offers a fresh analysis", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            hasResume: true,
            target,
            suggestedTarget: null,
            previousRoast: { id: roastId, target, result }
          }
        })
      )
      .mockResolvedValueOnce(streamResponse());

    render(<ResumeRoastWorkspace resume={resume} />);

    expect(await screen.findByText((text) => text.includes(result.openingRoast))).toBeVisible();
    expect(await screen.findByLabelText("Target fit score: 62 out of 100")).toBeVisible();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    const roastCall = voice.speak.mock.calls.find(([line]) => line.includes(result.spokenSummary!));
    expect(roastCall?.[0]).toContain(
      "Now check below—I’ve laid out every issue with your resume and exactly how to fix it."
    );
    expect(roastCall?.[2]).toMatchObject({ playbackRate: 0.92 });
    expect(voice.speak.mock.calls.every(([, persona]) => persona === "james")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Start a fresh analysis" }));
    expect(await screen.findByRole("button", { name: "Backend Engineer" })).toBeVisible();
    expect(screen.queryByText((text) => text.includes(result.openingRoast))).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Backend Engineer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Product company" }));
    fireEvent.click(await screen.findByRole("button", { name: "Senior" }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({ target });
  });

  it("shows the full resume with generated weak points in the scrolling card", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        data: {
          hasResume: true,
          target,
          suggestedTarget: null,
          previousRoast: { id: roastId, target, result }
        }
      })
    );

    render(<ResumeRoastWorkspace resume={resume} />);

    expect(await screen.findByText("Nikhil Verma", {}, { timeout: 2_000 })).toBeVisible();
    expect(
      await screen.findByText((text) => text.includes("Trailgrad"), {}, { timeout: 4_000 })
    ).toBeVisible();
    expect(
      await screen.findByText(result.problems[0]!.issue, {}, { timeout: 5_000 })
    ).toBeVisible();
    expect(screen.getByLabelText("Resume and weak points")).toBeVisible();
  });

  it("keeps the mobile resume compact and allows touch scrolling between both panes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(readyState()));

    const { container } = render(<ResumeRoastWorkspace resume={resume} />);

    const resumeViewport = await screen.findByLabelText("Resume and weak points");
    const mobileGrid = resumeViewport.closest("section")?.parentElement;
    const workspace = container.querySelector("main");

    expect(workspace).toHaveClass("touch-pan-y", "overflow-y-scroll", "md:overflow-hidden");
    expect(resumeViewport).toHaveClass("overscroll-auto", "md:overscroll-contain");
    expect(screen.getByTestId("resume-roast-chat-scroll")).toHaveClass(
      "overscroll-auto",
      "md:overscroll-contain"
    );
    expect(mobileGrid).toHaveClass(
      "grid-rows-[30rem_minmax(32rem,calc(100dvh-5.25rem))]",
      "md:h-full",
      "md:grid-rows-1"
    );
  });

  it("uses staged elapsed-time copy without promising a fixed completion time", () => {
    expect(resumeRoastProgressMessage(0)).toBe("James is reading your resume…");
    expect(resumeRoastProgressMessage(14)).toBe("James is reading your resume…");
    expect(resumeRoastProgressMessage(15)).toBe("Still working—good feedback takes a moment.");
    expect(resumeRoastProgressMessage(29)).toBe("Still working—good feedback takes a moment.");
    expect(resumeRoastProgressMessage(30)).toBe("Almost there…");
  });

  it("shows elapsed analysis time while the stream is pending", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(await screen.findByText("James is reading your resume…")).toBeVisible();
    expect(screen.getByText("Analysing · 0s")).toBeVisible();
  });

  it("auto-scrolls a fresh result once after five seconds", async () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(streamResponse());

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();
    await screen.findByText((text) => text.includes(result.openingRoast));
    await waitFor(() =>
      expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true)
    );
    const callback = timeoutSpy.mock.calls.find(([, delay]) => delay === 5_000)?.[0];
    expect(callback).toBeTypeOf("function");

    scrollToMock.mockClear();
    callback?.();

    expect(scrollToMock).toHaveBeenCalledOnce();
    expect(scrollToMock).toHaveBeenCalledWith({ top: expect.any(Number), behavior: "smooth" });
  });

  it("cancels the delayed result scroll when the user scrolls first", async () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(streamResponse());

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();
    await screen.findByText((text) => text.includes(result.openingRoast));
    await waitFor(() =>
      expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true)
    );
    const callback = timeoutSpy.mock.calls.find(([, delay]) => delay === 5_000)?.[0];

    scrollToMock.mockClear();
    fireEvent.wheel(screen.getByTestId("resume-roast-chat-scroll"));
    callback?.();

    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it.each([
    ["timeout", "James took too long. Try again."],
    ["invalid-response", "James couldn’t safely prepare that feedback. Try again."],
    ["generation-failed", "James is temporarily unavailable. Try again."]
  ] as const)("shows the specific %s stream failure", async (code, message) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(errorStreamResponse(code));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(await screen.findByText(message)).toBeVisible();
  });

  it("shows a rate-limit message from a non-stream API response", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "RESUME_ROAST_RATE_LIMITED", message: "sanitized" } }, 429)
      );

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(
      await screen.findByText("You’ve requested several roasts. Try again in a few minutes.")
    ).toBeVisible();
  });
});
