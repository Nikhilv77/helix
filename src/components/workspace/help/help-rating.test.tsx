import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpRating } from "./help-rating";

const requestId = "00000000-0000-4000-8000-000000000001";

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

describe("HelpRating", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["Yes, it helped", 5],
    ["No", 1]
  ])("stores the %s answer as the compatible rating %i", async (label, rating) => {
    const onCompleted = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { rated: true } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<HelpRating requestId={requestId} onCompleted={onCompleted} />);

    expect(screen.getByRole("dialog", { name: "Did that help?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/help/session/${requestId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rate", rating })
      });
      expect(onCompleted).toHaveBeenCalledOnce();
    });
  });

  it("makes Yes the default focused action", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<HelpRating requestId={requestId} />);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Yes, it helped" }));
  });

  it("renders in a centered portal with a blurred backdrop", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<HelpRating requestId={requestId} />);

    const dialog = screen.getByRole("dialog", { name: "Did that help?" });
    const toast = dialog.closest("aside");
    expect(toast?.parentElement).toBe(document.body);
    expect(toast?.className).toContain("top-1/2");
    const backdrop = screen.getByTestId("help-rating-backdrop");
    expect(backdrop.className).toContain("backdrop-blur-[5px]");
    expect(backdrop.className).toContain("bg-black/25");
  });
});
