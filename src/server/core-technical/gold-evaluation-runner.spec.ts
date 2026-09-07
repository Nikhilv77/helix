import { describe, expect, it, vi } from "vitest";

import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/lib/practice/core-technical/gold-cases";
import {
  CORE_TECHNICAL_GOLD_SET_VERSION,
  type CoreTechnicalGoldEvaluationSuiteReport
} from "@/lib/practice/core-technical/gold-evaluation-contracts";

import { CoreTechnicalGoldEvaluationRunner } from "./gold-evaluation-runner";

describe("CoreTechnicalGoldEvaluationRunner", () => {
  it("runs every benchmark sequentially and evaluates the completed set", async () => {
    const firstOutput = { story: { key: "first-output" } };
    const secondOutput = { story: { key: "second-output" } };
    let active = 0;
    let maximumActive = 0;
    const prepareReviewedDraft = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const output = prepareReviewedDraft.mock.calls.length === 1 ? firstOutput : secondOutput;
      await Promise.resolve();
      active -= 1;
      return output;
    });
    const expectedReport = {
      goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
      qualityPassRate: 0,
      allQualityPassed: false,
      releaseEligible: false,
      caseReports: []
    } as unknown as CoreTechnicalGoldEvaluationSuiteReport;
    const evaluateSuite = vi.fn().mockReturnValue(expectedReport);
    const runner = new CoreTechnicalGoldEvaluationRunner({
      generationPipeline: { prepareReviewedDraft } as never,
      evaluator: { evaluateSuite }
    });

    const result = await runner.run(NODEJS_CORE_TECHNICAL_GOLD_CASES);

    expect(result).toBe(expectedReport);
    expect(prepareReviewedDraft).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(1);
    expect(evaluateSuite).toHaveBeenCalledWith([
      { goldCase: NODEJS_CORE_TECHNICAL_GOLD_CASES[0], output: firstOutput },
      { goldCase: NODEJS_CORE_TECHNICAL_GOLD_CASES[1], output: secondOutput }
    ]);
  });
});
