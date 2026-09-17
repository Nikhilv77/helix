import { describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import {
  buildDsaDesignPlan,
  buildDsaInterviewPlan,
  buildSystemDesignPlan,
  rankDsaDesignScenarioWithFallback
} from "./dsa-design-round";

const twoSum = findQuestion("two-sum")?.question;
const coinChange = findQuestion("coin-change")?.question;

if (!twoSum || !coinChange) {
  throw new Error("DSA & Design plan tests require Two Sum and Coin Change in the DSA bank");
}

describe("buildDsaDesignPlan", () => {
  const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!;

  it("builds the frozen two-code then five-act candidate-led design arc", () => {
    const plan = buildDsaDesignPlan({
      dsaQuestions: [twoSum, coinChange],
      designArtifact: artifact
    });

    expect(plan).toHaveLength(7);
    expect(plan.map((question) => question.interviewSection)).toEqual([
      "dsa",
      "dsa",
      "design",
      "design",
      "design",
      "design",
      "design"
    ]);
    expect(plan.map((question) => question.kind)).toEqual([
      "code",
      "code",
      "conversation",
      "conversation",
      "conversation",
      "conversation",
      "conversation"
    ]);
    expect(plan.map((question) => question.stage)).toEqual([
      "code",
      "code",
      "design-frame",
      "design-canvas",
      "design-deep-dive",
      "design-pressure",
      "design-defend"
    ]);
    expect(plan.slice(0, 2).map((question) => question.evidenceAnchor)).toEqual([
      "Two Sum",
      "Coin Change"
    ]);
    expect(plan.slice(0, 2).map((question) => question.maxFollowUps)).toEqual([2, 2]);
    expect(
      plan.slice(2).every((question) => question.evidenceAnchor === artifact.scenario.title)
    ).toBe(true);
    expect(plan[2]?.text).toContain("Begin by asking me");
    expect(plan[2]?.text).not.toContain(artifact.scenario.scaleProfile[0]);
    expect(plan[5]?.text).toContain("Pressure test:");
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

  it("builds independent coding and design plans for new sessions", () => {
    const dsa = buildDsaInterviewPlan({ dsaQuestions: [twoSum, coinChange] });
    const design = buildSystemDesignPlan({ designArtifact: artifact });

    expect(dsa).toHaveLength(2);
    expect(dsa.every((question) => question.interviewSection === "dsa")).toBe(true);
    expect(design).toHaveLength(5);
    expect(design.every((question) => question.interviewSection === "design")).toBe(true);
    expect(design.map((question) => question.stage)).toEqual([
      "design-frame",
      "design-canvas",
      "design-deep-dive",
      "design-pressure",
      "design-defend"
    ]);
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
