import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_DESIGN_PREPARATION_EXPERIENCE } from "@/features/practice/architecture-design/ui/architecture-design-experience";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh })
}));

import { StoryPracticePreparation } from "./story-practice-preparation";

describe("StoryPracticePreparation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    window.sessionStorage.clear();
  });

  it("uses configured Architecture copy and sends only its explicit path choice", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return requests.length === 1
        ? success({ focus: { id: "11111111-1111-4111-8111-111111111111" } })
        : success({ block: { id: "architecture-block-one" } });
    });

    render(<StoryPracticePreparation experience={ARCHITECTURE_DESIGN_PREPARATION_EXPERIENCE} />);

    expect(
      screen.getByRole("dialog", { name: "Which system design path do you want to practise?" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /System design path Role-aligned system design/i
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Build my first scenario" }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]).toEqual({
      url: "/api/practice/architecture-design/confirm",
      body: { path: "role-aligned" }
    });
    expect(requests[1]).toMatchObject({
      url: "/api/practice/architecture-design/prepare",
      body: { focusRevisionId: "11111111-1111-4111-8111-111111111111" }
    });
    expect(mocks.replace).toHaveBeenCalledWith("/practice/architecture-design");
  });
});

function success(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
