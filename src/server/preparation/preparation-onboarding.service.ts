import { Prisma } from "@prisma/client";
import { BASELINE_STAGE_BY_SECTION, baselineQuestion } from "@/lib/preparation/preparation-onboarding";
import type {
  BaselineSection,
  PreparationOnboardingStage,
  PreparationOnboardingState
} from "@/lib/preparation/preparation-onboarding";
import type { Level, Role } from "@/lib/shared/types";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  advancePreparationStage,
  initialPreparationOnboardingState,
  preparationOnboardingState,
  recordBaselineAnswer,
  startBaseline
} from "./preparation-onboarding-state";

const targetStages = new Set<PreparationOnboardingStage>([
  "target_role",
  "target_level",
  "target_timeline",
  "preparation_areas",
  "target_company"
]);

const targetStageOrder: PreparationOnboardingStage[] = [
  "target_role",
  "target_level",
  "target_timeline",
  "preparation_areas",
  "target_company",
  "baseline_intro"
];

const nextTargetStage: Record<"target_role" | "target_level" | "target_timeline" | "preparation_areas" | "target_company", PreparationOnboardingStage> = {
  target_role: "target_level",
  target_level: "target_timeline",
  target_timeline: "preparation_areas",
  preparation_areas: "target_company",
  target_company: "baseline_intro"
};

const expectedBaselineStage: Record<BaselineSection, PreparationOnboardingStage> = BASELINE_STAGE_BY_SECTION;

