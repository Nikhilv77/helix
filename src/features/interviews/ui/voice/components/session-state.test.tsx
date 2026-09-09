import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "sophia", name: "Sophia" })
}));

import { SessionStateScreen } from "./session-state";

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
});
