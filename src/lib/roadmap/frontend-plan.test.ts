import { describe, expect, it } from "vitest";
import { dsaPhases } from "@/lib/dsa/dsa";
import { buildFrontendDsaPlan, buildFullDsaPlan, type PlanQuestion } from "./frontend-plan";

function bank(): PlanQuestion[] {
  return dsaPhases().flatMap((phase, phaseIndex) =>
    phase.questions.map((question) => ({
      slug: question.slug,
      title: question.title,
      difficulty: question.difficulty,
      primaryPattern: question.primaryPattern,
      expectedTimeMinutes: question.expectedTimeMinutes,
      phaseSlug: `phase-${phaseIndex + 1}`,
      phaseNumber: phaseIndex + 1,
      recommendedOrder: question.recommendedOrder
    }))
  );
}

describe("DSA plans", () => {
  it("keeps the curated roadmap compact while exposing the complete bank for exploration", () => {
    const questions = bank();
    const curated = buildFrontendDsaPlan(questions);
    const full = buildFullDsaPlan(questions);

    expect(questions).toHaveLength(200);
    expect(curated.totalQuestions).toBeLessThan(full.totalQuestions);
    expect(full.totalQuestions).toBe(200);
    expect(
      new Set(full.chapters.flatMap((chapter) => chapter.questions.map((q) => q.slug))).size
    ).toBe(200);
  });
});
