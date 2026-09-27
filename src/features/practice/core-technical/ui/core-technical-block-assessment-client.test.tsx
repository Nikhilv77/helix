import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionResponse } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  skipBlockAssessmentCode: vi.fn(),
  submitAnswer: vi.fn(),
  speak: vi.fn()
}));

vi.mock("@/lib/api/api-client", () => ({
  ApiClientError: class extends Error {},
  getSession: mocks.getSession,
  skipBlockAssessmentCode: mocks.skipBlockAssessmentCode,
  submitAnswer: mocks.submitAnswer
}));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "maya", name: "Maya", portrait: "/maya.jpg" })
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({ speak: mocks.speak, state: "idle", awaitingGesture: false })
}));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({ MayaStage: () => null }));
vi.mock("@/features/interviews/ui/dsa/dsa-code-editor", () => ({
  DsaCodeEditor: () => <div>editor</div>
}));
vi.mock("@/features/interviews/ui/voice/components/system-design-canvas", () => ({
  SystemDesignCanvas: () => null
}));

import { CoreTechnicalBlockAssessmentClient } from "./core-technical-block-assessment-client";

const SESSION_ID = "33333333-3333-4333-8333-333333333333";

function session(questionIndex: number, overrides: Partial<SessionResponse> = {}): SessionResponse {
  const code = questionIndex === 3;
  return {
    sessionId: SESSION_ID,
    phase: "questioning",
    questionIndex,
    questionCount: 5,
    followUpCount: 0,
    startedAt: Date.now() - 60_000,
    setup: {
      durationMinutes: 30,
      templateTitle: "Shared state assessment",
      storyPracticeAssessmentPresentation: {
        evidenceAnchorLabel: "Practice evidence",
        stages: [
          { id: "rapid", label: "Review", caption: "" },
          { id: "explain", label: "Diagnose & repair", caption: "" },
          { id: "scenario", label: "Production", caption: "" }
        ]
      }
    } as SessionResponse["setup"],
    turns: [
      { speaker: "agent", text: `Question ${questionIndex + 1}`, action: "move_on", at: 1 } as never
    ],
    currentQuestion: code
      ? ({
          kind: "code",
          stage: "explain",
          text: "Repair the nested profile updater.",
          codeTask: "Repair the nested profile updater."
        } as SessionResponse["currentQuestion"])
      : ({
          kind: "mcq",
          stage: "scenario",
          text: "Choose the production plan.",
          options: ["Mutate", "Clone", "Rebuild", "Copy"]
        } as SessionResponse["currentQuestion"]),
    ...overrides
  };
}

describe("CoreTechnicalBlockAssessmentClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("moves to the next question after skipping the coding task", async () => {
    mocks.getSession.mockResolvedValueOnce(session(3)).mockResolvedValue(session(4));
    mocks.skipBlockAssessmentCode.mockResolvedValue({ phase: "questioning" });

    render(<CoreTechnicalBlockAssessmentClient sessionId={SESSION_ID} workspaceAccent="ember" />);

    fireEvent.click(await screen.findByRole("button", { name: /can.t solve this/i }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByText("Choose the production plan.")).toBeTruthy();
    expect(screen.getByText("05 / 05")).toBeTruthy();
    // The next question must read as progress, not as the opening review.
    expect(screen.getByText("Production")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Coding task skipped");
    expect(screen.getByRole("status").textContent).toContain("Question 5 of 5");
    expect(mocks.skipBlockAssessmentCode).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID })
    );
  });

  it("gives written-answer questions an answer box and submits the text", async () => {
    const written = session(0, {
      currentQuestion: {
        kind: "conversation",
        stage: "rapid",
        text: "Revisit incident question 1. Correct the answer.",
        evidenceAnchor: "Checkout impact summary: 93 gateway timeouts; 27 duplicate order rows.",
        expects: ["the strongest observable signal", "the causal chain", "the consequence"]
      } as SessionResponse["currentQuestion"]
    });
    mocks.getSession.mockResolvedValue(written);
    mocks.submitAnswer.mockResolvedValue({ phase: "questioning" });

    render(
      <CoreTechnicalBlockAssessmentClient
        sessionId={SESSION_ID}
        workspaceAccent="ember"
        assessmentKind="applied-engineering"
      />
    );

    const box = await screen.findByRole("textbox", { name: "Your answer" });
    expect(screen.getByRole("heading", { name: "Checkout impact summary" })).toBeTruthy();
    expect(screen.getByText("93 gateway timeouts; 27 duplicate order rows.")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    // Each question structures its own answer from what a strong answer covers.
    fireEvent.click(screen.getByRole("button", { name: "+ Strongest observable signal" }));
    expect((box as HTMLTextAreaElement).value).toBe("Strongest observable signal:\n");
    expect(screen.getByRole("button", { name: "Strongest observable signal prompt added" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Causal chain" })).toBeTruthy();

    const answer = "The timeout retry reused the key but the insert was not idempotent.";
    fireEvent.change(box, { target: { value: answer } });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mocks.submitAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ userAnswer: answer, submissionSource: "workspace" })
      )
    );
  });

  it("shows an unscored recall check beside written questions", async () => {
    mocks.getSession.mockResolvedValue(
      session(0, {
        currentQuestion: {
          kind: "conversation",
          stage: "rapid",
          text: "Explain the failure path.",
          evidenceAnchor: "Timeline: two writes for one key."
        } as SessionResponse["currentQuestion"]
      })
    );
    const recallQuiz = Promise.resolve([
      {
        id: "q3",
        prompt: "Explain the failure model.",
        instruction: "Which of these was the answer to this question?",
        choices: ["Answer A", "Answer B", "Answer C"],
        correctIndex: 1,
        explanation: "Identity is not enforced by one atomic write.",
        source: "Practice question 3"
      },
      {
        id: "q4",
        prompt: "Find the unsafe assumption.",
        instruction: "Which of these was the answer to this question?",
        choices: ["Answer D", "Answer E", "Answer F"],
        correctIndex: 0,
        explanation: "A separate read cannot prove the insert is safe.",
        source: "Practice question 4"
      }
    ]);

    render(
      <CoreTechnicalBlockAssessmentClient
        sessionId={SESSION_ID}
        workspaceAccent="ember"
        assessmentKind="applied-engineering"
        recallQuiz={recallQuiz}
      />
    );

    expect(await screen.findByText("Recall check")).toBeTruthy();
    expect(screen.getByText("Not scored")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Answer B/ }));
    expect(screen.getByRole("status").textContent).toContain("Right.");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("radio", { name: /Answer E/ }));
    expect(screen.getByRole("status").textContent).toContain("Not quite.");
    fireEvent.click(screen.getByRole("button", { name: "See result" }));
    expect(screen.getByText("1 of 2")).toBeTruthy();
    // The recall check never talks to the assessment.
    expect(mocks.submitAnswer).not.toHaveBeenCalled();
  });
});
