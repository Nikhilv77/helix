import {
  DsaPracticeFeedbackService,
  buildDsaPracticeFeedbackPrompt
} from "./practice-feedback.service";
import type { DsaQuestion } from "@/lib/dsa/dsa";

const question = {
  title: "Contains Duplicate",
  slug: "contains-duplicate",
  source: "leetcode",
  externalUrl: "https://leetcode.com/problems/contains-duplicate/",
  problemStatement: "Return true when an integer appears twice.",
  promptSummary: "Detect a repeated value.",
  primaryPattern: "arrays-hashing",
  subPatterns: [],
  difficulty: "easy",
  expectedTimeMinutes: 10,
  recommendedOrder: 1,
  prerequisites: [],
  conceptsTested: ["sets"],
  highLevelApproach: "Track values in a set while scanning.",
  complexity: { time: "O(n)", space: "O(n)" },
  edgeCases: ["An empty array"],
  commonMistakes: ["Sorting and forgetting the trade-off"],
  interviewSignals: ["States the set invariant"],
  followUpPrompts: []
} satisfies DsaQuestion;

describe("DsaPracticeFeedbackService", () => {
  it("asks for a concise, teacher-specific markdown debrief", () => {
    const prompt = buildDsaPracticeFeedbackPrompt(question, {
      code: "function containsDuplicate(nums) { return new Set(nums).size !== nums.length; }",
      language: "javascript",
      testsPassed: 2,
      testCount: 2,
      teacherId: "olivia"
    });

    expect(prompt).toContain("Olivia — Sharp and fast");
    expect(prompt).toContain("2/2 supplied tests passed");
    expect(prompt).toContain('"### What you did well"');
    expect(prompt).toContain('Do not say "all tests prove this is correct"');
  });

  it("uses the fast structured-model path", async () => {
    const generateStructured = jest.fn().mockResolvedValue({
      headline: "Clean set-based solution",
      markdown: "### What landed\nYou used a `Set`.",
      voiceScript:
        "Nice. You used a set and kept the scan linear. What invariant are you relying on?",
      followUp: "What invariant makes the set check sufficient?"
    });
    const service = new DsaPracticeFeedbackService({ generateStructured } as never);

    await service.review(question, {
      code: "function containsDuplicate(nums) { return new Set(nums).size !== nums.length; }",
      language: "javascript",
      testsPassed: 2,
      testCount: 2
    });

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "dsa.practice.feedback", modelClass: "fast" })
    );
  });
});
