import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE } from "@/features/practice/applied-engineering/ui/applied-engineering-experience";
import { CORE_TECHNICAL_OVERVIEW_EXPERIENCE } from "@/features/practice/core-technical/ui/core-technical-overview";
import type { StoryPracticeBlockView } from "./view-contracts";
import { StoryPracticeOverview } from "./story-practice-overview";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="teacher" />
}));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "maya", name: "Maya" })
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  voiceUrl: () => "data:audio/mpeg;base64,",
  useMayaVoice: () => ({
    state: "idle",
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    awaitingGesture: true,
    setAwaitingGesture: vi.fn()
  })
}));

describe("story-practice overview parity", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders equivalent Core and Applied states with identical structural geometry", () => {
    const core = render(
      <StoryPracticeOverview
        block={block()}
        history={null}
        experience={CORE_TECHNICAL_OVERVIEW_EXPERIENCE}
      />
    );
    const coreSignature = classSignature(core.container);
    core.unmount();

    const applied = render(
      <StoryPracticeOverview
        block={block()}
        history={null}
        experience={APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE}
      />
    );

    expect(classSignature(applied.container)).toEqual(coreSignature);
    expect(screen.getByRole("progressbar", { name: /Applied Engineering questions/i })).toHaveAttribute(
      "aria-valuenow",
      "1"
    );
    expect(screen.getByRole("navigation", { name: /Jump to an Applied Engineering question/i })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Applied Engineering assessment" })
    ).toBeInTheDocument();

    const teacherStage = screen.getByTestId("teacher").parentElement;
    expect(teacherStage?.className).toContain("h-[17rem]");
    expect(teacherStage?.className).toContain("md:absolute");
    expect(teacherStage?.className).not.toContain("hidden");
    expect(screen.getByRole("link", { name: /Continue.*Question 2/i }).className).toContain(
      "focus-visible:ring-2"
    );
    expect(applied.container.querySelector("aside")?.className).toContain("xl:sticky");
  });
});

function classSignature(container: HTMLElement) {
  return Array.from(container.querySelectorAll("*")).map(
    (element) => `${element.tagName.toLowerCase()}:${element.getAttribute("class") ?? ""}`
  );
}

function block(): StoryPracticeBlockView {
  return {
    id: "block-one",
    ordinal: 1,
    isCurrent: true,
    status: "PRACTISING",
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
    selection: {
      difficulty: "standard",
      reason: "This incident matches the saved evidence."
    },
    questions: [question(1, "COMPLETED"), question(2, "ACTIVE")],
    assessment: {
      id: "assessment-one",
      status: "LOCKED",
      assessment: null,
      report: null,
      transcript: null
    }
  };
}

function question(order: number, status: "ACTIVE" | "COMPLETED") {
  return {
    id: `question-${order}`,
    blockId: "block-one",
    order,
    status,
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
