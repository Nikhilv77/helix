import { personaById } from "@/lib/avatars/personas";
import {
  DsaPracticeFeedbackService,
  buildDsaPracticeFeedbackPrompt,
  usableHighlight
} from "./practice-feedback.service";
import type { DsaQuestion } from "@/features/practice/dsa/domain/dsa";

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

    expect(prompt).toContain(`Olivia — ${personaById("olivia")!.manner}`);
    expect(prompt).toContain("2/2 supplied tests passed");
    expect(prompt).toContain('"### What you did well"');
    expect(prompt).toContain('Do not say "all tests prove this is correct"');
  });

  it("uses the fast structured-model path", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
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
      expect.objectContaining({
        operation: "dsa.practice.feedback",
        modelClass: "fast",
        hedgeAfterMs: 4_000,
        timeoutMs: 12_000,
        maxAttempts: 2
      })
    );
  });

  it("numbers the code and asks for speakable complexity and a highlighted range", () => {
    const prompt = buildDsaPracticeFeedbackPrompt(question, {
      code: "\nconst seen = new Set();\nreturn seen;",
      language: "javascript",
      testsPassed: 2,
      testCount: 2
    });

    expect(prompt).toContain("1| const seen = new Set();\n2| return seen;");
    expect(prompt).toContain('say "O of n" for O(n)');
    expect(prompt).toContain("- highlight: the line numbers");
  });

  it("keeps a highlight only when it points at real code, capped to what the modal shows", () => {
    const code = "a\nb\n\n\nc\nd\ne\nf\ng";

    expect(usableHighlight({ startLine: 2, endLine: 9 }, code)).toEqual({
      startLine: 2,
      endLine: 7
    });
    expect(usableHighlight({ startLine: 3, endLine: 4 }, code)).toBeUndefined();
    expect(usableHighlight({ startLine: 12, endLine: 14 }, code)).toBeUndefined();
    expect(usableHighlight({ startLine: 5, endLine: 2 }, code)).toBeUndefined();
    expect(usableHighlight(undefined, code)).toBeUndefined();
  });

  it("drops an unusable model highlight instead of showing blank lines", async () => {
    const service = new DsaPracticeFeedbackService({
      generateStructured: vi.fn().mockResolvedValue({
        headline: "Clean",
        markdown: "### What you did well\nGood.",
        voiceScript: "Good.",
        followUp: "Why?",
        highlight: { startLine: 40, endLine: 42 }
      })
    } as never);

    const result = await service.review(question, {
      code: "const seen = new Set();",
      language: "javascript",
      testsPassed: 2,
      testCount: 2
    });

    expect(result).not.toHaveProperty("highlight");
  });
});
