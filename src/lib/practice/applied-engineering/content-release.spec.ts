import { describe, expect, it } from "vitest";
import { auditAppliedEngineeringContent } from "./content-release-audit";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "./reviewed-incidents";

describe("Applied Engineering content release", () => {
  it("provides both complete launch incidents with passing automated audits", () => {
    expect(APPLIED_ENGINEERING_REVIEW_CANDIDATES.map((artifact) => artifact.caseKey)).toEqual([
      "duplicate-work-after-retry",
      "latency-cascade-under-load"
    ]);

    for (const artifact of APPLIED_ENGINEERING_REVIEW_CANDIDATES) {
      const audit = auditAppliedEngineeringContent(artifact);
      const executable = artifact.questionBlock.questions.filter((question) =>
        ["debug-repair", "micro-implementation"].includes(question.format)
      );

      expect(artifact.questionBlock.questions).toHaveLength(8);
      expect(
        new Set(artifact.questionBlock.questions.map((question) => question.artifact.key)).size
      ).toBeGreaterThanOrEqual(6);
      expect(executable).toHaveLength(2);
      expect(executable.every((question) => question.runnerContract?.networkAccess === false)).toBe(
        true
      );
      expect(audit).toMatchObject({
        automatedValid: true,
        releaseEligible: true,
        reviewStatus: "approved",
        schemaIssues: [],
        identityIssues: [],
        coherenceIssues: [],
        coverageIssues: [],
        executableIssues: [],
        publicSafetyIssues: []
      });
    }
  });

  it("rejects an artifact when the owner review attestation is removed", () => {
    const approved = structuredClone(APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]);
    expect(auditAppliedEngineeringContent(approved)).toMatchObject({
      automatedValid: true,
      releaseEligible: true,
      reviewStatus: "approved"
    });

    const unattested = structuredClone(approved);
    unattested.humanReview.status = "candidate";
    unattested.humanReview.reviewerId = null;
    unattested.humanReview.reviewedAt = null;
    expect(auditAppliedEngineeringContent(unattested)).toMatchObject({
      automatedValid: true,
      releaseEligible: false,
      reviewStatus: "candidate"
    });
  });

  it("detects a question that no longer follows the incident stage", () => {
    const changed = structuredClone(APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]);
    changed.incident.stages[1]!.artifactKey = "different-timeline-artifact";

    expect(auditAppliedEngineeringContent(changed)).toMatchObject({
      automatedValid: false,
      releaseEligible: false,
      coherenceIssues: ["question 2 does not use its declared artifact"]
    });
  });

  it("rejects forbidden capabilities from executable content", () => {
    const changed = structuredClone(APPLIED_ENGINEERING_REVIEW_CANDIDATES[1]);
    changed.questionBlock.questions[4]!.referenceSolution +=
      "\nconst unsafeFilesystem = require('node:fs');";
    const audit = auditAppliedEngineeringContent(changed);

    expect(audit.automatedValid).toBe(false);
    expect(audit.executableIssues).toContainEqual(
      expect.stringContaining("contains forbidden executable capability node:fs")
    );
  });

  it("detects production signals that the eight questions do not cover", () => {
    const changed = structuredClone(APPLIED_ENGINEERING_REVIEW_CANDIDATES[1]);
    changed.incident.productionSignalKeys.push("rollback-readiness");

    expect(auditAppliedEngineeringContent(changed).coverageIssues).toEqual([
      "uncovered production signal: rollback-readiness"
    ]);
  });
});
