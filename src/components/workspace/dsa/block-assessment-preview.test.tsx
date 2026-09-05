import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DsaPracticeBlockStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DsaBlockHistoryItem } from "@/server/dsa/dsa-block-history.service";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({
    id: "sophia",
    name: "Sophia",
    portrait: "/images/teacher-portraits/sophia.jpg"
  })
}));

import { BlockAssessmentPreview } from "./block-assessment-preview";

const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

function block(
  status: DsaPracticeBlockStatus,
  overrides: Partial<DsaBlockHistoryItem> = {}
): DsaBlockHistoryItem {
  const flags = {
    practising: status === DsaPracticeBlockStatus.PRACTISING,
    assessmentReady: status === DsaPracticeBlockStatus.ASSESSMENT_READY,
    assessmentInProgress: status === DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS,
    assessed: status === DsaPracticeBlockStatus.ASSESSED
  };
  return {
    id: BLOCK_ID,
    ordinal: 2,
    current: status !== DsaPracticeBlockStatus.ASSESSED,
    status,
    flags,
    dates: {
      createdAt: "2026-09-01T00:00:00.000Z",
      assessmentReadyAt: "2026-09-02T00:00:00.000Z",
      assessmentStartedAt: "2026-09-02T00:05:00.000Z",
      assessedAt: "2026-09-02T00:25:30.000Z"
    },
    recommendation: {
      tier: "building",
      source: "performance",
      targetLabel: "Frontend mid-level",
      focusChapterId: "arrays-hashing",
      focusLabel: "Arrays & Hashing",
      strengthLabel: null,
      blockTitle: "Arrays & Hashing",
      rationale: "Saved recommendation",
      questions: Array.from({ length: 8 }, (_, index) => ({
        slug: `question-${index}`,
        title: `Question ${index}`,
        difficulty: "medium" as const,
        primaryPattern: "hash-map",
        expectedTimeMinutes: 10,
        phaseSlug: "arrays",
        phaseNumber: 1,
        recommendedOrder: index + 1,
        status: index === 0 ? ("COMPLETED" as const) : ("NOT_STARTED" as const)
      })),
      minutes: 80,
      mix: { easy: 1, medium: 7, hard: 0 },
      estimatedPathQuestions: 72,
      availableQuestions: 200,
      legacy: false
    },
    completedQuestions: status === DsaPracticeBlockStatus.PRACTISING ? 1 : 8,
    totalQuestions: 8,
    assessment: {
      sessionId: status === DsaPracticeBlockStatus.PRACTISING ? null : SESSION_ID,
      report: status === DsaPracticeBlockStatus.ASSESSED ? report() : null,
      prompts: [
        {
          kind: "code-review",
          title: "Why use this map?",
          sourceQuestionTitle: "Two Sum",
          codeSnippet: "const seen = new Map();",
          options: ["Lookup", "Sorting"]
        },
        {
          kind: "transfer",
          title: "Fresh transfer problem",
          sourceQuestionTitle: null,
          codeSnippet: null,
          options: null
        }
      ]
    },
    transcript: null,
    ...overrides
  };
}

function report() {
  return {
    reportVersion: 1 as const,
    scoringVersion: 1 as const,
    rubricVersion: 1,
    blockId: BLOCK_ID,
    assessmentId: "33333333-3333-4333-8333-333333333333",
    sessionId: SESSION_ID,
    completedAt: "2026-09-02T00:25:30.000Z",
    durationMs: 1_230_000,
    completion: { answered: 6, skipped: 1, total: 7, partial: true },
    metrics: {
      "pattern-recognition": 81,
      "correctness-edge-cases": 72,
      efficiency: 63,
      "code-quality": 94,
      communication: 55
    },
    overall: 74,
    evidence: { review: [], transfer: [], byPattern: {} },
    strengths: ["Clear implementation"],
    gaps: ["Name edge cases earlier"],
    teacherSummary: "Strong structure with one missed boundary.",
    nextRecommendationSignals: {
      weakestMetric: "communication" as const,
      strongestMetric: "code-quality" as const,
      weakPatterns: ["sliding-window"],
      strongPatterns: ["hash-map"],
      evidencePrecedence: "assessment-complements-verified-practice" as const
    }
  };
}

describe("BlockAssessmentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the practising state and exact remaining count with the nudge", () => {
    render(
      <BlockAssessmentPreview
        block={block(DsaPracticeBlockStatus.PRACTISING)}
        nextBlockId={null}
        allowEarlyStart
      />
    );

    expect(screen.getByText("7 problems left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start assessment" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /continue block/i })).toBeNull();
    expect(screen.queryByText(/\/100/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /block assessment, 7 problems left/i }));
    expect(screen.getByRole("status", { name: "Assessment notification" })).toHaveTextContent(
      "7 problems left in this block."
    );
    expect(screen.getByLabelText("Block assessment").className).toContain("assessment-card-nudge");
  });

  it("starts the ready assessment once and redirects to the persisted session", async () => {
    let resolveRequest!: (value: Response) => void;
    const fetchMock = vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    render(
      <BlockAssessmentPreview
        block={block(DsaPracticeBlockStatus.ASSESSMENT_READY)}
        nextBlockId={null}
      />
    );

    const start = screen.getByRole("button", { name: "Start assessment" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/interview/dsa/block-assessment/start",
      expect.objectContaining({ body: JSON.stringify({ blockId: BLOCK_ID }) })
    );
    resolveRequest(
      new Response(JSON.stringify({ success: true, data: { sessionId: SESSION_ID } }), {
        status: 200
      })
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(`/interview/voice?session=${SESSION_ID}`)
    );
  });

  it("announces a start API failure and allows a retry", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { message: "The snapshot is unavailable." } }),
        { status: 422 }
      )
    );
    render(
      <BlockAssessmentPreview
        block={block(DsaPracticeBlockStatus.ASSESSMENT_READY)}
        nextBlockId={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The snapshot is unavailable.");
    expect(screen.getByRole("button", { name: "Start assessment" })).toBeEnabled();
  });

  it("resumes the existing in-progress session without offering a new start", () => {
    render(
      <BlockAssessmentPreview
        block={block(DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS)}
        nextBlockId={null}
      />
    );
    expect(screen.getByRole("link", { name: /resume assessment/i })).toHaveAttribute(
      "href",
      `/interview/voice?session=${SESSION_ID}`
    );
    expect(screen.queryByRole("button", { name: /start assessment/i })).toBeNull();
  });

  it("shows all five exact scores and a partial completion report", () => {
    render(
      <BlockAssessmentPreview
        block={block(DsaPracticeBlockStatus.ASSESSED, { current: false })}
        nextBlockId="44444444-4444-4444-8444-444444444444"
      />
    );

    for (const score of ["81/100", "72/100", "63/100", "94/100", "55/100"]) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText(/6\/7 answered · 1 skipped · Partial completion/)).toBeInTheDocument();
    expect(screen.getByText("Strong structure with one missed boundary.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /review transcript/i })).toBeNull();
    expect(screen.queryByText("Fresh transfer problem")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /view more/i }));
    expect(screen.getByText("Fresh transfer problem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const resultPortrait = screen.getByAltText("Sophia, your assessment teacher");
    expect(resultPortrait).toHaveAttribute("sizes", "56px");
    expect(resultPortrait.closest("button")).toBeNull();
    expect(screen.getByRole("link", { name: /continue to your next block/i })).toHaveAttribute(
      "href",
      "/practice/dsa?block=44444444-4444-4444-8444-444444444444&panel=overview"
    );
  });
});
