import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoryPracticeBlockView } from "@/features/practice/shared/ui/view-contracts";
import type { AiMlStorySession } from "../server/ai-ml-story-practice.service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({ MayaStage: () => null }));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "daniel", name: "Daniel", portrait: "/daniel.jpg" })
}));
vi.mock("@/lib/theme/theme-context", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
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

import { AiMlStoryOverview } from "./ai-ml-story-overview";

function block(
  key: string,
  ordinal: number,
  isCurrent: boolean,
  done: number
): StoryPracticeBlockView {
  return {
    id: key,
    ordinal,
    isCurrent,
    status: "PRACTISING",
    story: {
      key,
      title: `Path ${ordinal}`,
      premise: "Premise.",
      incident: "Explain the evidence.",
      candidateRole: "Frontend engineer",
      primaryTopicKey: key,
      secondaryTopicKeys: [],
      mechanismKeys: [],
      difficulty: "guided",
      expectedMinutes: 40,
      stages: [1, 2, 3, 4, 5].map((order) => ({ order, title: `Stage ${order}` }))
    },
    selection: { difficulty: "guided", reason: "Chosen for you." },
    questions: [1, 2, 3, 4, 5].map((order) => ({
      id: `${key}-q${order}`,
      blockId: key,
      order,
      status: order <= done ? "COMPLETED" : "ACTIVE",
      question: {
        format: "written",
        prompt: `Question ${order}`,
        topicKeys: [],
        artifact: { kind: "scenario", title: "Evidence", content: "Evidence text." },
        hintCount: 3
      },
      draft: null,
      revealedHints: [],
      authorizedAnswer: null,
      latestAttempt: null,
      latestRun: null
    })),
    assessment: null
  } as unknown as StoryPracticeBlockView;
}

describe("AiMlStoryOverview", () => {
  it("uses the shared practice overview with history, stepper, and the assessment card", () => {
    const current = block("browser-runtime", 1, true, 1);
    const session: AiMlStorySession = {
      discipline: "frontend",
      track: "core-technical",
      blocks: [current, block("css-and-layout", 2, false, 0)],
      totalQuestions: 10,
      terminalQuestions: 1,
      recommendation: null
    };

    const view = render(
      <AiMlStoryOverview
        session={session}
        selected={current}
        assessment={{ status: "LOCKED", remaining: 4, total: 5, allowEarlyStart: false }}
      />
    );

    expect(screen.getByText("Path 1 of 2 · Current")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/practice/frontend/core-technical?block=css-and-layout"
    );
    expect(screen.getByRole("heading", { name: "Your 5-question path" })).toBeInTheDocument();
    expect(
      view.container.querySelectorAll('[data-story-practice-progress="terminal"]')
    ).toHaveLength(1);
    expect(
      screen.getByRole("complementary", { name: "Core Technical assessment" })
    ).toBeInTheDocument();
    expect(screen.getByText(/4 questions until your/)).toBeInTheDocument();
  });

  it("labels an unopened path by its progress, not as completed", () => {
    const other = block("css-and-layout", 2, false, 0);
    const session: AiMlStorySession = {
      discipline: "frontend",
      track: "core-technical",
      blocks: [block("browser-runtime", 1, true, 1), other],
      totalQuestions: 10,
      terminalQuestions: 1,
      recommendation: null
    };

    render(<AiMlStoryOverview session={session} selected={other} assessment={null} />);

    expect(screen.getByText("Path 2 of 2 · Not started")).toBeInTheDocument();
    // No story assessment summary means no card at all, never the Node.js card.
    expect(screen.queryByRole("complementary", { name: /assessment/ })).toBeNull();
  });

  it("explains that a personal path has no assessment and links to the core paths", () => {
    const personal = block("resume-project", 1, true, 0);
    const session: AiMlStorySession = {
      discipline: "ai-ml",
      track: "core-technical",
      blocks: [personal, block("foundations", 2, false, 0)],
      totalQuestions: 10,
      terminalQuestions: 0,
      recommendation: null
    };

    render(<AiMlStoryOverview session={session} selected={personal} assessment={null} />);

    expect(
      screen.getByText("This personal path has no assessment. The core paths each end with one.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to the core paths/ })).toHaveAttribute(
      "href",
      "/practice/ai-ml/core-technical?block=foundations"
    );
  });
});
