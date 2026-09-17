import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InterviewReport } from "@/lib/shared/types";
import { createReportsOverview } from "@/features/reports/application/reports-overview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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
vi.mock("./report-maya-avatar", () => ({
  ReportMayaAvatar: () => <div data-testid="teacher-avatar" />
}));

import { InterviewReportDashboard } from "./interview-report-dashboard";

const report = {
  sessionId: "session-1",
  status: "completed",
  setup: {
    role: "backend",
    level: "3-5",
    roundType: "hiring-manager",
    intensity: "realistic",
    context: "Final conversation",
    resumeRound: true,
    templateId: "hiring-manager-final"
  },
  startedAt: 1_000,
  updatedAt: 2_000,
  durationMs: 1_000,
  questionCount: 1,
  questionsCovered: 1,
  answerCount: 1,
  competencies: [
    {
      questionIndex: 0,
      label: "Accountability",
      question: "Tell me about a mistake.",
      answered: true,
      answerPreview: "I owned it and repaired it.",
      evidenceScore: 76,
      evidenceLevel: "strong",
      signals: ["Clear ownership"],
      gap: "Add the durable change.",
      nextStep: "Explain what changed afterward.",
      technicalEvaluation: {
        source: "semantic-evaluator",
        score: 76,
        verdict: "mostly-correct",
        confidence: 0.9,
        summary: "Clear responsibility.",
        strengths: ["Owned the mistake."],
        gaps: [],
        rubricScores: [
          "motivation-fit",
          "judgement",
          "collaboration",
          "accountability",
          "self-awareness",
          "communication"
        ].map((rubricKey) => ({
          rubricKey,
          score: 76,
          rationale: "This showed direct personal ownership.",
          evidenceQuotes: ["I owned it"]
        })),
        execution: null
      }
    }
  ],
  interaction: { probes: 0, challenges: 0, clarifications: 0, interruptions: 0 },
  codeExercise: null,
  summary: {
    evidenceScore: 76,
    strongest: "Accountability",
    recommendedFocus: "Collaboration",
    nextStep: "Explain the repair and what changed next."
  },
  transcript: [
    {
      speaker: "user",
      text: "I owned it and repaired it.",
      startMs: 81_000,
      endMs: 84_000,
      questionIndex: 0
    }
  ]
} satisfies InterviewReport;

describe("InterviewReportDashboard", () => {
  afterEach(cleanup);

  it("shows the latest round with its own parameters and five-family overall scores", () => {
    render(
      <InterviewReportDashboard
        report={report}
        overview={createReportsOverview([report])}
        candidate={{ name: "Nikhil", discipline: "Backend Engineering" }}
        quota={{ used: 1, limit: 2 }}
      />
    );

    expect(screen.getByLabelText(/james reported back to me/i)).toBeVisible();
    expect(screen.getByText("Overall performance")).toBeVisible();
    expect(screen.getAllByText("DSA Interview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("System Design").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Core Technical & Projects").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HR & Behavioural").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resume & Behavioural").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Motivation & fit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accountability").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/At 1:21, you said “I owned it”/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Average of the six scores/i)).toBeNull();
    expect(screen.getByText(/Evidence quality · 1\/1 questions answered/i)).toBeVisible();
    expect(screen.getAllByText("Not yet").length).toBeGreaterThan(0);
    expect(screen.queryByText(/duration:/i)).toBeNull();
  });

  it("does not invent a what-went-well section when every signal is weak", () => {
    const weak = {
      ...report,
      competencies: report.competencies.map((competency) => ({
        ...competency,
        technicalEvaluation: competency.technicalEvaluation
          ? {
              ...competency.technicalEvaluation,
              rubricScores: competency.technicalEvaluation.rubricScores.map((item, index) => ({
                ...item,
                score: 11 + index
              }))
            }
          : undefined
      }))
    } satisfies InterviewReport;

    render(
      <InterviewReportDashboard
        report={weak}
        overview={createReportsOverview([weak])}
        candidate={{ name: "Nikhil", discipline: "Backend Engineering" }}
        quota={{ used: 1, limit: 2 }}
      />
    );

    expect(screen.queryByRole("heading", { name: "What went well" })).toBeNull();
  });

  it("shows a separate coding mark and explains an accepted run without tests", () => {
    const withCode = {
      ...report,
      codeExercise: {
        language: "TypeScript",
        task: "Implement an async debounce function.",
        submitted: true,
        correctnessScore: 10,
        execution: {
          status: "Accepted",
          accepted: true,
          testsPassed: 0,
          testCount: 0
        }
      }
    } satisfies InterviewReport;

    render(
      <InterviewReportDashboard
        report={withCode}
        overview={createReportsOverview([withCode])}
        candidate={{ name: "Nikhil", discipline: "Backend Engineering" }}
        quota={{ used: 1, limit: 2 }}
      />
    );

    expect(screen.getByRole("heading", { name: /coding exercise · typescript/i })).toBeVisible();
    expect(screen.getByText("Code score")).toBeVisible();
    expect(screen.getByText("10")).toBeVisible();
    expect(screen.getByText(/Ran successfully · no automated tests/i)).toBeVisible();
    expect(screen.getByText(/only confirms the code executed/i)).toBeVisible();
  });
});
