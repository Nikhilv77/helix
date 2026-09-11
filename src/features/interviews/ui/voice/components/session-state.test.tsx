import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "sophia", name: "Sophia" })
}));

import { SessionLoadingScreen, SessionStateScreen } from "./session-state";

describe("SessionLoadingScreen", () => {
  afterEach(cleanup);

  it("keeps the preparing state minimal", () => {
    render(<SessionLoadingScreen error={null} onRetry={vi.fn()} workspaceAccent="ember" />);

    expect(screen.getByRole("heading", { name: "Preparing your interview" })).toBeVisible();
    expect(screen.getByText("Sophia will join shortly.")).toBeVisible();
    expect(screen.queryByText("Trailgrad")).toBeNull();
    expect(screen.queryByText("Interview studio")).toBeNull();
    expect(screen.queryByText("Secure interview room")).toBeNull();
    expect(screen.queryByText(/checking your session/i)).toBeNull();
  });
});

describe("SessionStateScreen block assessment completion", () => {
  afterEach(cleanup);

  it("links the primary action to immutable block results and the secondary action to current DSA", () => {
    const blockId = "11111111-1111-4111-8111-111111111111";
    render(
      <SessionStateScreen
        kind="complete"
        workspaceAccent="ember"
        blockAssessmentBlockId={blockId}
      />
    );

    expect(screen.getByRole("link", { name: /view block results/i })).toHaveAttribute(
      "href",
      `/practice/dsa?block=${blockId}`
    );
    expect(screen.getByRole("link", { name: /return to current dsa practice/i })).toHaveAttribute(
      "href",
      "/practice/dsa"
    );
    expect(screen.queryByRole("link", { name: /^view report$/i })).toBeNull();
  });

  it("returns a completed Core Technical voice assessment to its block report", () => {
    const blockId = "22222222-2222-4222-8222-222222222222";
    render(
      <SessionStateScreen kind="complete" workspaceAccent="ember" coreTechnicalBlockId={blockId} />
    );

    expect(screen.getByRole("link", { name: /view block results/i })).toHaveAttribute(
      "href",
      `/practice/core-technical?block=${blockId}`
    );
    expect(
      screen.getByRole("link", { name: /return to current core technical practice/i })
    ).toHaveAttribute("href", "/practice/core-technical");
  });

  it("returns a completed Applied Engineering voice assessment to its incident report", () => {
    const blockId = "33333333-3333-4333-8333-333333333333";
    render(
      <SessionStateScreen
        kind="complete"
        workspaceAccent="ember"
        storyPracticeAssessment={{
          blockId,
          routeBase: "/practice/applied-engineering",
          label: "Applied Engineering"
        }}
      />
    );

    expect(screen.getByRole("link", { name: /view block results/i })).toHaveAttribute(
      "href",
      `/practice/applied-engineering?block=${blockId}`
    );
    expect(
      screen.getByRole("link", { name: /return to current applied engineering practice/i })
    ).toHaveAttribute("href", "/practice/applied-engineering");
  });
});
