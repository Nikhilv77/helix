import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResumeReadinessStep } from "./resume-readiness-step";
import type { ResumeExtractionResponse } from "@/lib/shared/types";

const result = {
  extraction: {
    skills: ["TypeScript"],
    focusAreas: []
  }
} as unknown as ResumeExtractionResponse;

describe("ResumeReadinessStep entry progress", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows changing setup updates below the Enter button while completion runs", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });

    render(
      <ResumeReadinessStep
        result={result}
        teacherName="Sophia"
        replacingResume={false}
        onBack={() => undefined}
        onContinue={() => undefined}
        continuing
      />
    );

    for (let elapsed = 0; elapsed < 12_000; elapsed += 250) {
      act(() => vi.advanceTimersByTime(250));
    }

    expect(screen.getByRole("button", { name: /entering/i })).toBeDisabled();
    expect(screen.getByText("Sophia will start with a broad baseline.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ALMOST THERE...");
  });
});
