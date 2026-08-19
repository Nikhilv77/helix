import { buildEvaluationPrompt } from "./interview-evaluator";
import type { DsaQuestion } from "@/lib/dsa";

const question = {
  title: "Two Sum",
  slug: "two-sum",
  source: "leetcode",
  externalUrl: "https://leetcode.com/problems/two-sum/",
  primaryPattern: "arrays-hashing",
  subPatterns: ["frequency-map"],
  difficulty: "easy",
  expectedTimeMinutes: 15,
  recommendedOrder: 2,
  prerequisites: [],
  conceptsTested: ["complement search"],
  commonMistakes: ["Inserting before checking the complement"],
  interviewSignals: ["Moves from quadratic to linear time"],
  followUpPrompts: ["What changes if the array is sorted?"],
  promptSummary: "Return two indices whose values sum to a target.",
  highLevelApproach: "Track prior values in a map and look up each complement.",
  complexity: { time: "O(n)", space: "O(n)" },
  edgeCases: ["Duplicate values"]
} satisfies DsaQuestion;

describe("DSA interview evaluator prompt", () => {
  it("grounds the review in code, complexity, and problem evidence", () => {
    const prompt = buildEvaluationPrompt(question, {
      approach: "I will keep a value-to-index map.",
      code: "function twoSum(nums, target) { return []; }",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
      hintsUsed: 1
    });

    expect(prompt).toContain("Track prior values in a map");
    expect(prompt).toContain("Duplicate values");
    expect(prompt).toContain("Do not claim that code was executed");
    expect(prompt).toContain("one concise interviewer question");
  });
});
