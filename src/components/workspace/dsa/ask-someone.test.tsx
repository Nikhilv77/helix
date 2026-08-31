import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/lib/dsa/hint-tracker", () => ({
  hintsUsedFor: () => 0
}));

vi.mock("../help/helper-ready-toast", () => ({ HelperReadyToast: () => null }));
vi.mock("../help/help-rating", () => ({ HelpRating: () => null }));
vi.mock("../help/safety-controls", () => ({ SafetyControls: () => null }));

import { AskSomeone } from "./ask-someone";
import { SHOW_CURRENT_PEER_HELP_EVENT } from "@/lib/help/help-ui-events";

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
            data: {
              id: "00000000-0000-4000-8000-000000000001",
              status: "OPEN",
              invitationsSent: 2,
              cooldownMs: 10 * 60_000
            }
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
      fireEvent.click(screen.getByRole("button", { name: "Ask a mate" }));
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
    expect(screen.getByText("Invitations sent to 2 Trailmates — waiting")).toBeTruthy();
  });

  it("shows a blurred toast and does not send when no helper is available", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, data: { id: null, status: null, helperCount: 0 } })
      );
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Trailmates are available right now/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask a mate" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Your invitation was not sent.", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("help-flow-notice-backdrop").className).toContain(
      "backdrop-blur-[5px]"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server cooldown as a live timer on Ask a mate", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/help/request" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              success: false,
              error: {
                code: "HELP_REQUEST_RATE_LIMITED",
                message: "Please wait.",
                details: { retryAfterMs: 10 * 60_000 }
              }
            },
            false
          )
        );
      }
      return Promise.resolve(
        jsonResponse({ success: true, data: { id: null, status: null, helperCount: 2 } })
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
      await Promise.resolve();
      await Promise.resolve();
      fireEvent.click(screen.getByRole("button", { name: "Ask a mate" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Ask a mate is cooling down")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask again in 10:00" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole("button", { name: "Ask again in 9:50" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(590_000);
    });
    expect(screen.getByRole("button", { name: "Ask a mate" })).not.toBeDisabled();
  });

  it("opens the current-engagement prompt instead of showing a generic conflict error", async () => {
    const showPrompt = vi.fn();
    window.addEventListener(SHOW_CURRENT_PEER_HELP_EVENT, showPrompt);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/help/request" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              success: false,
              error: {
                code: "HELP_ENGAGEMENT_ACTIVE",
                message: "Finish your current engagement first."
              }
            },
            false
          )
        );
      }
      return Promise.resolve(
        jsonResponse({ success: true, data: { id: null, status: null, helperCount: 2 } })
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

    fireEvent.click(screen.getByRole("button", { name: "Ask a mate" }));
    await waitFor(() => expect(showPrompt).toHaveBeenCalledOnce());
    expect(screen.queryByText("Finish your current engagement first.")).toBeNull();
    window.removeEventListener(SHOW_CURRENT_PEER_HELP_EVENT, showPrompt);
  });
});
