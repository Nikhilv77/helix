import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  StoryPracticeBlockView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import { appliedEngineeringLab } from "../domain/applied-engineering-lab";
import { aiMlQuickCheckPath } from "../domain/ai-ml-quick-check-catalog";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: navigation.refresh }) }));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="teacher-stage" />
}));

import { AiMlStoryWorkspace } from "./ai-ml-story-workspace";
import { AiMlStoryOverview } from "./ai-ml-story-overview";

const questionId = "00000000-0000-4000-8000-000000000001";
const feedback = {
  schemaVersion: 1 as const,
  score: 8,
  result: "You identified the main failure boundary.",
  didWell: "You identified leakage.",
  mechanism: "Future information entered the evaluation set.",
  missingOrIncorrect: "The split also needs to be customer-disjoint.",
  productionConsequence: "The offline score will overstate production performance.",
  transferExample: "Apply an as-of-time check to a fraud model too.",
  interviewerFollowUp: "How would you check other features?",
  missedEdgeCases: []
};

function question(format: "mcq" | "artifact-diagnosis"): StoryPracticeQuestionView {
  return {
    id: questionId,
    blockId: "foundations",
    order: 1,
    status: "ACTIVE",
    question: {
      format,
      prompt: "Which evidence reveals leakage?",
      topicKeys: ["evaluation"],
      artifact: {
        kind: "config",
        title: "Validation setup",
        content: "split: random rows\nfeature: cancellation_requested_at"
      },
      choices: format === "mcq" ? ["The future timestamp", "The metric name"] : [],
      hintCount: 3,
      interviewConnection: "Use serving-time evidence."
    },
    draft: null,
    revealedHints: [],
    authorizedAnswer: null,
    latestAttempt: null,
    latestRun: null
  };
}

function block(current: StoryPracticeQuestionView): StoryPracticeBlockView {
  return {
    id: "foundations",
    ordinal: 1,
    isCurrent: true,
    status: "PRACTISING",
    story: {
      key: "foundations",
      title: "Build the reasoning beneath the model",
      premise: "Read the evidence.",
      incident: "A model fails after release.",
      candidateRole: "AI/ML engineer",
      primaryTopicKey: "evaluation",
      secondaryTopicKeys: [],
      mechanismKeys: [],
      difficulty: "guided",
      expectedMinutes: 30,
      stages: [{ order: 1, title: "Find the leakage" }]
    },
    selection: { difficulty: "guided", reason: "Practice evidence-based reasoning." },
    questions: [current],
    assessment: null
  };
}

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

