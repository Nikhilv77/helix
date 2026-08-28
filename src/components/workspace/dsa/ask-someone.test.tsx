import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/lib/dsa/hint-tracker", () => ({
  hintsUsedFor: () => 0
}));

vi.mock("../help/helper-ready-toast", () => ({ HelperReadyToast: () => null }));
vi.mock("../help/help-rating", () => ({ HelpRating: () => null }));
vi.mock("../help/safety-controls", () => ({ SafetyControls: () => null }));

import { AskSomeone } from "./ask-someone";

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

describe("AskSomeone", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows a 15-second delivery countdown after creating a request", async () => {
    vi.useFakeTimers();
    let created = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/help/request" && init?.method === "POST") {
        created = true;
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { id: "00000000-0000-4000-8000-000000000001", status: "OPEN" }
          })
        );
      }

      return Promise.resolve(
        jsonResponse({
          success: true,
          data: {
            id: created ? "00000000-0000-4000-8000-000000000001" : null,
            status: created ? "OPEN" : null,
            helperCount: 2
          }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AskSomeone
        slug="contains-duplicate"
        title="Contains Duplicate"
        language="javascript"
        code="return true;"
        testOutput={null}
        failingTests={null}
        selection={null}
        startedAt={Date.now() - 10_000}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ask someone" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Delivering your request")).toBeTruthy();
    expect(screen.getByLabelText("15 seconds remaining")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByLabelText("14 seconds remaining")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(screen.getByText("Request delivered — waiting for a helper")).toBeTruthy();
  });
});
