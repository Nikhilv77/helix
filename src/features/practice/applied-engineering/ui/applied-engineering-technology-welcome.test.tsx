import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  setAwaitingGesture: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh })
}));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="teacher" />
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: mocks.speak,
    stop: mocks.stop,
    awaitingGesture: true,
    setAwaitingGesture: mocks.setAwaitingGesture
  })
}));

import { AppliedEngineeringTechnologyWelcome } from "./applied-engineering-technology-welcome";

describe("AppliedEngineeringTechnologyWelcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("starts the only reviewed stack without asking the learner to choose", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return requests.length === 1
        ? success({ focus: { id: "11111111-1111-4111-8111-111111111111" } })
        : success({ block: { id: "incident-one" } });
    });

    render(
      <AppliedEngineeringTechnologyWelcome
        technologies={[
          {
            value: "javascript",
            label: "JavaScript",
            detail: "Node.js production incidents",
            resumeMatched: true
          }
        ]}
      />
    );

    expect(screen.getByTestId("teacher").parentElement).toHaveAttribute(
      "data-avatar-feather",
      "alpha-edge"
    );
    expect(
      screen.getByRole("heading", { name: "Preparing your personalised practice path." })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /JavaScript: Node.js production/i })).toBeNull();

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]).toEqual({
      url: "/api/practice/applied-engineering/confirm",
      body: { language: "javascript" }
    });
    expect(requests[1]).toMatchObject({
      url: "/api/practice/applied-engineering/prepare",
      body: {
        focusRevisionId: "11111111-1111-4111-8111-111111111111"
      }
    });
    expect(mocks.replace).toHaveBeenCalledWith("/practice/applied-engineering");
  });

  it("asks which stack to use once more than one is reviewed", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <AppliedEngineeringTechnologyWelcome
        technologies={[
          {
            value: "javascript",
            label: "JavaScript",
            detail: "Node.js production incidents",
            resumeMatched: true
          },
          {
            value: "python" as never,
            label: "Python",
            detail: "Python production incidents",
            resumeMatched: false
          }
        ]}
      />
    );

    expect(screen.getByText("What do you want to get better at?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /JavaScript: Node.js production/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Python: Python production/i }));
    expect(fetchSpy).toHaveBeenCalled();
  });
});

function success(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
