import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE } from "@/features/practice/applied-engineering/ui/applied-engineering-experience";
import { CORE_TECHNICAL_ASSESSMENT_EXPERIENCE } from "@/features/practice/core-technical/ui/core-technical-assessment";
import { ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE } from "@/features/practice/architecture-design/ui/architecture-design-experience";
import type { StoryPracticeAssessmentStatus, StoryPracticeBlockView } from "./view-contracts";
import { StoryPracticeAssessment } from "./story-practice-assessment";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "maya", name: "Maya" })
}));
vi.mock("@/features/interviews/ui/shared/interview-room-navigation", () => ({
  openInterviewRoom: vi.fn()
}));

describe("story-practice assessment state parity", () => {
  afterEach(() => vi.clearAllMocks());

  it.each(["LOCKED", "READY", "IN_PROGRESS", "FINALIZING", "COMPLETED"] as const)(
    "keeps Core and Applied %s geometry and semantics aligned",
    (status) => {
      const core = render(
        <StoryPracticeAssessment
          block={block(status)}
          terminalCount={status === "LOCKED" ? 1 : 2}
          dedicatedRoom={false}
          experience={CORE_TECHNICAL_ASSESSMENT_EXPERIENCE}
        />
      );
      const coreSignature = classSignature(core.container);
      core.unmount();

      const applied = render(
        <StoryPracticeAssessment
          block={block(status)}
          terminalCount={status === "LOCKED" ? 1 : 2}
          dedicatedRoom={false}
          experience={APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE}
        />
      );

      expect(classSignature(applied.container)).toEqual(coreSignature);
      expect(
        screen.getByRole("complementary", {
          name: completedLabel(status)
        })
      ).toBeInTheDocument();
      for (const control of screen.queryAllByRole("button")) {
        expect(control.className).toMatch(/focus-visible:(ring|outline)/);
      }

      if (status === "LOCKED") {
        expect(
          screen.getByRole("heading", { name: "1 question left to unlock" })
        ).toBeInTheDocument();
      } else if (status === "READY") {
        expect(screen.getByRole("button", { name: /Start assessment/i })).toBeInTheDocument();
      } else if (status === "IN_PROGRESS") {
        expect(screen.getByRole("button", { name: /Continue assessment/i })).toBeInTheDocument();
      } else if (status === "FINALIZING") {
        expect(screen.getByRole("button", { name: /Retry report/i })).toBeInTheDocument();
      } else {
        expect(screen.getByText("Preparation complete")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Continue/i })).toBeNull();
      }
    }
  );

  it("keeps a pre-migration Architecture assessment inline and sends stamped snapshots to the room", () => {
    const legacy = render(
      <StoryPracticeAssessment
        block={block("IN_PROGRESS")}
        terminalCount={2}
        dedicatedRoom={false}
        experience={ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE}
      />
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Continue assessment/i })).toBeNull();
    legacy.unmount();

    const roomBlock = block("IN_PROGRESS");
    roomBlock.assessment!.assessment!.deliveryMode = "shared-voice-room";
    render(
      <StoryPracticeAssessment
        block={roomBlock}
        terminalCount={2}
        dedicatedRoom={false}
        experience={ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE}
      />
    );
    expect(screen.getByRole("button", { name: /Continue assessment/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

function classSignature(container: HTMLElement) {
  return Array.from(container.querySelectorAll("*")).map(
    (element) => `${element.tagName.toLowerCase()}:${element.getAttribute("class") ?? ""}`
  );
}

function completedLabel(status: StoryPracticeAssessmentStatus) {
  return status === "COMPLETED" ? "Applied Engineering report" : "Applied Engineering assessment";
}

function block(status: StoryPracticeAssessmentStatus): StoryPracticeBlockView {
  const completed = status === "COMPLETED";
  return {
    id: "block-one",
    ordinal: 1,
    isCurrent: true,
    status: completed ? "ASSESSED" : status === "LOCKED" ? "PRACTISING" : "ASSESSMENT_READY",
    story: {
      key: "retry-incident",
      title: "Retry storm under partial failure",
      premise: "A retry path duplicates production work.",
      incident: "Timeouts coincide with duplicate side effects.",
      candidateRole: "You own the production repair.",
      primaryTopicKey: "idempotency",
      secondaryTopicKeys: ["retries"],
      mechanismKeys: ["transaction-boundary"],
      difficulty: "standard",
      expectedMinutes: 40,
      stages: [
        { order: 1, title: "Read the evidence" },
        { order: 2, title: "Isolate the cause" }
      ]
    },
    selection: { difficulty: "standard", reason: "This incident matches the saved evidence." },
    questions: [question(1), question(2)],
    assessment: {
      id: "assessment-one",
      status,
      assessment: status === "LOCKED" ? null : snapshot(status === "FINALIZING"),
      report: completed ? report() : null,
      transcript: null
    }
  };
}

function question(order: number) {
  return {
    id: `question-${order}`,
    blockId: "block-one",
    order,
    status: "COMPLETED" as const,
    question: {
      format: "written" as const,
      prompt: `Question ${order}`,
      topicKeys: ["retries"],
      artifact: { kind: "scenario" as const, title: "Incident", content: "Evidence" },
      hintCount: 3 as const
    },
    draft: null,
    revealedHints: [],
    authorizedAnswer: null,
    latestAttempt: null,
    latestRun: null
  };
}

function snapshot(withSubmission: boolean) {
  const prompts = Array.from({ length: 5 }, (_, index) => ({
    id: `prompt-${index + 1}`,
    order: index + 1,
    kind: "evidence-defence",
    prompt: `Prompt ${index + 1}`,
    context: "Frozen production evidence"
  }));
  return {
    prompts,
    submission: withSubmission
      ? {
          requestId: "11111111-1111-4111-8111-111111111111",
          responses: prompts.map((prompt) => ({ promptId: prompt.id, answer: "Saved answer" })),
          submittedAt: "2026-09-11T12:00:00.000Z"
        }
      : null
  };
}

function report() {
  return {
    scores: {
      technicalAccuracy: 80,
      mechanismReasoning: 80,
      diagnosisEvidence: 80,
      debuggingImplementation: 80,
      communicationProduction: 80
    },
    overallScore: 80,
    teacherSummary: "Strong evidence-led production reasoning.",
    strengths: ["Diagnosis"],
    improvementAreas: ["Rollback thresholds"],
    promptFeedback: [],
    solvedVsLearned: {
      completedCount: 2,
      learnedCount: 0,
      masteryCreditNote: "Both questions received solved mastery credit."
    },
    deterministicEvidence: {
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 1,
      implementationScoreCapped: false
    },
    continuation: {
      kind: "complete" as const,
      summary: "Every currently eligible item is complete."
    }
  };
}
