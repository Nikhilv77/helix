import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreTechnicalPublicBlock } from "@/features/practice/core-technical/server/practice.service";

const mocks = vi.hoisted(() => ({
  openCoreTechnicalAssessmentRoom: vi.fn()
}));

vi.mock("@/features/interviews/ui/shared/interview-room-navigation", () => ({
  coreTechnicalAssessmentRoomHref: (sessionId: string) =>
    `/practice/core-technical/assessment?session=${encodeURIComponent(sessionId)}`,
  openCoreTechnicalAssessmentRoom: mocks.openCoreTechnicalAssessmentRoom
}));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({
    id: "maya",
    name: "Maya",
    portrait: "/images/teacher-portraits/maya.jpg"
  })
}));

import { CoreTechnicalBlockAssessmentPreview } from "./core-technical-block-assessment-preview";

const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

function makeBlock(
  status: "LOCKED" | "READY" | "IN_PROGRESS" | "COMPLETED",
  overrides: Partial<CoreTechnicalPublicBlock> = {}
): CoreTechnicalPublicBlock {
  const completedQuestions = status === "LOCKED" ? 6 : 8;
  const dbStatus =
    status === "COMPLETED"
      ? "ASSESSED"
      : status === "READY"
        ? "ASSESSMENT_READY"
        : status === "LOCKED"
          ? "PRACTISING"
          : "ASSESSMENT_IN_PROGRESS";

  return {
    id: BLOCK_ID,
    ordinal: 1,
    isCurrent: true,
    status: dbStatus,
    story: {
      title: "Trace event loop scheduling",
      premise: "Diagnose timer vs microtask execution ordering under high load.",
      expectedMinutes: 45,
      mechanismKeys: ["event-loop", "microtasks"],
      stages: []
    },
    selection: { difficulty: "guided", reason: "Focus on Node.js runtime mechanics." },
    questions: Array.from({ length: 8 }, (_, index) => ({
      id: `question-${index + 1}`,
      order: index + 1,
      status: index < completedQuestions ? "COMPLETED" : "PENDING"
    })),
    assessment: {
      id: ASSESSMENT_ID,
      status:
        status === "COMPLETED"
          ? "COMPLETED"
          : status === "READY"
            ? "READY"
            : status === "LOCKED"
              ? "LOCKED"
              : "IN_PROGRESS",
      schemaVersion: 1,
      evaluatorVersion: "core-technical-assessment-evaluator-v1",
      readyAt: "2026-09-07T17:00:00.000Z",
      startedAt: status === "READY" || status === "LOCKED" ? null : "2026-09-07T17:05:00.000Z",
      completedAt: status === "COMPLETED" ? "2026-09-07T18:00:00.000Z" : null,
      assessment: {
        schemaVersion: 1,
        blueprintVersion: "core-technical-assessment-blueprint-v1",
        preparedAt: "2026-09-07T17:00:00.000Z",
        prompts: [
          {
            id: "prompt-1",
            order: 1,
            kind: "weak-response-review",
            prompt: "Why does process.nextTick starve setTimeout in high load?",
            context: "Observed microtask queue accumulation."
          },
          {
            id: "prompt-4",
            order: 4,
            kind: "repair-implementation-transfer",
            prompt: "Implement a bounded queue to prevent event loop starvation.",
            context: "Repair transfer code."
          }
        ],
        submission: null
      },
      report: status === "COMPLETED" ? makeReport() : null,
      transcript: null
    } as unknown as NonNullable<CoreTechnicalPublicBlock["assessment"]>,
    ...overrides
  } as CoreTechnicalPublicBlock;
}

