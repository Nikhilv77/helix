import { describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import { buildDsaDesignPlan, rankDsaDesignScenarioWithFallback } from "./dsa-design-round";

const twoSum = findQuestion("two-sum")?.question;
const coinChange = findQuestion("coin-change")?.question;

if (!twoSum || !coinChange) {
  throw new Error("DSA & Design plan tests require Two Sum and Coin Change in the DSA bank");
}

describe("buildDsaDesignPlan", () => {
  const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!;

  it("builds the frozen two-code then three-design interview arc", () => {
    const plan = buildDsaDesignPlan({
      dsaQuestions: [twoSum, coinChange],
      designArtifact: artifact
    });

    expect(plan).toHaveLength(5);
    expect(plan.map((question) => question.interviewSection)).toEqual([
      "dsa",
      "dsa",
      "design",
      "design",
      "design"
    ]);
    expect(plan.map((question) => question.kind)).toEqual([
      "code",
      "code",
      "conversation",
      "conversation",
      "conversation"
    ]);
    expect(plan.map((question) => question.stage)).toEqual([
      "code",
      "code",
      "rapid",
      "explain",
      "scenario"
    ]);
    expect(plan.slice(0, 2).map((question) => question.evidenceAnchor)).toEqual([
      "Two Sum",
      "Coin Change"
    ]);
    expect(
      plan.slice(2).every((question) => question.evidenceAnchor?.includes(artifact.scenario.title))
    ).toBe(true);
  });

  it("preserves DSA interviewer evidence and keeps design answer keys server-side", () => {
    const plan = buildDsaDesignPlan({
      dsaQuestions: [twoSum, coinChange],
      designArtifact: artifact
    });
    const [firstDsa, , frame, design] = plan;

    expect(firstDsa?.dsaInterviewerGuide).toEqual({
      concepts: twoSum.conceptsTested,
      strongSignals: twoSum.interviewSignals,
      commonMistakes: twoSum.commonMistakes,
      followUpPrompts: twoSum.followUpPrompts,
      edgeCases: twoSum.edgeCases ?? []
    });
    expect(frame?.storyPracticeInterviewerGuide?.expectedAnswer).toContain(
      artifact.questionBlock.questions[0]!.referenceAnswer.summary
    );
    expect(design?.storyPracticeInterviewerGuide?.rubric).toHaveLength(
      artifact.questionBlock.questions[1]!.rubric.length +
        artifact.questionBlock.questions[2]!.rubric.length
    );

    const publicPlan = plan.map((question) => ({
      ...question,
      dsaInterviewerGuide: undefined,
      storyPracticeInterviewerGuide: undefined
    }));
    expect(JSON.stringify(publicPlan)).not.toContain(
      artifact.questionBlock.questions[0]!.referenceAnswer.summary
    );
    expect(JSON.stringify(publicPlan)).not.toContain("privateEvaluation");
  });

  it("refuses an artifact that has not received human approval", () => {
    const unapproved = structuredClone(artifact);
    unapproved.humanReview = {
      ...unapproved.humanReview,
      status: "rejected",
      reviewerId: "reviewer",
      reviewedAt: "2026-09-16"
    };

    expect(() =>
      buildDsaDesignPlan({
        dsaQuestions: [twoSum, coinChange],
        designArtifact: unapproved
      })
    ).toThrow("human-approved");
  });
});

describe("rankDsaDesignScenarioWithFallback", () => {
  it("keeps the deterministic recency-aware selection when available", () => {
    const rankFirstScenario = vi.fn().mockReturnValue({ key: "fresh" });
    const result = rankDsaDesignScenarioWithFallback({ rankFirstScenario }, { role: "backend" }, [
      "used"
    ]);

    expect(result).toEqual({ key: "fresh" });
    expect(rankFirstScenario).toHaveBeenCalledOnce();
    expect(rankFirstScenario).toHaveBeenCalledWith(
      { role: "backend" },
      { recentScenarioKeys: ["used"] }
    );
  });

  it("retries without recency after the compatible catalogue is exhausted", () => {
    const rankFirstScenario = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("No published Architecture scenario is compatible");
      })
      .mockReturnValueOnce({ key: "deterministic-reuse" });

    expect(
      rankDsaDesignScenarioWithFallback({ rankFirstScenario }, { role: "backend" }, ["one", "two"])
    ).toEqual({ key: "deterministic-reuse" });
    expect(rankFirstScenario).toHaveBeenNthCalledWith(
      2,
      { role: "backend" },
      { recentScenarioKeys: [] }
    );
  });
});
