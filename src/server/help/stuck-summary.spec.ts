import {
  StuckSummaryService,
  SYSTEM_INSTRUCTION,
  buildStuckSummaryPrompt,
  fallbackSummary,
  formatDuration
} from "./stuck-summary";
import type { HelpRequestContext } from "./help-request.types";
import type { AiService } from "../ai/ai.service";
import type { DsaQuestion } from "@/lib/dsa/dsa";

const question = {
  title: "LRU Cache",
  slug: "lru-cache",
  source: "leetcode",
  externalUrl: "https://leetcode.com/problems/lru-cache/",
  primaryPattern: "linked-list",
  subPatterns: ["hash-map"],
  difficulty: "medium",
  expectedTimeMinutes: 30,
  recommendedOrder: 4,
  prerequisites: [],
  conceptsTested: ["doubly linked list", "hash map"],
  commonMistakes: ["Forgetting to unlink the node before re-inserting it"],
  interviewSignals: ["Keeps every operation O(1)"],
  followUpPrompts: ["What changes if it must be thread-safe?"],
  promptSummary: "Build a cache that evicts the least recently used key.",
  highLevelApproach:
    "Pair a hash map with a doubly linked list; move a node to the head on every access.",
  complexity: { time: "O(1)", space: "O(n)" },
  problemStatement: "Design a cache with get and put in constant time.",
  edgeCases: ["Capacity of one"]
} as unknown as DsaQuestion;

const context: HelpRequestContext = {
  code: "public class LRUCache { public int get(int key) { return -1; } }",
  testOutput: "FAILED: expected 3 but was -1",
  failingTests: 2,
  hintsUsed: 3,
  timeSpentMs: 18 * 60 * 1000
};

describe("stuck summary prompt", () => {
  it("grounds the briefing in the learner's actual state", () => {
    const prompt = buildStuckSummaryPrompt(question, context);

    expect(prompt).toContain("LRU Cache");
    expect(prompt).toContain("18 min");
    expect(prompt).toContain("2 tests are failing");
    expect(prompt).toContain("public class LRUCache");
    expect(prompt).toContain("FAILED: expected 3 but was -1");
    expect(prompt).toContain("Forgetting to unlink the node");
  });

  it("tells the model the intended approach is for diagnosis only", () => {
    const prompt = buildStuckSummaryPrompt(question, context);

    // The approach has to be in the prompt for the model to spot the gap, so
    // the guardrail is the instruction that travels with it.
    expect(prompt).toContain(question.highLevelApproach);
    expect(prompt).toMatch(/do NOT repeat it/i);
    expect(prompt).toMatch(/without\s+resolving it/i);
  });

  it("states the length budgets the schema cannot carry", () => {
    // toStrictJsonSchema strips maxLength before the request leaves, so the
    // only place the model can learn these limits is the instruction. Dropping
    // them silently reintroduces the over-long `opener` that failed live.
    expect(SYSTEM_INSTRUCTION).toMatch(/at most 220 characters/);
    expect(SYSTEM_INSTRUCTION).toMatch(/between 2 and 20/);
  });

  it("teaches symptom-not-cure by example rather than by rule", () => {
    // An abstract "do not state the fix" was not enough on its own: the model
    // returned the whole answer reworded. The worked pairs are what hold.
    expect(SYSTEM_INSTRUCTION).toContain("BAD (hands over the fix)");
    expect(SYSTEM_INSTRUCTION).toContain("GOOD (symptom only)");
    expect(SYSTEM_INSTRUCTION).toContain("BAD (too vague to act on)");
  });

  it("flags a high hint count as the reason a human was asked for", () => {
    const prompt = buildStuckSummaryPrompt(question, { ...context, hintsUsed: 4 });
    expect(prompt).toContain("the AI explanation is not landing");

    const calm = buildStuckSummaryPrompt(question, { ...context, hintsUsed: 1 });
    expect(calm).not.toContain("the AI explanation is not landing");
  });

  it("distinguishes never-ran from passing from failing", () => {
    expect(buildStuckSummaryPrompt(question, { ...context, failingTests: null })).toContain(
      "They have not run the tests yet"
    );
    expect(buildStuckSummaryPrompt(question, { ...context, failingTests: 0 })).toContain(
      "the blockage is not correctness"
    );
    expect(buildStuckSummaryPrompt(question, { ...context, failingTests: 1 })).toContain(
      "1 test is failing"
    );
  });

  it("says so plainly when there is no code yet", () => {
    const prompt = buildStuckSummaryPrompt(question, { ...context, code: "   " });
    expect(prompt).toContain("// nothing written yet");
  });

  it("labels the code fence by language so the helper reads it highlighted", () => {
    expect(buildStuckSummaryPrompt(question, context)).toContain("```java");
    expect(
      buildStuckSummaryPrompt(question, { ...context, code: "def get(self, key): pass" })
    ).toContain("```python");
    expect(
      buildStuckSummaryPrompt(question, { ...context, code: "const get = (key) => -1;" })
    ).toContain("```typescript");
  });
});

