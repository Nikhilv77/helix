import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CoreTechnicalHistoryNavigation } from "@/features/practice/core-technical/domain/ui-state";
import type { CoreTechnicalStoryLibraryEntry } from "@/features/practice/core-technical/server/eligibility.service";
import type { CoreTechnicalHistoryList } from "@/features/practice/core-technical/server/history.service";
import type { CoreTechnicalPublicBlock } from "@/features/practice/core-technical/server/practice.service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() })
}));

import { CoreTechnicalOverview } from "./core-technical-overview";

describe("CoreTechnicalOverview", () => {
  it("renders the saved public focus, selected story, progress, and terminal distinctions", () => {
    const view = render(<CoreTechnicalOverview block={block(true)} history={history(true)} />);

    expect(screen.getByRole("heading", { name: "Follow the operation" })).toBeInTheDocument();
    expect(screen.getByText(/matches your saved Node\.js evidence/i)).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Learned")).toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getAllByText("Guided").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 min").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("progressbar", { name: /questions completed or learned/i })
    ).toHaveAttribute("aria-valuenow", "2");
    expect(view.container.querySelectorAll('[data-core-progress="terminal"]')).toHaveLength(2);
    expect(view.container.querySelectorAll('[data-core-progress="pending"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Continue.*Question 3/i })).toHaveAttribute(
      "href",
      "/practice/core-technical/questions/question-3?block=block-one"
    );
  });

  it("keeps history selection in the URL and makes historical stories read-only", () => {
    render(<CoreTechnicalOverview block={block(false)} history={history(false)} />);

    expect(screen.getByText("Story 1 of 3 · Completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/practice/core-technical?block=block-two"
    );
    expect(screen.queryByRole("link", { name: /Continue · Question/i })).toBeNull();
  });

  it("lists every published story downward without nesting question rows", () => {
    render(
      <CoreTechnicalOverview
        block={block(true)}
        history={history(true)}
        storyLibrary={storyLibrary()}
        storyHistory={storyHistory()}
      />
    );

    const library = screen.getByRole("region", { name: "Explore all Core Technical" });
    expect(within(library).getByText("Follow the operation")).toBeInTheDocument();
    expect(within(library).getByText("The operation fails halfway")).toBeInTheDocument();
    expect(within(library).getByText("2 progressed")).toBeInTheDocument();
    expect(within(library).getByText("25%")).toBeInTheDocument();
    expect(within(library).getByText("Not started")).toBeInTheDocument();
    expect(within(library).getAllByRole("link")).toHaveLength(1);
    expect(within(library).queryByRole("list")).toBeNull();
  });
});

function block(isCurrent: boolean): CoreTechnicalPublicBlock {
  const questions = [
    question(1, "COMPLETED", "mcq"),
    question(2, "LEARNED", "written"),
    question(3, "ACTIVE", "debug-repair")
  ];
  return {
    id: "block-one",
    ordinal: 1,
    isCurrent,
    status: "PRACTISING",
    preparedAt: "2026-09-07T10:00:00.000Z",
    assessmentReadyAt: null,
    assessedAt: null,
    contentFingerprint: `sha256:${"a".repeat(64)}`,
    story: {
      title: "Follow the operation",
      premise: "Trace a production incident through asynchronous runtime boundaries.",
      incident: "Requests stall while callbacks and resources cross several boundaries.",
      candidateRole: "You own the reliability of this Node.js service.",
      expectedMinutes: 45,
      mechanismKeys: ["event-loop"],
      stages: questions.map((item) => ({ order: item.order, title: `Stage ${item.order}` }))
    },
    selection: {
      difficulty: "guided",
      reason: "This story matches your saved Node.js evidence and target role."
    },
    focus: {
      role: "backend",
      seniority: "mid",
      targetJob: "Platform Engineer",
      targetCompany: null,
      targetDate: null,
      stack: {
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        framework: "express"
      },
      excludedTopicKeys: ["nodejs-work-isolation"],
      baselineState: "STANDARD"
    },
    questions,
    remainingQuestionCount: 1,
    assessment: { id: "assessment-one", status: "LOCKED", report: null }
  } as unknown as CoreTechnicalPublicBlock;
}

function question(order: number, status: string, format: string) {
  return {
    id: `question-${order}`,
    order,
    status,
    latestAttempt: status === "COMPLETED" ? { id: `attempt-${order}` } : null,
    question: { format, artifact: { kind: format === "debug-repair" ? "code" : "trace" } }
  };
}

function history(isCurrent: boolean): CoreTechnicalHistoryNavigation {
  return {
    selected: {
      id: "block-one",
      ordinal: 1,
      isCurrent,
      status: "PRACTISING"
    } as CoreTechnicalHistoryNavigation["selected"],
    previousBlockId: null,
    nextBlockId: "block-two",
    totalBlocks: 3
  };
}

function storyLibrary(): CoreTechnicalStoryLibraryEntry[] {
  return [
    {
      key: "follow-the-operation",
      version: 1,
      title: "Follow the operation",
      difficulties: ["guided", "standard", "stretch"],
      topicKeys: ["async-scheduling", "errors-and-cancellation"],
      mechanismKeys: ["event-loop"]
    },
    {
      key: "the-operation-fails-halfway",
      version: 1,
      title: "The operation fails halfway",
      difficulties: ["guided", "standard", "stretch"],
      topicKeys: ["nodejs-streams-and-io", "nodejs-event-loop-health"],
      mechanismKeys: ["backpressure"]
    }
  ];
}

function storyHistory(): CoreTechnicalHistoryList {
  return [
    {
      id: "block-one",
      ordinal: 1,
      isCurrent: true,
      status: "PRACTISING",
      story: {
        key: "follow-the-operation",
        title: "Follow the operation",
        primaryTopicKey: "async-scheduling",
        secondaryTopicKeys: ["errors-and-cancellation"],
        difficulty: "guided",
        stages: Array.from({ length: 8 }, (_, index) => ({ order: index + 1 }))
      },
      completedQuestionCount: 1,
      learnedQuestionCount: 1,
      assessment: { id: "assessment-one", status: "LOCKED", overallScore: null },
      preparedAt: "2026-09-07T10:00:00.000Z",
      assessedAt: null
    }
  ] as unknown as CoreTechnicalHistoryList;
}
