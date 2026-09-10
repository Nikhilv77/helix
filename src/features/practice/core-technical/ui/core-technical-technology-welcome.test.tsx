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
vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ name: "Maya" })
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

import { CoreTechnicalTechnologyWelcome } from "./core-technical-technology-welcome";

describe("CoreTechnicalTechnologyWelcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("shows resume suggestions and creates a private personalized block immediately", async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return bodies.length === 1
        ? success({ focus: { id: "11111111-1111-4111-8111-111111111111" } })
        : success({ block: { id: "block-one" } });
    });

    render(
      <CoreTechnicalTechnologyWelcome
        technologies={[
          {
            value: "typescript",
            label: "TypeScript",
            detail: "Practical TypeScript on Node.js",
            resumeMatched: true
          },
          {
            value: "nodejs",
            label: "Node.js",
            detail: "Runtime behaviour",
            resumeMatched: false
          }
        ]}
      />
    );

    expect(screen.queryByText("Suggested from your resume")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /TypeScript: Practical TypeScript/i }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).toEqual({ technology: "typescript" });
    expect(bodies[1]).toMatchObject({
      focusRevisionId: "11111111-1111-4111-8111-111111111111",
      personalized: true
    });
    expect(mocks.replace).toHaveBeenCalledWith("/practice/core-technical");
  });
});

function success(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
