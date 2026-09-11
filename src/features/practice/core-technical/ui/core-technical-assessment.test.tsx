import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreTechnicalPublicBlock } from "@/features/practice/core-technical/server/practice.service";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace, push: mocks.push })
}));

import { CoreTechnicalAssessment } from "./core-technical-assessment";

describe("CoreTechnicalAssessment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.push.mockReset();
    window.sessionStorage.clear();
  });

  it("renders locked, ready, and every frozen assessment prompt kind", async () => {
    const locked = makeBlock("LOCKED");
    const view = render(<CoreTechnicalAssessment block={locked} terminalCount={6} />);
    expect(screen.getByRole("heading", { name: "2 questions left to unlock" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start assessment/i })).toBeNull();
    expect(screen.getByText("Measures")).toBeInTheDocument();
    expect(screen.getByText("Technical accuracy")).toBeInTheDocument();

    view.rerender(<CoreTechnicalAssessment block={makeBlock("READY")} terminalCount={8} />);
    expect(await screen.findByRole("button", { name: "Start assessment" })).toBeInTheDocument();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ assessment: makeAssessment("IN_PROGRESS") })
    );
    fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(
      await screen.findByRole("heading", { name: "Five-prompt evidence defence" })
    ).toBeInTheDocument();
    for (const prompt of prompts()) {
      expect(
        screen.getByText(new RegExp(prompt.kind.replaceAll("-", " "), "i"))
      ).toBeInTheDocument();
      expect(screen.getByLabelText(prompt.prompt)).toBeInTheDocument();
    }
    const body = requestBodies()[0];
    expect(body).toMatchObject({ assessmentId: ASSESSMENT_ID, requestId: expect.any(String) });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("exposes the DSA-style ready assessment during development preview", () => {
    render(
      <CoreTechnicalAssessment block={makeBlock("LOCKED")} terminalCount={2} allowEarlyStart />
    );

    expect(
      screen.getByRole("heading", { name: "Your 1:1 with Maya is ready" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start assessment" })).toBeInTheDocument();
    expect(
      screen.getByText(/unfinished questions will be recorded as Learned/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Communication & production")).toBeInTheDocument();
  });

  it("opens a dedicated Core Technical room from the overview", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ assessment: makeAssessment("IN_PROGRESS") })
    );
    render(
      <CoreTechnicalAssessment block={makeBlock("READY")} terminalCount={8} dedicatedRoom={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/practice/core-technical/assessment/${ASSESSMENT_ID}?block=${BLOCK_ID}`
      )
    );
    expect(screen.queryByRole("heading", { name: "Five-prompt evidence defence" })).toBeNull();
  });

  it("announces validation and moves focus to the first incomplete answer", () => {
    render(<CoreTechnicalAssessment block={makeBlock("IN_PROGRESS")} terminalCount={8} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit all answers" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/answer every prompt/i);
    expect(screen.getByLabelText(prompts()[0]!.prompt)).toHaveFocus();
  });

  it("keeps a failed finalization retry bound to the same checkpointed answers and request", async () => {
    const bodies: unknown[] = [];
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      call += 1;
      if (call === 1) return failure("Your answers are safe, but the evaluator is unavailable.");
      return response({ assessment: makeAssessment("COMPLETED") });
    });
    render(<CoreTechnicalAssessment block={makeBlock("IN_PROGRESS")} terminalCount={8} />);
    const textareas = screen.getAllByRole("textbox");
    textareas.forEach((textarea, index) =>
      fireEvent.change(textarea, { target: { value: `Complete evidence answer ${index + 1}` } })
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit all answers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/evaluator is unavailable/i);
    expect(screen.getByRole("heading", { name: "Complete your saved report" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Submission interrupted");
    expect(screen.getByRole("button", { name: "Retry report" })).toBeInTheDocument();
    expect(textareas[0]).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: "Retry report" }));
    expect(await screen.findByRole("heading", { name: "70/100 overall" })).toBeInTheDocument();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it("restores the exact server-checkpointed FINALIZING submission after refresh", async () => {
    const submission = {
      requestId: FINALIZE_REQUEST_ID,
      responses: prompts().map((prompt) => ({
        promptId: prompt.id,
        answer: `Saved answer for ${prompt.id}`
      })),
      submittedAt: "2026-09-07T18:00:00.000Z"
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ assessment: makeAssessment("COMPLETED") })
    );
    render(
      <CoreTechnicalAssessment block={makeBlock("FINALIZING", { submission })} terminalCount={8} />
    );

    expect(screen.getByDisplayValue(submission.responses[0]!.answer)).toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent("Finalizing");
    fireEvent.click(screen.getByRole("button", { name: "Retry report" }));
    await screen.findByRole("heading", { name: "70/100 overall" });
    expect(requestBodies()[0]).toEqual({
      assessmentId: ASSESSMENT_ID,
      requestId: FINALIZE_REQUEST_ID,
      responses: submission.responses
    });
  });

  it("keeps the full report visible across Continue failure and retries with one request ID", async () => {
    const bodies: unknown[] = [];
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      call += 1;
      return call === 1
        ? failure("The next story could not be generated. This report is still current.")
        : response({ replayed: false, block: { id: NEXT_BLOCK_ID } });
    });
    render(<CoreTechnicalAssessment block={makeBlock("COMPLETED")} terminalCount={8} />);

    expect(screen.getByRole("region", { name: "Strengths" })).toHaveTextContent(
      "Clear causal reasoning"
    );
    expect(screen.getByRole("region", { name: "Improve next" })).toHaveTextContent(
      "Add stronger runtime evidence"
    );
    expect(screen.getByText(/contributes zero Practice mastery/i)).toBeInTheDocument();
    expect(screen.getByText(/implementation score cap was preserved/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The operation fails halfway" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Review your safe transcript"));
    expect(screen.getByText("Saved candidate answer 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to next practice path" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/still current/i);
    expect(screen.getByRole("heading", { name: "70/100 overall" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry next practice path" }));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(`/practice/core-technical?block=${NEXT_BLOCK_ID}`)
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("renders historical reports without mutation controls", () => {
    render(
      <CoreTechnicalAssessment
        block={{ ...makeBlock("COMPLETED"), isCurrent: false }}
        terminalCount={8}
      />
    );
    expect(screen.getByText("Historical reports are read-only.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next story/i })).toBeNull();
  });
});

const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const FINALIZE_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const NEXT_BLOCK_ID = "44444444-4444-4444-8444-444444444444";

function prompts() {
  const kinds = [
    "weak-response-review",
    "code-evidence-defence",
    "unseen-diagnosis-transfer",
    "repair-implementation-transfer",
    "production-verification-defence"
  ] as const;
  return kinds.map((kind, index) => ({
    id: `assessment-prompt-${index + 1}`,
    order: index + 1,
    kind,
    prompt: `Explain the production evidence for assessment prompt ${index + 1}.`,
    context: index === 0 ? "Use the saved story trace." : null
  }));
}

function makeBlock(
  status: "LOCKED" | "READY" | "IN_PROGRESS" | "FINALIZING" | "COMPLETED",
  snapshotOverrides: Record<string, unknown> = {}
): CoreTechnicalPublicBlock {
  return {
    id: BLOCK_ID,
    ordinal: 1,
    isCurrent: true,
    status:
      status === "COMPLETED"
        ? "ASSESSED"
        : status === "READY"
          ? "ASSESSMENT_READY"
          : status === "LOCKED"
            ? "PRACTISING"
            : "ASSESSMENT_IN_PROGRESS",
    story: {
      title: "Follow the operation",
      premise: "Trace a production operation.",
      expectedMinutes: 45,
      mechanismKeys: [],
      stages: []
    },
    selection: { difficulty: "guided", reason: "Selected from saved evidence." },
    questions: Array.from({ length: 8 }, (_, index) => ({
      id: `question-${index + 1}`,
      order: index + 1,
      status: index < 6 ? "COMPLETED" : "PENDING"
    })),
    assessment: makeAssessment(status, snapshotOverrides)
  } as unknown as CoreTechnicalPublicBlock;
}

function makeAssessment(
  status: "LOCKED" | "READY" | "IN_PROGRESS" | "FINALIZING" | "COMPLETED",
  snapshotOverrides: Record<string, unknown> = {}
) {
  const completed = status === "COMPLETED";
  const assessment = {
    schemaVersion: 1,
    blueprintVersion: "core-technical-assessment-blueprint-v1",
    preparedAt: "2026-09-07T17:00:00.000Z",
    prompts: prompts(),
    submission: null,
    ...snapshotOverrides
  };
  return {
    id: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    status,
    schemaVersion: 1,
    evaluatorVersion: "core-technical-assessment-evaluator-v1",
    readyAt: "2026-09-07T17:00:00.000Z",
    startedAt: status === "READY" || status === "LOCKED" ? null : "2026-09-07T17:05:00.000Z",
    completedAt: completed ? "2026-09-07T18:00:00.000Z" : null,
    assessment,
    report: completed ? report() : null,
    transcript: completed ? transcript() : null
  } as NonNullable<CoreTechnicalPublicBlock["assessment"]>;
}

function report() {
  return {
    schemaVersion: 1,
    evaluatorVersion: "core-technical-assessment-evaluator-v1",
    scoringVersion: "core-technical-assessment-scoring-v1",
    finalizedAt: "2026-09-07T18:00:00.000Z",
    scores: {
      technicalAccuracy: 72,
      mechanismReasoning: 74,
      diagnosisEvidence: 68,
      debuggingImplementation: 35,
      communicationProduction: 76
    },
    overallScore: 70,
    teacherSummary:
      "You traced the core mechanism and communicated the impact, with a clear next step for stronger evidence.",
    strengths: ["Clear causal reasoning"],
    improvementAreas: ["Add stronger runtime evidence"],
    promptFeedback: prompts().map((prompt) => ({
      promptId: prompt.id,
      score: 70,
      feedback: "Good mechanism, but connect it to one more concrete production signal."
    })),
    solvedVsLearned: {
      completedCount: 7,
      learnedCount: 1,
      learnedQuestionOrders: [2],
      masteryCreditNote: "Question 2 was learned and contributes zero Practice mastery credit."
    },
    deterministicEvidence: {
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 2,
      implementationScoreCapped: true
    },
    nextStory: {
      policyVersion: 2,
      focusFingerprint: `sha256:${"f".repeat(64)}`,
      evidence: {},
      selectedStory: {
        storyKey: "operation-fails-halfway",
        storyVersion: 1,
        title: "The operation fails halfway",
        difficulty: "standard",
        emphasizedConceptKeys: ["resource-cleanup"],
        scores: {}
      },
      rankings: [],
      reason:
        "This next story strengthens cleanup and verification based on your saved assessment evidence."
    }
  } as unknown as NonNullable<NonNullable<CoreTechnicalPublicBlock["assessment"]>["report"]>;
}

function transcript() {
  return {
    schemaVersion: 1,
    assessmentId: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    entries: prompts().map((prompt, index) => ({
      ...prompt,
      answer: `Saved candidate answer ${index + 1}`
    }))
  } as unknown as NonNullable<NonNullable<CoreTechnicalPublicBlock["assessment"]>["transcript"]>;
}

function requestBodies(): Array<Record<string, unknown>> {
  return vi
    .mocked(fetch)
    .mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function failure(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status: 503,
    headers: { "content-type": "application/json" }
  });
}