/** Durable checkpoint for the required target setup and initial baseline. */
export class PreparationOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async advanceTarget(
    ownerId: string,
    input: {
      targetRole: Role;
      level: Level;
      targetCompany: string;
      targetDate: string | null;
      nextStage: PreparationOnboardingStage;
    }
  ): Promise<PreparationOnboardingState> {
    const current = await this.record(ownerId);
    const state = preparationOnboardingState(current.preparationOnboarding);
    const expectedNextStage = targetStages.has(state.stage)
      ? nextTargetStage[state.stage as keyof typeof nextTargetStage]
      : null;
    const currentIndex = targetStageOrder.indexOf(state.stage);
    const requestedIndex = targetStageOrder.indexOf(input.nextStage);
    // A candidate may revisit an earlier screen. Save the edited values while
    // retaining the furthest durable checkpoint, then return them there.
    const revisingEarlierStep =
      currentIndex >= 0 && requestedIndex >= 0 && requestedIndex <= currentIndex;
    if (
      !revisingEarlierStep &&
      (expectedNextStage === null || input.nextStage !== expectedNextStage)
    ) {
      throw new ConflictErrorException(
        "PREPARATION_ONBOARDING_OUT_OF_ORDER",
        "Complete the current preparation step before moving on."
      );
    }

    const next = advancePreparationStage(
      state,
      revisingEarlierStep ? state.stage : input.nextStage
    );
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: {
        targetRole: input.targetRole,
        level: input.level,
        targetCompany: input.targetCompany.trim(),
        targetDate: input.targetDate ? new Date(`${input.targetDate}T12:00:00.000Z`) : null,
        preparationOnboarding: json(next)
      }
    });
    return next;
  }

  async startBaseline(ownerId: string): Promise<PreparationOnboardingState> {
    const current = await this.record(ownerId);
    const state = preparationOnboardingState(current.preparationOnboarding);
    if (state.stage !== "baseline_intro") {
      throw new ConflictErrorException(
        "PREPARATION_ONBOARDING_OUT_OF_ORDER",
        "Finish target setup before starting the baseline."
      );
    }
    if (!isRole(current.targetRole)) {
      throw new ConflictErrorException(
        "PREPARATION_TARGET_MISSING",
        "Choose a target role before starting the baseline."
      );
    }

    const next = startBaseline(state, current.targetRole, ownerId);
    const assignments = Object.entries(next.questions).flatMap(([section, question]) => {
      const questionId = next.questionIds[section as BaselineSection];
      return question && questionId ? [{ section, questionId, question }] : [];
    });
    await this.prisma.$transaction(async (transaction) => {
      // Starting a fresh baseline (for example after a resume replacement)
      // replaces stale assignments; a resumed baseline never enters this branch.
      await transaction.preparationBaselineQuestion.deleteMany({ where: { ownerId } });
      await transaction.preparationBaselineQuestion.createMany({
        data: assignments.map(({ section, questionId, question }) => ({
          ownerId,
          section,
          questionId,
          question: json(question)
        }))
      });
      await transaction.candidateProfile.update({
        where: { ownerId },
        data: { preparationOnboarding: json(next) }
      });
    });
    return next;
  }

  async submitBaselineAnswer(
    ownerId: string,
    input: { section: BaselineSection; choiceId: string }
  ): Promise<PreparationOnboardingState> {
    const current = await this.record(ownerId);
    const state = preparationOnboardingState(current.preparationOnboarding);
    if (state.stage !== expectedBaselineStage[input.section]) {
      throw new ConflictErrorException(
        "PREPARATION_ONBOARDING_OUT_OF_ORDER",
        "Return to the current baseline question before continuing."
      );
    }
    if (!isRole(current.targetRole)) {
      throw new ConflictErrorException(
        "PREPARATION_TARGET_MISSING",
        "Choose a target role before starting the baseline."
      );
    }
    const assignment = await this.prisma.preparationBaselineQuestion.findUnique({
      where: { ownerId_section: { ownerId, section: input.section } },
      select: { question: true }
    });
    const storedQuestion = assignment
      ? preparationOnboardingState({
          ...state,
          questions: { ...state.questions, [input.section]: assignment.question }
        }).questions[input.section]
      : null;
    const stateWithStoredQuestion = storedQuestion
      ? {
          ...state,
          questions: { ...state.questions, [input.section]: storedQuestion }
        }
      : state;
    const question = stateWithStoredQuestion.questions[input.section]
      ?? baselineQuestion(input.section, current.targetRole, state.questionIds[input.section]);
    if (!question.options.some((option) => option.id === input.choiceId)) {
      throw new ConflictErrorException(
        "PREPARATION_ONBOARDING_INVALID_ANSWER",
        "Choose one of the answers shown for this baseline question."
      );
    }

    const now = Date.now();
    const next = recordBaselineAnswer(
      stateWithStoredQuestion,
      current.targetRole,
      input.section,
      { choiceId: input.choiceId, answeredAt: now },
      now
    );
    await this.prisma.candidateProfile.update({
      where: { ownerId },
      data: {
        preparationOnboarding: json(next),
        preparationOnboardingCompletedAt: next.completedAt ? new Date(next.completedAt) : null
      }
    });
    return next;
  }

  async state(ownerId: string): Promise<PreparationOnboardingState> {
    const record = await this.record(ownerId);
    return preparationOnboardingState(record.preparationOnboarding);
  }

  private async record(ownerId: string) {
    const current = await this.prisma.candidateProfile.findUnique({
      where: { ownerId },
      select: { targetRole: true, preparationOnboarding: true }
    });
    if (!current) {
      throw new NotFoundErrorException("PREPARATION_PROFILE_NOT_FOUND", "Your profile could not be found.");
    }

    // A row created before this feature starts cleanly at the first required step.
    if (current.preparationOnboarding === null) {
      const initial = initialPreparationOnboardingState();
      await this.prisma.candidateProfile.update({
        where: { ownerId },
        data: { preparationOnboarding: json(initial) }
      });
      return { ...current, preparationOnboarding: json(initial) };
    }
    return current;
  }
}

function isRole(value: string | null): value is Role {
  return value === "backend" || value === "frontend" || value === "fullstack" || value === "data" || value === "ai-ml" || value === "pm";
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
