import { describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/lib/practice/applied-engineering/reviewed-incidents";
import { AppliedEngineeringRunnerService } from "./runner.service";

describe("AppliedEngineeringRunnerService", () => {
  it("adapts an Applied executable question to the shared Node runner", async () => {
    const question = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!.questionBlock.questions.find((item) => item.format === "debug-repair")!;
    const run = vi.fn().mockResolvedValue({ accepted: true });
    const service = new AppliedEngineeringRunnerService({ run, supportsStack: () => true } as never);

    await expect(service.run(question, "module.exports = () => 1;")).resolves.toEqual({ accepted: true });
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ key: question.key, storyKey: question.incidentKey, mechanismKeys: question.productionSignalKeys }), "module.exports = () => 1;");
  });
});
