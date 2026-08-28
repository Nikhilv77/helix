import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));
vi.mock("./help-call", () => ({ HelpCall: () => <div>Voice controls</div> }));
vi.mock("./help-code-panel", () => ({
  HelpCodePanel: ({ language }: { language: string }) => <div>Code panel {language}</div>
}));
vi.mock("./help-test-results", () => ({ HelpTestResults: () => <div>Test results</div> }));
vi.mock("./shared-help-board", () => ({ SharedHelpBoard: () => <div>Shared board</div> }));
vi.mock("./safety-controls", () => ({ SafetyControls: () => null }));
vi.mock("./help-rating", () => ({ HelpRating: () => null }));

import { HelpRoom } from "./help-room";

const requestId = "00000000-0000-4000-8000-000000000001";

function response(data: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ success: true, data })
  } as unknown as Response;
}

describe("HelpRoom", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("names the peer and keeps the captured language fixed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        requestId,
        seat: "learner",
        peer: { label: "Asha Verma", headline: null, profileImage: null },
        slug: "two-sum",
        title: "Two Sum",
        questionPrompt: "Find two values.",
        language: "javascript",
        collaborationState: null,
        capturedWorkspace: {
          code: "return [];",
          language: "javascript",
          testOutput: null,
          failingTests: null,
          selection: null,
          runStatus: null,
          tests: null
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<HelpRoom requestId={requestId} returnTo="/practice" />);

    expect(await screen.findByText("Two Sum with Asha Verma")).toBeTruthy();
    expect(screen.getByText("Code panel javascript")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Language" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