describe("AI/ML shared question workspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigation.refresh.mockReset();
    window.sessionStorage.clear();
  });

  it("shows the same split reference and answer controls for a written evidence question", () => {
    const current = question("artifact-diagnosis");
    render(<AiMlStoryWorkspace track="core-technical" block={block(current)} question={current} />);

    expect(
      screen.getByRole("tablist", { name: "AI/ML Core Technical question reference" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Diagnose the evidence" })).toBeInTheDocument();
    expect(screen.getByText("Validation setup")).toBeInTheDocument();
    expect(screen.getByLabelText("Written answer")).toBeEnabled();
    expect(screen.getByRole("button", { name: "+ Next check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn instead" })).toBeInTheDocument();
    expect(screen.getByText("Use serving-time evidence.")).toBeInTheDocument();
    expect(screen.queryByText("Practice evidence-based reasoning.")).toBeNull();
  });

  it("explains why an old unsubmitted choice no longer fills a revised case", () => {
    const current = question("artifact-diagnosis");
    current.question.revisionNote =
      "This case was updated. Your unsubmitted choice is preserved in the earlier version.";
    render(<AiMlStoryWorkspace track="core-technical" block={block(current)} question={current} />);

    expect(screen.getByRole("note")).toHaveTextContent("unsubmitted choice is preserved");
    expect(screen.getByLabelText("Written answer")).toHaveValue("");
  });

  it("renders a Python model artifact in the same read-only code viewer", () => {
    const current = question("artifact-diagnosis");
    current.question.artifact = aiMlQuickCheckPath("core-technical").questions[6]!.artifact;
    render(<AiMlStoryWorkspace track="core-technical" block={block(current)} question={current} />);

    expect(screen.getByText("model_score.py")).toBeInTheDocument();
    expect(screen.getByLabelText(/model_score.py code artifact, read only/i)).toBeInTheDocument();
  });

  it("submits a written answer to AI/ML evaluation and opens the shared feedback modal", async () => {
    const current = question("artifact-diagnosis");
    const answer =
      "The cancellation timestamp is from the future and the same customer appears on both sides of the split.";
    const completed: StoryPracticeQuestionView = {
      ...current,
      status: "COMPLETED",
      authorizedAnswer: {
        concise: "Remove future-derived fields and use an as-of-time, customer-disjoint split.",
        explanation: "The feature and random row split both leak information."
      },
      latestAttempt: {
        id: "attempt-1",
        work: { kind: "text", text: answer },
        feedback,
        verificationStatus: "VERIFIED",
        score: 8,
        createdAt: new Date().toISOString()
      }
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith("/draft")) return response({ question: current });
      if (path.endsWith("/attempt"))
        return response({ question: completed, attempt: completed.latestAttempt });
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<AiMlStoryWorkspace track="core-technical" block={block(current)} question={current} />);

    fireEvent.change(screen.getByLabelText("Written answer"), { target: { value: answer } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByRole("dialog", { name: "Strong answer · 8/10" })).toBeInTheDocument();
    expect(
      screen.getByText("The offline score will overstate production performance.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice/ai-ml/attempt",
      expect.objectContaining({ method: "POST" })
    );
    // The workspace applies the returned question locally; a full server
    // re-render after every answer is deliberately avoided.
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("uses the choice response control for an MCQ", () => {
    const current = question("mcq");
    render(<AiMlStoryWorkspace track="core-technical" block={block(current)} question={current} />);
    expect(
      screen.getByRole("heading", { name: "Choose the strongest explanation" })
    ).toBeInTheDocument();
    expect(screen.getByText("The future timestamp")).toBeInTheDocument();
    expect(screen.queryByLabelText("Written answer")).toBeNull();
  });

  it("shows expandable progress for every path without the practice-path eyebrow", () => {
    const first = block(question("mcq"));
    const second = {
      ...first,
      isCurrent: false,
      id: "retrieval-evidence",
      ordinal: 2,
      story: {
        ...first.story,
        key: "retrieval-evidence",
        title: "Trace a retrieval answer back to its source"
      }
    };
    const third = {
      ...first,
      isCurrent: false,
      id: "model-reliability",
      ordinal: 3,
      story: { ...first.story, key: "model-reliability", title: "Keep the model reliable" }
    };
    const fourth = {
      ...first,
      isCurrent: false,
      id: "quick-check",
      ordinal: 4,
      story: { ...first.story, key: "quick-check", title: "Quick AI/ML checks" }
    };
    render(
      <AiMlStoryOverview
        session={{
          discipline: "ai-ml",
          track: "core-technical",
          blocks: [first, second, third, fourth],
          totalQuestions: 4,
          terminalQuestions: 0,
          recommendation: null
        }}
        selected={first}
      />
    );

    expect(screen.getByTestId("teacher-stage")).toBeInTheDocument();
    expect(screen.getAllByText("0 progressed")).toHaveLength(4);
    expect(screen.queryByText(/Practice path 1 · guided/i)).toBeNull();
    const secondPath = screen
      .getByText("Trace a retrieval answer back to its source")
      .closest("details");
    expect(secondPath).not.toHaveAttribute("open");
    fireEvent.click(secondPath!.querySelector("summary")!);
    expect(secondPath).toHaveAttribute("open");
    expect(screen.getAllByRole("link", { name: /Find the leakage/i })[0]).toHaveAttribute(
      "href",
      `/practice/ai-ml/core-technical/questions/${questionId}?block=foundations`
    );
  });
  it("saves a partial configuration draft, restores it, and submits structured values through the shared flow", async () => {
    const authored = appliedEngineeringLab.questions[2]!;
    const current = question("artifact-diagnosis");
    current.question.interaction = authored.interaction;
    current.question.artifact = authored.artifact;
    const work = {
      kind: "interactive" as const,
      response: {
        type: "configuration" as const,
        values: { threshold: 0.4, reviews: 150, recall: 90, precision: 60 }
      }
    };
    const completed = {
      ...current,
      status: "COMPLETED",
      latestAttempt: {
        id: "attempt-lab",
        work,
        feedback: { ...feedback, score: 10 },
        verificationStatus: "VERIFIED",
        score: 10,
        createdAt: new Date().toISOString()
      }
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/attempt")
          ? response({ question: completed, attempt: completed.latestAttempt })
          : response({ question: current })
      );
    const view = render(
      <AiMlStoryWorkspace track="applied-engineering" block={block(current)} question={current} />
    );
    expect(screen.queryByLabelText("Written answer")).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: authored.artifact.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Set every configuration value");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Decision threshold/ }), {
      target: { value: "0.4" }
    });
    // Drafts save one second after the last change.
    await waitFor(
      () => expect(fetchMock).toHaveBeenCalledWith("/api/practice/ai-ml/draft", expect.anything()),
      { timeout: 3_000 }
    );
    const draftCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/draft"))!;
    expect(JSON.parse(draftCall[1]!.body as string).draft).toEqual({
      kind: "interactive",
      response: { type: "configuration", values: { threshold: 0.4 } }
    });
    view.unmount();
    current.draft = {
      kind: "interactive",
      response: { type: "configuration", values: { threshold: 0.4 } }
    };
    render(
      <AiMlStoryWorkspace track="applied-engineering" block={block(current)} question={current} />
    );
    expect(screen.getByRole("spinbutton", { name: /Decision threshold/ })).toHaveValue(0.4);
    for (const [name, value] of [
      [/Daily reviews/, "150"],
      [/Fraud recall/, "90"],
      [/Review precision/, "60"]
    ] as const) {
      fireEvent.change(screen.getByRole("spinbutton", { name }), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/practice/ai-ml/attempt", expect.anything())
    );
    const attemptCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/attempt"))!;
    expect(JSON.parse(attemptCall[1]!.body as string).work).toEqual(work);
    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: /Decision threshold/ })).toBeDisabled()
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("10/10");
  });
});
