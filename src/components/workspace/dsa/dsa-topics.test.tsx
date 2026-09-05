import { DsaPracticeBlockStatus } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { DsaBlockHistoryView } from "@/server/dsa/dsa-block-history.service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { DsaTopics } from "./dsa-topics";

const SELECTED = "22222222-2222-4222-8222-222222222222";
const PREVIOUS = "11111111-1111-4111-8111-111111111111";
const NEXT = "33333333-3333-4333-8333-333333333333";

const question = {
  slug: "saved-two-sum",
  title: "Saved Two Sum",
  difficulty: "easy" as const,
  primaryPattern: "arrays-hashing",
  expectedTimeMinutes: 10,
  phaseSlug: "arrays",
  phaseNumber: 1,
  recommendedOrder: 1
};

const plan: FrontendDsaPlan = {
  chapters: [
    {
      id: "arrays-hashing",
      title: "Arrays & Hashing",
      whyItMatters: "Useful",
      questions: [question],
      counts: { easy: 1, medium: 0, hard: 0 },
      minutes: 10
    }
  ],
  totalQuestions: 1,
  totalMinutes: 10,
  counts: { easy: 1, medium: 0, hard: 0 },
  firstQuestionSlug: question.slug
};

function history(): DsaBlockHistoryView {
  return {
    selected: {
      id: SELECTED,
      ordinal: 2,
      current: false,
      status: DsaPracticeBlockStatus.ASSESSED,
      flags: {
        practising: false,
        assessmentReady: false,
        assessmentInProgress: false,
        assessed: true
      },
      dates: {
        createdAt: "2026-09-01T00:00:00.000Z",
        assessmentReadyAt: "2026-09-02T00:00:00.000Z",
        assessmentStartedAt: "2026-09-02T00:01:00.000Z",
        assessedAt: "2026-09-02T00:10:00.000Z"
      },
      recommendation: {
        tier: "building",
        source: "performance",
        targetLabel: "Frontend",
        focusChapterId: "arrays-hashing",
        focusLabel: "Saved historical focus",
        strengthLabel: null,
        blockTitle: "Historical",
        rationale: "Saved",
        questions: [{ ...question, status: "COMPLETED" }],
        minutes: 10,
        mix: { easy: 1, medium: 0, hard: 0 },
        estimatedPathQuestions: 20,
        availableQuestions: 200,
        legacy: false
      },
      completedQuestions: 1,
      totalQuestions: 1,
      assessment: { sessionId: null, report: null, prompts: [] },
      transcript: [
        { speaker: "agent", text: "Explain the trade-off.", startMs: 61_000, endMs: 63_000 },
        { speaker: "user", text: "A map gives constant lookup.", startMs: 64_000, endMs: 66_000 }
      ]
    },
    previousBlockId: PREVIOUS,
    nextBlockId: NEXT,
    totalBlocks: 3
  };
}

describe("DsaTopics block viewer", () => {
  afterEach(cleanup);

  it("builds previous and next URLs that reset the panel to overview", () => {
    render(<DsaTopics plan={plan} blockHistory={history()} panel="overview" />);
    expect(screen.getByRole("link", { name: /^previous$/i })).toHaveAttribute(
      "href",
      `/practice/dsa?block=${PREVIOUS}&panel=overview`
    );
    expect(screen.getByRole("link", { name: /^next$/i })).toHaveAttribute(
      "href",
      `/practice/dsa?block=${NEXT}&panel=overview`
    );
    expect(
      screen.getByText("Saved historical focus, selected for your current level.")
    ).toBeInTheDocument();
  });

  it("renders the sanitized transcript in the same block area with an overview return", () => {
    render(<DsaTopics plan={plan} blockHistory={history()} panel="transcript" />);
    expect(
      screen.getByRole("heading", { name: "Block 2 assessment transcript" })
    ).toBeInTheDocument();
    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("1:01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to overview/i })).toHaveAttribute(
      "href",
      `/practice/dsa?block=${SELECTED}&panel=overview`
    );
  });
});
