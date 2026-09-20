import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryPracticeQuestionWorkspace } from "@/features/practice/shared/ui/story-practice-question-workspace";
import { ArchitectureDesignQuestionWorkspace } from "./architecture-design-question-workspace";

const workspace = vi.fn((props: ComponentProps<typeof StoryPracticeQuestionWorkspace>) => (
  <div>
    <div data-testid="response-tool">{props.responseTool}</div>
    <output data-testid="prompt-labels">
      {props.structuredAnswerPrompts?.map(({ label }) => label).join("|")}
    </output>
  </div>
));

vi.mock("@/features/practice/shared/ui/story-practice-question-workspace", () => ({
  StoryPracticeQuestionWorkspace: (props: ComponentProps<typeof StoryPracticeQuestionWorkspace>) =>
    workspace(props)
}));

vi.mock("@/features/interviews/ui/voice/components/system-design-canvas", () => ({
  SystemDesignCanvas: ({ storageKey }: { storageKey?: string }) => (
    <div data-testid="system-design-canvas">{storageKey}</div>
  )
}));

vi.mock("./architecture-design-adapter", () => ({
  architectureDesignBlockView: (block: unknown) => block,
  architectureDesignQuestionView: (question: unknown) => question
}));

describe("ArchitectureDesignQuestionWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the quiz and canvas together on one simple response page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            result: { correct: true, correctChoiceIndex: 0, rationale: "A bounded rationale." }
          }
        })
      })
    );
    renderWorkspace(3, "artifact-diagnosis");

    expect(screen.getByTestId("system-design-canvas")).toHaveTextContent(
      "practice:block-architecture"
    );
    expect(screen.getByTestId("prompt-labels")).toHaveTextContent(
      "Outcome|Why it happens|Production consequence|How to fix"
    );
    expect(screen.getByText("Quick check")).toBeInTheDocument();
    expect(screen.getByText("Canvas task")).toBeInTheDocument();
    expect(screen.getByText("Map the design before you defend it")).toBeInTheDocument();
    expect(workspace.mock.lastCall?.[0].experience.answerReview).toBe("modal");

    const responseTool = within(screen.getByTestId("response-tool"));
    fireEvent.click(responseTool.getByRole("button", { name: /One/ }));
    fireEvent.click(responseTool.getByRole("button", { name: "Check answer" }));
    expect(await responseTool.findByText("Correct")).toBeInTheDocument();
  });

  it("uses a same-page quick check without forcing a canvas into requirements framing", () => {
    renderWorkspace(1, "written");

    expect(screen.queryByTestId("system-design-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Which response is strongest?")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-labels")).toHaveTextContent(
      "Scope|Assumptions|Estimates and SLOs|Non-goals"
    );
  });
});

function renderWorkspace(order: number, format: string) {
  render(
    <ArchitectureDesignQuestionWorkspace
      block={
        {
          id: "block-architecture",
          questions: []
        } as never
      }
      initialQuestion={
        {
          id: `question-${order}`,
          order,
          question: {
            format,
            knowledgeCheck: {
              prompt: "Which response is strongest?",
              choices: ["One", "Two", "Three", "Four"]
            }
          }
        } as never
      }
      stageTitle="Architecture and trade-offs"
    />
  );
}
