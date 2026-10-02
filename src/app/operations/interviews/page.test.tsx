import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import InterviewOperationsPage from "./page";

describe("InterviewOperationsPage", () => {
  it("sends the old console to the admin dashboard, keeping the window", async () => {
    await expect(
      InterviewOperationsPage({ searchParams: Promise.resolve({ hours: "72" }) })
    ).rejects.toThrow("REDIRECT:/admin/interviews?hours=72");
    await expect(InterviewOperationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/admin/interviews"
    );
  });
});
