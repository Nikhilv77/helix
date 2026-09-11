import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

const mocks = vi.hoisted(() => ({
  requireOnboardedProfile: vi.fn(),
  current: vi.fn(),
  historyRead: vi.fn(),
  startOrResume: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    coreTechnicalPracticeService: { current: mocks.current },
    coreTechnicalHistoryService: { read: mocks.historyRead },
    coreTechnicalAssessmentRuntimeService: { startOrResume: mocks.startOrResume }
  })
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound,
  redirect: mocks.redirect
}));

import CoreTechnicalAssessmentRoomPage from "./page";

describe("CoreTechnicalAssessmentRoomPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOnboardedProfile.mockResolvedValue({ ownerId: "owner-one" });
  });

  it("redirects an in-progress assessment into its durable shared voice room", async () => {
    mocks.historyRead.mockResolvedValue(block("block-one", "assessment-one"));
    mocks.startOrResume.mockResolvedValue({ sessionId: "assessment-one" });

    await expect(
      CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "block-one" })
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "block-one");
    expect(mocks.startOrResume).toHaveBeenCalledWith("owner-one", {
      assessmentId: "assessment-one",
      requestId: "assessment-one"
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/interview/voice?session=assessment-one");
  });

  it("fails closed when the assessment does not belong to the selected block", async () => {
    mocks.historyRead.mockResolvedValue(block("block-one", "another-assessment"));

    await expect(
      CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "block-one" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    mocks.historyRead.mockRejectedValue(
      new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "Core Technical practice path not found."
      )
    );
    await expect(
      CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "foreign-block" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function block(id: string, assessmentId: string) {
  return {
    id,
    assessment: { id: assessmentId, status: "IN_PROGRESS" },
    questions: [{ status: "COMPLETED" }, { status: "LEARNED" }, { status: "ACTIVE" }]
  };
}
