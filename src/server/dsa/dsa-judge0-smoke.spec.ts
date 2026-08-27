import "dotenv/config";
import { findQuestion } from "@/lib/dsa/dsa";
import { dsaFunctionName } from "@/lib/dsa/dsa-code-templates";
import { buildTestCases, buildTestHarness, parseTestResults } from "./code-test-harness";

const judgeDescribe = process.env.RUN_DSA_JUDGE0_SMOKE === "1" ? describe : describe.skip;

/**
 * Opt-in because every case consumes an external Judge0 request. Run with:
 * RUN_DSA_JUDGE0_SMOKE=1 pnpm exec jest --runInBand dsa-judge0-smoke.spec.ts
 */
judgeDescribe("Judge0 DSA smoke contracts", () => {
  jest.setTimeout(120_000);

  it.each([
    {
      language: "javascript" as const,
      languageId: 97,
      slug: "min-stack",
      solution: `class MinStack {
        constructor() { this.values = []; this.minimums = []; }
        push(value) { this.values.push(value); this.minimums.push(Math.min(value, this.minimums.at(-1) ?? Infinity)); }
        pop() { this.minimums.pop(); this.values.pop(); }
        top() { return this.values.at(-1); }
        getMin() { return this.minimums.at(-1); }
      }`
    },
    {
      language: "javascript" as const,
      languageId: 97,
      slug: "reverse-linked-list",
      solution: `function reverseLinkedList(head) {
        let previous = null;
        while (head) {
          const next = head.next;
          head.next = previous;
          previous = head;
          head = next;
        }
        return previous;
      }`
    },
    {
      language: "javascript" as const,
      languageId: 97,
      slug: "maximum-depth-of-binary-tree",
      solution: `function maximumDepthOfBinaryTree(root) {
        if (!root) return 0;
        return 1 + Math.max(maximumDepthOfBinaryTree(root.left), maximumDepthOfBinaryTree(root.right));
      }`
    },
    {
      language: "javascript" as const,
      languageId: 97,
      slug: "move-zeroes",
      solution: `function moveZeroes(nums) {
        let write = 0;
        for (const value of nums) if (value !== 0) nums[write++] = value;
        while (write < nums.length) nums[write++] = 0;
      }`
    },
    {
      language: "python" as const,
      languageId: 71,
      slug: "two-sum",
      solution: `def twoSum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        if target - value in seen: return [seen[target - value], index]
        seen[value] = index
    return []`
    },
    {
      language: "java" as const,
      languageId: 62,
      slug: "two-sum",
      solution: `import java.util.*;
class Main {
    static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int index = 0; index < nums.length; index++) {
            if (seen.containsKey(target - nums[index])) return new int[]{seen.get(target - nums[index]), index};
            seen.put(nums[index], index);
        }
        return new int[]{};
    }
}`
    },
    {
      language: "cpp" as const,
      languageId: 105,
      slug: "two-sum",
      solution: `#include <bits/stdc++.h>
using namespace std;
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int index = 0; index < (int) nums.size(); index++) {
        if (seen.count(target - nums[index])) return {seen[target - nums[index]], index};
        seen[nums[index]] = index;
    }
    return {};
}
int main() { return 0; }`
    }
  ])("executes $language through the configured runner", async (fixture) => {
    const question = findQuestion(fixture.slug)?.question;
    if (!question?.examples?.length) throw new Error(`Missing DSA fixture: ${fixture.slug}`);
    const testCases = buildTestCases(question.examples, fixture.slug);
    const source = buildTestHarness(
      fixture.solution,
      fixture.language,
      dsaFunctionName(fixture.slug),
      testCases
    );
    const result = await submitToJudge0(source, fixture.languageId);
    expect(result.status?.description).toBe("Accepted");

    const stdout = decode(result.stdout);
    const tests = parseTestResults(stdout, testCases);
    expect(tests).toHaveLength(testCases.length);
    expect(tests.every((test) => test.passed)).toBe(true);
  });
});

interface JudgeResult {
  status?: { description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
}

async function submitToJudge0(sourceCode: string, languageId: number): Promise<JudgeResult> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST ?? "judge0-ce.p.rapidapi.com";
  const url = process.env.JUDGE0_URL ?? "https://judge0-ce.p.rapidapi.com";
  if (!key) throw new Error("RAPIDAPI_KEY is required for the opt-in Judge0 smoke test.");

  const response = await fetch(`${url}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host
    },
    body: JSON.stringify({
      language_id: languageId,
      source_code: Buffer.from(sourceCode, "utf8").toString("base64"),
      cpu_time_limit: 5,
      wall_time_limit: 10,
      memory_limit: 256_000,
      enable_network: false
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const result = (await response.json().catch(() => null)) as JudgeResult | null;
  if (!response.ok || !result) {
    throw new Error(`Judge0 smoke request failed with status ${response.status}.`);
  }
  if (result.status?.description !== "Accepted") {
    throw new Error(
      [result.status?.description, decode(result.compile_output), decode(result.stderr)]
        .filter(Boolean)
        .join(": ")
    );
  }
  return result;
}

function decode(value: string | null | undefined): string {
  return value ? Buffer.from(value, "base64").toString("utf8") : "";
}
