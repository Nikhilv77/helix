import { describe, expect, it, vi } from "vitest";
import type { BaselineQuestion } from "@/lib/preparation/preparation-onboarding";
import { initialPreparationOnboardingState, startBaseline } from "./preparation-onboarding-state";
import { PreparationOnboardingService } from "./preparation-onboarding.service";

const OWNER_ID = "owner-1";

function serviceFor(preparationOnboarding: unknown, assignedQuestion: BaselineQuestion | null = null) {
  const prisma = {
    candidateProfile: {
      findUnique: vi.fn().mockResolvedValue({ targetRole: "backend", preparationOnboarding }),
      update: vi.fn()
    },
    preparationBaselineQuestion: {
      findUnique: vi.fn().mockResolvedValue(
        assignedQuestion ? { question: assignedQuestion } : null
      ),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    $transaction: vi.fn()
  };
  return { service: new PreparationOnboardingService(prisma as never), prisma };
}

describe("PreparationOnboardingService", () => {
  it("only permits the immediate next target stage", async () => {
    const { service, prisma } = serviceFor(initialPreparationOnboardingState(10));

    await expect(
      service.advanceTarget(OWNER_ID, {
        targetRole: "backend",
        level: "3-5",
        targetCompany: "",
        targetDate: null,
        nextStage: "baseline_intro"
      })
    ).rejects.toMatchObject({ code: "PREPARATION_ONBOARDING_OUT_OF_ORDER" });

    expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
  });

  it("saves edits from an earlier target screen without regressing the durable checkpoint", async () => {
    const current = {
      ...initialPreparationOnboardingState(10),
      stage: "target_timeline" as const
    };
    const { service, prisma } = serviceFor(current);

    const result = await service.advanceTarget(OWNER_ID, {
      targetRole: "frontend",
      level: "3-5",
      targetCompany: "",
      targetDate: null,
      nextStage: "target_level"
    });

    expect(result.stage).toBe("target_timeline");
    expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID },
      data: expect.objectContaining({
        targetRole: "frontend",
        preparationOnboarding: expect.objectContaining({ stage: "target_timeline" })
      })
    });
  });

  it("rejects an answer that was not one of the persisted question options", async () => {
    const state = startBaseline(
      { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
      "backend",
      OWNER_ID,
      20
    );
    const { service, prisma } = serviceFor(state);

    await expect(
      service.submitBaselineAnswer(OWNER_ID, { section: "dsa-familiarity", choiceId: "not-an-option" })
    ).rejects.toMatchObject({ code: "PREPARATION_ONBOARDING_INVALID_ANSWER" });

    expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
  });

  it("uses the durable question snapshot for grading when profile JSON lost that question", async () => {
    const started = startBaseline(
      { ...initialPreparationOnboardingState(10), stage: "baseline_intro" },
      "backend",
      OWNER_ID,
      20
    );
    const assignedQuestion = started.questions.architecture!;
    const questions = { ...started.questions };
    delete questions.architecture;
    const damagedState = {
      ...started,
      stage: "baseline_architecture" as const,
      questions
    };
    const { service } = serviceFor(damagedState, assignedQuestion);

    const result = await service.submitBaselineAnswer(OWNER_ID, {
      section: "architecture",
      choiceId: assignedQuestion.correctOptionId!
    });

    expect(result.questions.architecture).toEqual(assignedQuestion);
    expect(
      result.skillProfile?.signals
        .find((signal) => signal.areaId === "architecture-design")
        ?.topics?.[0]?.familiarity
    ).toBe("familiar");
  });
});
