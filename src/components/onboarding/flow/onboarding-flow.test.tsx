import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadResume: vi.fn(() => new Promise(() => undefined))
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/lib/api/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  completeOnboarding: vi.fn(),
  confirmResumeUpdate: vi.fn(),
  uploadResume: mocks.uploadResume
}));

vi.mock("../shared/onboarding-ui", () => ({
  BlueprintBackdrop: () => null
}));

vi.mock("../steps/role-step", () => ({
  RoleStep: ({
    onSelect,
    onContinue
  }: {
    onSelect: (role: "backend") => void;
    onContinue: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelect("backend");
        onContinue();
      }}
    >
      Choose backend
    </button>
  )
}));

vi.mock("../steps/level-step", () => ({
  LevelStep: ({ onSelect }: { onSelect: (level: "0-2") => void }) => (
    <button type="button" onClick={() => onSelect("0-2")}>
      Choose early career
    </button>
  )
}));

vi.mock("../steps/resume-upload-step", () => ({
  ResumeStep: ({ onFile }: { onFile: (file: File) => void }) => (
    <button
      type="button"
      onClick={() =>
        onFile(new File(["x".repeat(1_200)], "resume.pdf", { type: "application/pdf" }))
      }
    >
      Upload resume
    </button>
  )
}));

vi.mock("../steps/teacher-step", () => ({
  DEFAULT_TEACHER_ID: "maya",
  TeacherStep: () => null
}));

vi.mock("../resume-review/resume-evidence-step", () => ({
  ResumeEvidenceStep: () => null
}));
vi.mock("../resume-review/resume-identity-step", () => ({
  ResumeIdentityStep: () => null
}));
vi.mock("../resume-review/resume-readiness-step", () => ({
  ResumeReadinessStep: ({ children }: { children?: ReactNode }) => children ?? null
}));

import { OnboardingFlow } from "./onboarding-flow";

describe("OnboardingFlow role selection", () => {
  it("passes the selected onboarding role and level into resume analysis", async () => {
    render(<OnboardingFlow embedded initialStep="role" />);

    fireEvent.click(screen.getByRole("button", { name: "Choose backend" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose early career" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    await waitFor(() =>
      expect(mocks.uploadResume).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRole: "backend",
          level: "0-2"
        })
      )
    );
  });
});