function makeReport() {
  return {
    schemaVersion: 1,
    evaluatorVersion: "core-technical-assessment-evaluator-v1",
    scoringVersion: "core-technical-assessment-scoring-v1",
    finalizedAt: "2026-09-07T18:00:00.000Z",
    scores: {
      technicalAccuracy: 88,
      mechanismReasoning: 82,
      diagnosisEvidence: 79,
      debuggingImplementation: 91,
      communicationProduction: 85
    },
    overallScore: 85,
    teacherSummary:
      "Excellent grasp of Node.js microtask mechanics and resilient transfer code repair.",
    strengths: ["Causal event loop tracing", "Defensive bounded batching"],
    improvementAreas: ["Quantify GC pressure under load"],
    promptFeedback: [
      {
        promptId: "prompt-1",
        score: 85,
        feedback: "Clear distinction between nextTick and macrotask queues."
      }
    ],
    solvedVsLearned: {
      completedCount: 8,
      learnedCount: 0,
      learnedQuestionOrders: [],
      masteryCreditNote: "All questions verified through deterministic execution."
    },
    deterministicEvidence: {
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 1,
      implementationScoreCapped: false
    },
    nextStory: {
      policyVersion: 2,
      focusFingerprint: `sha256:${"a".repeat(64)}`,
      evidence: {},
      selectedStory: {
        storyKey: "stream-backpressure",
        storyVersion: 1,
        title: "Streaming backpressure handling",
        difficulty: "standard",
        emphasizedConceptKeys: ["streams", "drain-event"],
        scores: {}
      },
      rankings: [],
      reason: "Next story advances into stream flow control."
    }
  };
}

describe("CoreTechnicalBlockAssessmentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders locked state and shows remaining questions to unlock", () => {
    const block = makeBlock("LOCKED");
    render(<CoreTechnicalBlockAssessmentPreview block={block} terminalCount={6} />);

    expect(screen.getByText(/Maya\s*·\s*1:1 coach/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 questions until your 1:1" })).toBeInTheDocument();
    expect(
      screen.getByText(/Solve your path questions to unlock this assessment with Maya/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check progress" })).toBeInTheDocument();

    // Opening notice
    fireEvent.click(screen.getByRole("button", { name: "Check progress" }));
    expect(screen.getByText("Checkpoint Locked")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Finish your 2 remaining questions" })
    ).toBeInTheDocument();
  });

  it("starts the ready assessment once and opens the dedicated room", async () => {
    const block = makeBlock("READY");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { sessionId: SESSION_ID }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    render(<CoreTechnicalBlockAssessmentPreview block={block} terminalCount={8} />);

    expect(screen.getByText("Assessment ready")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your 1:1 with Maya is ready" })).toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: /start assessment/i });
    expect(startButton).toBeInTheDocument();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mocks.openCoreTechnicalAssessmentRoom).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/practice/core-technical/assessment/start",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("announces API failure on start and permits retry", async () => {
    const block = makeBlock("READY");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: { message: "Server overloaded" } }),
        { status: 500, headers: { "content-type": "application/json" } }
      )
    );

    render(<CoreTechnicalBlockAssessmentPreview block={block} terminalCount={8} />);

    fireEvent.click(screen.getByRole("button", { name: /start assessment/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server overloaded");
    });
    expect(mocks.openCoreTechnicalAssessmentRoom).not.toHaveBeenCalled();
  });

  it("resumes an in-progress assessment session directly", async () => {
    const block = makeBlock("IN_PROGRESS");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { sessionId: SESSION_ID }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    render(<CoreTechnicalBlockAssessmentPreview block={block} terminalCount={8} />);

    const resumeButton = screen.getByRole("button", { name: /resume assessment/i });
    expect(resumeButton).toBeInTheDocument();

    fireEvent.click(resumeButton);

    await waitFor(() => {
      expect(mocks.openCoreTechnicalAssessmentRoom).toHaveBeenCalledWith(SESSION_ID);
    });
  });

  it("displays the completed scorecard with scores and teacher feedback", () => {
    const block = makeBlock("COMPLETED");
    render(<CoreTechnicalBlockAssessmentPreview block={block} terminalCount={8} />);

    expect(screen.getByText("Completed Checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Maya’s Assessment Scorecard")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText(/Excellent grasp of Node.js microtask mechanics/i)).toBeInTheDocument();
    expect(screen.getByText("Technical accuracy")).toBeInTheDocument();
    expect(screen.getByText("Mechanism reasoning")).toBeInTheDocument();
    expect(screen.getByText("Debugging & repair")).toBeInTheDocument();
    expect(screen.getByText("Production verification")).toBeInTheDocument();

    // Toggle strengths & improvement areas
    const toggleButton = screen.getByRole("button", { name: /View strengths & areas to polish/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText("Causal event loop tracing")).toBeInTheDocument();
    expect(screen.getByText("Quantify GC pressure under load")).toBeInTheDocument();
  });
});
