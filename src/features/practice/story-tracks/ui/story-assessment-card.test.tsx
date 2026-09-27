import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryPracticeBlockView } from "@/features/practice/shared/ui/view-contracts";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "daniel", name: "Daniel", portrait: "/daniel.jpg" })
}));
vi.mock("@/lib/theme/theme-context", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

import { StoryAssessmentCard } from "./story-assessment-card";

const block = {
  id: "browser-runtime",
  ordinal: 1,
  isCurrent: true,
  status: "PRACTISING",
  story: { title: "Reason about the browser runtime", stages: [] },
  selection: { difficulty: "guided", reason: "" },
  questions: [1, 2, 3, 4, 5].map((order) => ({ id: `q${order}`, order, status: "COMPLETED" })),
  assessment: null
} as unknown as StoryPracticeBlockView;

describe("StoryAssessmentCard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the shared assessment card while the path is unfinished", () => {
    render(
      <StoryAssessmentCard
        summary={{ status: "LOCKED", remaining: 4, total: 5, allowEarlyStart: false }}
        block={block}
        label="Core Technical"
        track="core-technical"
        routeBase="/practice/frontend/core-technical"
      />
    );

    expect(
      screen.getByRole("complementary", { name: "Core Technical assessment" })
    ).toBeInTheDocument();
    expect(screen.getByText(/4 questions until your/)).toBeInTheDocument();
    expect(screen.getByText("Interviewer follow-ups")).toBeInTheDocument();
  });

  it("starts the assessment and opens its room", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { sessionId: "11111111-1111-4111-8111-111111111111" }
        }),
        { status: 200 }
      )
    );
    render(
      <StoryAssessmentCard
        summary={{ status: "READY" }}
        block={block}
        label="Core Technical"
        track="core-technical"
        routeBase="/practice/frontend/core-technical"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Start assessment/ }));

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/practice/frontend/core-technical/assessment?session=11111111-1111-4111-8111-111111111111"
      )
    );
  });

  it("shows the graded results in the shared scorecard", () => {
    render(
      <StoryAssessmentCard
        summary={{
          status: "COMPLETED",
          assessmentId: "11111111-1111-4111-8111-111111111111",
          report: {
            overallScore: 78,
            gradedAt: "2026-09-27T00:00:00.000Z",
            prompts: [
              {
                promptId: "revisit",
                label: "Revisit",
                score: 90,
                result: "Right.",
                didWell: "Order.",
                missingOrIncorrect: "",
                mechanism: ""
              },
              {
                promptId: "follow-up-1",
                label: "Follow-up",
                score: 70,
                result: "Close.",
                didWell: "Cause.",
                missingOrIncorrect: "Verify it.",
                mechanism: ""
              },
              {
                promptId: "follow-up-2",
                label: "Follow-up",
                score: 80,
                result: "Good.",
                didWell: "Fix.",
                missingOrIncorrect: "",
                mechanism: ""
              },
              {
                promptId: "mistake",
                label: "Spot the trap",
                score: 72,
                result: "Mostly.",
                didWell: "Trap.",
                missingOrIncorrect: "Consequence.",
                mechanism: ""
              }
            ]
          }
        }}
        block={block}
        label="Core Technical"
        track="core-technical"
        routeBase="/practice/frontend/core-technical"
      />
    );

    expect(screen.getByText("Reason about the browser runtime results")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.getByText("Follow-up 2")).toBeInTheDocument();
    // Like Core Technical, the per-question feedback lives in the scorecard.
    expect(screen.queryByRole("button", { name: /Review answers/ })).toBeNull();
  });
});
