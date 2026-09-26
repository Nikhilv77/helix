import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { DsaQuestionActions } from "./dsa-question-actions";

type Pending = { body: { action: string; requestId: string }; resolve: (ok: boolean) => void };

describe("DsaQuestionActions skip", () => {
  let skips: Pending[];

  beforeEach(() => {
    skips = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        // Opening the question succeeds at once; skips wait for the test.
        if (body.action === "open") return Promise.resolve({ ok: true } as Response);
        return new Promise<Response>((resolve) =>
          skips.push({ body, resolve: (ok) => resolve({ ok } as Response) })
        );
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("moves to the next question without waiting for the roadmap write", async () => {
    render(<DsaQuestionActions slug="two-sum" nextHref="/dsa-questions/three-sum" />);

    fireEvent.click(screen.getByRole("button", { name: /skip question/i }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dsa-questions/three-sum"));
    expect(skips).toHaveLength(1);
    expect(screen.getByText(/Skipped/)).toBeTruthy();
    skips[0]!.resolve(true);
  });

  it("retries a failed background skip with the same request id", async () => {
    vi.useFakeTimers();
    render(<DsaQuestionActions slug="two-sum" nextHref="/dsa-questions/three-sum" />);

    fireEvent.click(screen.getByRole("button", { name: /skip question/i }));
    await act(async () => skips[0]!.resolve(false));
    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(skips).toHaveLength(2);
    expect(skips[1]!.body.requestId).toBe(skips[0]!.body.requestId);
    await act(async () => skips[1]!.resolve(true));
  });

  it("stays on the last question and rolls back when its skip fails", async () => {
    render(<DsaQuestionActions slug="two-sum" nextHref={null} />);

    fireEvent.click(screen.getByRole("button", { name: /skip question/i }));
    await act(async () => skips[0]!.resolve(false));

    expect(await screen.findByText(/Could not save/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /skip question/i })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
