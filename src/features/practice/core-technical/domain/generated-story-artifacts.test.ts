import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "./gold-cases";
import { coreTechnicalStoryReviewArtifactSchema } from "./review-artifact-contracts";

const artifactDirectory = path.resolve(process.cwd(), "src/features/practice/core-technical/domain/generated");
const forbiddenExecutableCode = [
  /node:fs/,
  /node:http/,
  /node:https/,
  /node:net/,
  /node:child_process/,
  /\bfetch\s*\(/,
  /\bDate\.now\s*\(/,
  /\bMath\.random\s*\(/
];

const artifacts = NODEJS_CORE_TECHNICAL_GOLD_CASES.map((goldCase) =>
  coreTechnicalStoryReviewArtifactSchema.parse(
    JSON.parse(readFileSync(path.join(artifactDirectory, goldCase.key + ".json"), "utf8"))
  )
);

describe("generated Core Technical story review artifacts", () => {
  it("freezes both approved first-story contracts after a perfect evaluation", () => {
    expect(artifacts.map((artifact) => artifact.caseKey).sort()).toEqual(
      NODEJS_CORE_TECHNICAL_GOLD_CASES.map((goldCase) => goldCase.key).sort()
    );

    for (const artifact of artifacts) {
      expect(artifact.questionBlock.questions).toHaveLength(8);
      expect(artifact.evaluation.qualityPassed).toBe(true);
      expect(artifact.evaluation.totalScore).toBe(100);
      expect(artifact.evaluation.hardFailures).toEqual([]);
      expect(artifact.evaluation.releaseEligible).toBe(true);
      expect(artifact.evaluation.humanReviewStatus).toBe("approved");
      expect(artifact.humanReview).toMatchObject({
        status: "approved",
        reviewerId: "nikhilverma",
        reviewedAt: "2026-09-07"
      });
    }
  });

  it("keeps executable reference solutions distinct, deterministic, and syntactically valid", () => {
    for (const artifact of artifacts) {
      const executableQuestions = artifact.questionBlock.questions.filter(
        (question) => question.runnerContract !== undefined
      );
      expect(executableQuestions).toHaveLength(2);

      for (const question of executableQuestions) {
        expect(question.starterCode).not.toBe(question.referenceSolution);
        expect(question.publicTests?.length).toBeGreaterThan(0);
        expect(question.hiddenTests?.length).toBeGreaterThan(0);
        expect(question.runnerContract).toMatchObject({
          language: "javascript",
          runtime: "nodejs",
          runtimeVersion: "22",
          networkAccess: false
        });

        const executableText = [
          question.artifact.content,
          question.starterCode,
          question.referenceSolution
        ].join("\n");
        for (const forbidden of forbiddenExecutableCode) {
          expect(executableText).not.toMatch(forbidden);
        }
      }
    }
  });
});
