import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeExtractionResponse } from "@/lib/shared/types";
import { ResumeEvidenceStep } from "./resume-evidence-step";

const result = {
  extraction: {
    experience: [{ role: "Backend engineer", organization: "Northstar", period: "2023–2026", summary: "Worked on sign-up APIs." }],
    projects: [{ name: "Sign-up flow", outcome: "Made sign-up simpler so people could get started." }],
    education: [{ credential: "BSc Computer Science", institution: "Westbridge University", period: "2019–2023" }]
  }
} as ResumeExtractionResponse;

describe("ResumeEvidenceStep viewport control", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps capture evidence visible without a timer-driven viewport change", () => {
    render(<ResumeEvidenceStep result={result} teacherName="Maya" autoScroll={false} onBack={vi.fn()} onReplace={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText("Backend engineer")).toBeInTheDocument();
    expect(screen.getByText("Sign-up flow")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2500));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it("retains the default idle scroll in the app", () => {
    render(<ResumeEvidenceStep result={result} teacherName="Maya" onBack={vi.fn()} onReplace={vi.fn()} onContinue={vi.fn()} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
