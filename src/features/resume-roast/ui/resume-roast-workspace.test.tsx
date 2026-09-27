import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ResumeRoastResult,
  ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import type { CandidateResume } from "@/lib/shared/types";
import {
  encodeResumeRoastStreamEvent,
  resumeRoastResultEvents
} from "@/features/resume-roast/application/stream";
import { WORKSPACE_NOTIFICATIONS_CHANGED_EVENT } from "@/features/notifications/ui/notification-ui-events";
import { ResumeRoastWorkspace, resumeRoastProgressMessage } from "./resume-roast-workspace";

const voice = vi.hoisted(() => ({
  speak: vi.fn(
    async (
      _line: string,
      _persona?: string,
      callbacks?: {
        onEnded?: () => void;
        onError?: () => void;
        playbackRate?: number;
        delivery?: "quality" | "fast";
      }
    ) => {
      callbacks?.onEnded?.();
      return "started" as const;
    }
  ),
  preload: vi.fn(),
  stop: vi.fn(),
  setAwaitingGesture: vi.fn()
}));

vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    progress: 0,
    speak: voice.speak,
    stop: voice.stop,
    preload: voice.preload,
    awaitingGesture: false,
    setAwaitingGesture: voice.setAwaitingGesture
  })
}));

// The upload itself is covered with Profile; here it only hands back a profile.
vi.mock("@/features/profile/ui/resume-update-modal", () => ({
  ResumeUpdateModal: ({
    open,
    profile,
    onUpdated
  }: {
    open: boolean;
    profile: { resume: CandidateResume | null };
    onUpdated: (profile: { resume: CandidateResume }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onUpdated({
            resume: {
              ...(profile.resume ?? updatedResumeBase),
              fileName: "resume-v2.pdf"
            }
          })
        }
      >
        Finish upload
      </button>
    ) : null
}));

vi.mock("@/features/reports/ui/report-maya-avatar", () => ({
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

const updatedResumeBase: CandidateResume = resume;

const resumeTarget = { targetRole: "backend", level: "5-plus" } as const;

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

/** A rubric-era result: the score comes from the scorecard, not the verdict. */
const scoredResult: ResumeRoastResult = {
  ...result,
  problems: [
    {
      ...result.problems[0]!,
      dimension: "impact",
      quote: "Improved API performance."
    }
  ],
  verdict: {
    band: "solid",
    explanation: "You'd get shortlisted, but the performance bullet makes them guess."
  },
  scorecard: {
    rubricVersion: "rubric-v1",
    overall: 7,
    dimensions: {
      roleFit: { score: 4, note: "Clearly backend work.", evidenceAnchors: [] },
      impact: { score: 2, note: "Performance claims with no numbers.", evidenceAnchors: [] },
      ownership: { score: 4, note: "Owned the payments migration.", evidenceAnchors: [] },
      technical: { score: 4, note: "TypeScript and PostgreSQL in real work.", evidenceAnchors: [] },
      readability: { score: 4, note: "Short and easy to skim.", evidenceAnchors: [] }
    }
  }
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function streamResponse(roastResult: ResumeRoastResult = result) {
  const body = resumeRoastResultEvents({ roastId, replayed: false, target, result: roastResult })
    .map(encodeResumeRoastStreamEvent)
    .join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function errorStreamResponse(
  code: "timeout" | "invalid-response" | "rate-limited" | "generation-failed"
) {
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
      previousRoast,
      history: previousRoast ? [{ ...previousRoast, createdAt: 1 }] : [],
      inProgress: null
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

  it("swaps in an updated resume without leaving the page", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState({ id: roastId, target, result })))
      .mockResolvedValueOnce(jsonResponse(readyState()));

    render(<ResumeRoastWorkspace resume={resume} resumeTarget={resumeTarget} />);
    expect(await screen.findByText("nikhil-resume.pdf")).toBeVisible();

    fireEvent.click(await screen.findByRole("button", { name: "Update resume" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish upload" }));

    expect(await screen.findByText("resume-v2.pdf")).toBeVisible();
    // The new version has no roast yet, so James asks the questions again.
    expect(await screen.findByRole("button", { name: "Backend Engineer" })).toBeVisible();
    expect(screen.queryByText((text) => text.includes(result.openingRoast))).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("hides resume updates without a profile target, and while analysing", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));

    const { rerender } = render(<ResumeRoastWorkspace resume={resume} />);
    await screen.findByText("nikhil-resume.pdf");
    expect(screen.queryByRole("button", { name: "Update resume" })).toBeNull();

    rerender(<ResumeRoastWorkspace resume={resume} resumeTarget={resumeTarget} />);
    expect(screen.getByRole("button", { name: "Update resume" })).toBeVisible();
    await chooseTarget();
    await screen.findByText("Analysing · 0s");
    expect(screen.queryByRole("button", { name: "Update resume" })).toBeNull();
  });

  it("lets users without a resume upload one right here", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          data: { hasResume: false, target: null, suggestedTarget: null, previousRoast: null }
        })
      )
      .mockResolvedValueOnce(jsonResponse(readyState()));

    render(<ResumeRoastWorkspace resume={null} resumeTarget={resumeTarget} />);

    fireEvent.click(await screen.findByRole("button", { name: "Upload resume" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish upload" }));
    expect(await screen.findByText("resume-v2.pdf")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Go to Profile" })).toBeNull();
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
      await screen.findAllByText(
        "Okay, I’ve got your resume. Three quick questions, then we’ll get into it."
      )
    ).toHaveLength(2);
    expect(await screen.findAllByText("Which position are you targeting?")).toHaveLength(2);
    await waitFor(() =>
      expect(voice.speak).toHaveBeenCalledWith(
        "Okay, I’ve got your resume. Three quick questions, then we’ll get into it. Which position are you targeting?",
        "james"
      )
    );
    expect(voice.preload).toHaveBeenCalledWith(
      "What kind of company are we trying to impress?",
      "james"
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // The profile's role is marked, never pre-selected.
    const suggested = await screen.findByRole("button", { name: /^Backend Engineer/ });
    expect(suggested).toHaveTextContent("From profile");
    fireEvent.click(suggested);
    expect(
      await screen.findAllByText("What kind of company are we trying to impress?")
    ).toHaveLength(2);
    fireEvent.click(await screen.findByRole("button", { name: "Product company" }));
    expect(await screen.findAllByText("What level are you applying for?")).toHaveLength(2);
    fireEvent.click(await screen.findByRole("button", { name: /^Senior/ }));

    expect(await screen.findByText((text) => text.includes(result.openingRoast))).toBeVisible();
    expect(
      await screen.findByText((text) => text.includes(result.problems[0]!.joke))
    ).toBeVisible();
    expect(
      await screen.findByText((text) => text.includes(result.actionPlan[0]!.action))
    ).toBeVisible();
    expect(await screen.findByLabelText("Target fit score: 62 out of 100")).toBeVisible();
    expect(screen.getByRole("heading", { name: "What’s costing you" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "What’s working" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Before you send it" })).toBeVisible();
    expect(screen.queryByText("James is speaking")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete roast" })).toBeNull();
    const transcript = screen.getByLabelText("James transcript");
    expect(within(transcript).getByText("Backend Engineer")).toBeVisible();
    expect(within(transcript).getByText("Product company")).toBeVisible();
    expect(within(transcript).getByText("Senior")).toBeVisible();
    expect(within(transcript).getByText(/you’ve done useful backend work/i)).toBeVisible();
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
      "Now check—I’ve laid out every issue with your resume and exactly how to fix it."
    );
    expect(roastCall?.[2]).toEqual({ delivery: "fast" });
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

  it("reuses the resume-round document preview beside the generated review", async () => {
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
    expect(screen.getByText("nikhil-resume.pdf")).toBeVisible();
    expect(screen.getByLabelText("James transcript")).toBeVisible();
  });

  it("uses the resume-round responsive three-column shell", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(readyState()));

    const { container } = render(<ResumeRoastWorkspace resume={resume} />);

    await screen.findByText("nikhil-resume.pdf");
    const workspace = container.querySelector("main");
    const room = workspace?.querySelector(":scope > div");

    expect(workspace).toHaveClass("h-[calc(100dvh-4.25rem)]", "overflow-hidden");
    expect(room).toHaveClass(
      "flex",
      "overflow-y-auto",
      "xl:grid",
      "xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_19rem]",
      "xl:overflow-hidden"
    );
    expect(screen.getByTestId("resume-roast-transcript")).toHaveClass("overscroll-contain");
  });

  it("uses staged elapsed-time copy without promising a fixed completion time", () => {
    expect(resumeRoastProgressMessage(0)).toBe("James is reading your resume…");
    expect(resumeRoastProgressMessage(3)).toBe("Scoring it the way a recruiter would…");
    expect(resumeRoastProgressMessage(7)).toBe("Writing the roast…");
    expect(resumeRoastProgressMessage(15)).toBe("Still working. Good feedback takes a moment.");
    expect(resumeRoastProgressMessage(29)).toBe("Still working. Good feedback takes a moment.");
    expect(resumeRoastProgressMessage(30)).toBe("Almost there…");
  });

  it("shows elapsed analysis time while the stream is pending", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(await screen.findAllByText("James is reading your resume…")).toHaveLength(2);
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

  it("shows the rubric scorecard with each jab next to its fix and source", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(streamResponse(scoredResult));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    const score = await screen.findByLabelText("James's score: 7 out of 10, Would shortlist");
    expect(score).toBeVisible();
    expect(within(score).getByText("Performance claims with no numbers.")).toBeVisible();
    expect(within(score).getByRole("img", { name: "2 out of 5" })).toBeVisible();
    expect(within(score).getByText("How James scores")).toBeVisible();
    expect(screen.getByText("Proof of impact", { selector: "p" })).toBeVisible();
    expect(screen.getByText("“Improved API performance.”")).toBeVisible();
    expect(screen.getByText(scoredResult.problems[0]!.improvement)).toBeVisible();
    // Placeholders in the rewrite are highlighted for the person to fill in.
    expect(screen.getByText("[verified amount]").tagName).toBe("MARK");
    expect(screen.getByText("Fill in the brackets with your real numbers.")).toBeVisible();
  });

  it("adds a finished roast to history with its target and score", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(streamResponse(scoredResult));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(await screen.findByText("Resume Roast history (1)")).toBeVisible();
    expect(screen.getByText("Senior Backend Engineer · Product company")).toBeInTheDocument();
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("offers the last target as a one-click roast", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState({ id: roastId, target, result })))
      .mockResolvedValueOnce(streamResponse());

    render(<ResumeRoastWorkspace resume={resume} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a fresh analysis" }));
    fireEvent.click(await screen.findByRole("button", { name: /Same as last time/ }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({ target });
  });

  it("follows a roast that was already running when the page loaded", async () => {
    const startedAt = Date.now() - 3_000;
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: { status: "generating", inProgress: {} } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            status: "ready",
            roast: { id: roastId, target, result: scoredResult, createdAt: startedAt }
          }
        })
      );

    render(
      <ResumeRoastWorkspace
        resume={resume}
        initialState={{
          ...readyState().data,
          inProgress: { roastId, target, startedAt }
        }}
      />
    );

    // No questions: it resumes the running analysis, counting from its start.
    expect(await screen.findByText(/^Analysing · [3-9]s$/)).toBeVisible();
    expect(
      await screen.findByLabelText("James's score: 7 out of 10, Would shortlist", {}, { timeout: 4_000 })
    ).toBeVisible();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(`/api/resume-roast?roastId=${roastId}`);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });

  it("joins the running roast when another tab already started one", async () => {
    const startedAt = Date.now();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(jsonResponse({ data: { inProgress: { roastId, target, startedAt } } }, 202))
      .mockResolvedValueOnce(
        jsonResponse({ data: { status: "ready", roast: { id: roastId, target, result: scoredResult } } })
      );

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(
      await screen.findByLabelText("James's score: 7 out of 10, Would shortlist", {}, { timeout: 4_000 })
    ).toBeVisible();
    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toBe(`/api/resume-roast?roastId=${roastId}`);
  });

  it("explains a followed roast that failed and offers a retry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: { status: "failed" } }));

    render(
      <ResumeRoastWorkspace
        resume={resume}
        initialState={{
          ...readyState().data,
          inProgress: { roastId, target, startedAt: Date.now() }
        }}
      />
    );

    expect(
      await screen.findAllByText("James is temporarily unavailable. Try again.", {}, { timeout: 4_000 })
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it.each([
    ["timeout", "James took too long. Try again."],
    ["invalid-response", "James couldn’t safely prepare that feedback. Try again."],
    ["rate-limited", "James is busy right now. Wait a minute and try again."],
    ["generation-failed", "James is temporarily unavailable. Try again."]
  ] as const)("shows the specific %s stream failure", async (code, message) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(readyState()))
      .mockResolvedValueOnce(errorStreamResponse(code));

    render(<ResumeRoastWorkspace resume={resume} />);
    await chooseTarget();

    expect(await screen.findAllByText(message)).toHaveLength(2);
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
      await screen.findAllByText("You’ve requested several roasts. Try again in a few minutes.")
    ).toHaveLength(2);
  });
});
