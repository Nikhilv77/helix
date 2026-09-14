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
        ].map((rubricKey) => ({ rubricKey, score: 76, rationale: "Supported evidence." })),
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
  transcript: []
} satisfies InterviewReport;

describe("InterviewReportDashboard", () => {
  afterEach(cleanup);

  it("shows the latest round with its own parameters and four-family overall scores", () => {
    render(
      <InterviewReportDashboard
        report={report}
        overview={createReportsOverview([report])}
        candidate={{ name: "Nikhil", discipline: "Backend Engineering" }}
        quota={{ used: 1, limit: 2 }}
      />
    );

    expect(screen.getByLabelText(/james reported back to me/i)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /one scorecard for each interview family/i })
    ).toBeVisible();
    expect(screen.getAllByText("DSA & Design").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Core Technical & Projects").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HR & Behavioural").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resume & Behavioural").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Motivation & fit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accountability").length).toBeGreaterThan(0);
    expect(screen.queryByText(/duration:/i)).toBeNull();
  });
});
