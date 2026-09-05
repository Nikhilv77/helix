import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import { CandidateProfileEditor } from "./candidate-profile-editor";

const apiMocks = vi.hoisted(() => ({
  uploadResume: vi.fn(),
  confirmResumeUpdate: vi.fn()
}));

vi.mock("@/lib/api/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/api-client")>();
  return {
    ...actual,
    uploadResume: apiMocks.uploadResume,
    confirmResumeUpdate: apiMocks.confirmResumeUpdate
  };
});

vi.mock("next/image", () => ({
  default: () => <span aria-hidden="true" />
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const profile: CandidateProfile = {
  targetRole: "backend",
  level: "3-5",
  targetCompany: "",
  targetDate: null,
  headline: "Backend engineer",
  context: "Builds reliable product systems and APIs.",
  focusAreas: ["System design"],
  stories: [],
  coverImage: "/images/profile/covers/cover-1.png",
  profileImage: "/images/profile/avatars/avatar-1.png",
  workspaceAccent: "ember",
  teacherId: "maya",
  helpNotificationsEnabled: true,
  teacherNotificationsEnabled: true,
  updatedAt: Date.now(),
  completeness: 80,
  onboardingCompletedAt: Date.now(),
  preparationOnboarding: {
    stage: "completed",
    updatedAt: Date.now(),
    completedAt: Date.now(),
    baselineStartedAt: Date.now(),
    answers: {},
    questionIds: {},
    questions: {},
    skillProfile: null
  },
  resume: {
    versionId: "11111111-1111-4111-8111-111111111111",
    contentFingerprint: `sha256-${"a".repeat(64)}`,
    fileName: "current.pdf",
    mimeType: "application/pdf",
    uploadedAt: Date.now(),
    confidence: 90,
    fullName: "Test Candidate",
    skills: ["TypeScript"],
    warnings: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
    evidence: {
      dateRanges: 0,
      achievementLines: 0,
      quantifiedAchievements: 0,
      experienceEntries: 0,
      projectEntries: 0,
      educationEntries: 0
    },
    interviewKit: null
  }
};

describe("Profile resume update", () => {
  beforeEach(() => {
    apiMocks.uploadResume.mockReset();
    apiMocks.confirmResumeUpdate.mockReset();
  });

  it("opens the update workflow in a modal without navigating away", () => {
    render(<CandidateProfileEditor initialProfile={profile} />);

    const update = screen.getByRole("button", { name: "Update resume" });
    expect(update.closest("a")).toBeNull();
    fireEvent.click(update);

    const dialog = screen.getByRole("dialog", { name: "Update resume" });
    expect(dialog).toBeVisible();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("overflow-hidden");
    expect(screen.queryByRole("heading", { name: "Upload your resume." })).not.toBeInTheDocument();
    expect(screen.getAllByText("Drop your resume")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Browse files" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Onboarding step/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Practice progress, Interview history, plans/)
    ).not.toBeInTheDocument();
  });

  it("replaces the uploader with one simple update loader after file selection", async () => {
    apiMocks.uploadResume.mockImplementation(() => new Promise(() => undefined));
    render(<CandidateProfileEditor initialProfile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "Update resume" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: {
        files: [new File([new Uint8Array(1_000)], "updated.pdf", { type: "application/pdf" })]
      }
    });

    expect(
      await screen.findByRole("heading", { name: "Your profile is being updated" })
    ).toBeVisible();
    expect(screen.queryByText("Drop your resume")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your profile is being updated");
    expect(screen.queryByText("CHECKING DOCUMENT INTEGRITY...")).not.toBeInTheDocument();
    expect(screen.getByText("Checking document integrity...")).toHaveClass("thinking-shimmer");
  });

  it("shows the save phase after resume analysis finishes", async () => {
    apiMocks.uploadResume.mockResolvedValue({});
    apiMocks.confirmResumeUpdate.mockImplementation(() => new Promise(() => undefined));
    render(<CandidateProfileEditor initialProfile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "Update resume" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [new File([new Uint8Array(1_000)], "updated.pdf", { type: "application/pdf" })]
      }
    });

    const status = await screen.findByText("Applying the verified resume to your profile...");
    expect(status).toHaveClass("thinking-shimmer");
  });
});
