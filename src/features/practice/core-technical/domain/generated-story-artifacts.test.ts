import { describe, expect, it } from "vitest";

import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "./gold-cases";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "./interview-patterns";
import { NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS } from "./practice-path-blueprints";
import { CoreTechnicalGoldEvaluator } from "../server/gold-evaluator";
import { focusedPracticePathFallback } from "../server/focused-practice-path-fallbacks";

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

const evaluator = new CoreTechnicalGoldEvaluator({
  patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
});
const reviewedPaths = NODEJS_CORE_TECHNICAL_GOLD_CASES.map((goldCase) => {
  const blueprint = NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS.find(
    (candidate) => candidate.title === goldCase.expected.storyTitle
  );
  const draft = blueprint ? focusedPracticePathFallback(blueprint.key) : null;
  if (!blueprint || !draft) throw new Error(`Missing reviewed fallback for ${goldCase.key}`);
  return { goldCase, blueprint, draft, evaluation: evaluator.evaluateCase(goldCase, draft) };
});

describe("code-backed Core Technical practice paths", () => {
  it("freezes both approved focused contracts after a perfect evaluation", () => {
    expect(reviewedPaths.map(({ goldCase }) => goldCase.key).sort()).toEqual(
      NODEJS_CORE_TECHNICAL_GOLD_CASES.map((goldCase) => goldCase.key).sort()
    );

    for (const { goldCase, draft, evaluation } of reviewedPaths) {
      expect(draft.questionBlock.questions).toHaveLength(6);
      for (const question of draft.questionBlock.questions) {
        expect(question.answer.learningGuide?.markdown).toContain("## What is happening");
        expect(question.answer.learningGuide?.markdown).toContain("## How to reason through it");
        expect(question.answer.learningGuide?.markdown).toContain("## A strong interview answer");
        expect(question.answer.learningGuide?.markdown).toContain("## What to avoid");
        expect(question.answer.learningGuide?.diagram.steps.map(({ label }) => label)).toEqual([
          "Observe",
          "Explain",
          "Repair",
          "Verify"
        ]);
      }
      expect(evaluation.qualityPassed).toBe(true);
      expect(evaluation.totalScore).toBe(100);
      expect(evaluation.hardFailures).toEqual([]);
      expect(evaluation.releaseEligible).toBe(true);
      expect(evaluation.humanReviewStatus).toBe("approved");
      expect(goldCase.review).toMatchObject({
        status: "approved",
        reviewerId: "nikhilverma",
        reviewedAt: "2026-09-07"
      });
    }
  });

  it("keeps executable reference solutions distinct, deterministic, and syntactically valid", () => {
    for (const { draft } of reviewedPaths) {
      const executableQuestions = draft.questionBlock.questions.filter(
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