describe("stuck summary service", () => {
  it("returns the model's structured briefing", async () => {
    const briefing = {
      headline: "Understands the map plus list pairing, unsure how get promotes a node.",
      understands: ["HashMap for O(1) lookup", "Doubly linked list for ordering"],
      blockedOn: "Which pointers to update, and in what order, when moving a node to the head.",
      estimatedMinutes: 6,
      opener: "Ask what happens to the neighbours when they move a node."
    };
    const ai = { generateStructured: jest.fn().mockResolvedValue(briefing) };

    const service = new StuckSummaryService(ai as unknown as AiService);
    await expect(service.summarize(question, context)).resolves.toEqual(briefing);

    expect(ai.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "help.stuck.summarize", modelClass: "fast" })
    );
  });

  it("falls back instead of throwing when the model is unavailable", async () => {
    const ai = { generateStructured: jest.fn().mockRejectedValue(new Error("upstream down")) };
    const service = new StuckSummaryService(ai as unknown as AiService);

    // The request is already open by this point. A model outage must not turn
    // into a failed ask.
    const summary = await service.summarize(question, context);
    expect(summary.headline).toContain("LRU Cache");
    expect(summary.estimatedMinutes).toBeGreaterThan(0);
  });
});

describe("fallback summary", () => {
  it("states only what the snapshot proves, and never a fix", () => {
    const summary = fallbackSummary(question, context);

    expect(summary.headline).toContain("18 min");
    expect(summary.blockedOn).toContain("2 tests are failing");
    expect(summary.blockedOn).toContain("3 AI hints");
    // It has no idea what the answer is, and must not imply one.
    expect(summary.blockedOn).not.toContain(question.highLevelApproach);
    expect(summary.understands).toEqual([]);
  });

  it("singularises a single hint and a single failing test", () => {
    const summary = fallbackSummary(question, { ...context, hintsUsed: 1, failingTests: 1 });
    expect(summary.blockedOn).toContain("1 AI hint");
    expect(summary.blockedOn).toContain("1 test is failing");
  });

  it("keeps the estimate inside the schema's bounds", () => {
    const quick = fallbackSummary(
      { ...question, expectedTimeMinutes: 2 } as DsaQuestion,
      context
    );
    const long = fallbackSummary(
      { ...question, expectedTimeMinutes: 300 } as DsaQuestion,
      context
    );

    expect(quick.estimatedMinutes).toBeGreaterThanOrEqual(2);
    expect(long.estimatedMinutes).toBeLessThanOrEqual(20);
  });
});

describe("duration formatting", () => {
  it("reads naturally either side of an hour", () => {
    expect(formatDuration(18 * 60_000)).toBe("18 min");
    expect(formatDuration(60 * 60_000)).toBe("1h");
    expect(formatDuration(95 * 60_000)).toBe("1h 35m");
    expect(formatDuration(0)).toBe("0 min");
  });
});
