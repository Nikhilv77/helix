import vm from "node:vm";
import { findQuestion } from "@/lib/dsa/dsa";
import { dsaFunctionName, dsaStarterCode } from "@/lib/dsa/dsa-code-templates";
import { buildTestCases, buildTestHarness, parseTestResults } from "./code-test-harness";

describe("DSA runner contracts", () => {
  it("generates valid parameter and return shapes for representative starters", () => {
    expect(starter("two-sum", "javascript")).toContain("function twoSum(nums, target)");
    expect(starter("two-sum", "python")).toContain("def twoSum(nums, target):");
    expect(starter("two-sum", "java")).toContain("static int[] twoSum(int[] nums, int target)");
    expect(starter("two-sum", "cpp")).toContain(
      "vector<int> twoSum(vector<int>& nums, int target)"
    );

    expect(starter("3sum", "javascript")).toContain("function threeSum(nums)");
    expect(starter("merge-two-sorted-lists", "java")).toContain(
      "static ListNode mergeTwoSortedLists(ListNode list1, ListNode list2)"
    );
    expect(starter("path-sum", "cpp")).toContain("bool pathSum(TreeNode* root, int targetSum)");
    expect(starter("binary-tree-level-order-traversal", "java")).toContain(
      "static int[][] binaryTreeLevelOrderTraversal(TreeNode root)"
    );
    expect(starter("move-zeroes", "cpp")).toContain("void moveZeroes(vector<int>& nums)");
  });

  it.each([
    [
      "two-sum",
      `function twoSum(nums, target) {
        const seen = new Map();
        for (let index = 0; index < nums.length; index += 1) {
          const other = seen.get(target - nums[index]);
          if (other !== undefined) return [other, index];
          seen.set(nums[index], index);
        }
        return [];
      }`
    ],
    [
      "reverse-linked-list",
      `function reverseLinkedList(head) {
        let previous = null;
        while (head) {
          const next = head.next;
          head.next = previous;
          previous = head;
          head = next;
        }
        return previous;
      }`
    ],
    [
      "maximum-depth-of-binary-tree",
      `function maximumDepthOfBinaryTree(root) {
        if (!root) return 0;
        return 1 + Math.max(maximumDepthOfBinaryTree(root.left), maximumDepthOfBinaryTree(root.right));
      }`
    ],
    [
      "move-zeroes",
      `function moveZeroes(nums) {
        let write = 0;
        for (const value of nums) if (value !== 0) nums[write++] = value;
        while (write < nums.length) nums[write++] = 0;
      }`
    ],
    [
      "min-stack",
      `class MinStack {
        constructor() { this.values = []; this.minimums = []; }
        push(value) { this.values.push(value); this.minimums.push(Math.min(value, this.minimums.at(-1) ?? Infinity)); }
        pop() { this.minimums.pop(); this.values.pop(); }
        top() { return this.values.at(-1); }
        getMin() { return this.minimums.at(-1); }
      }`
    ]
  ])("executes representative %s authored tests", (slug, solution) => {
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);
    const harness = buildTestHarness(solution, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];

    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });

    const results = parseTestResults(output.join("\n"), testCases);
    expect(results).toHaveLength(testCases.length);
    expect(results.every((result) => result.passed)).toBe(true);
  });
});

function starter(slug: string, language: "javascript" | "python" | "java" | "cpp"): string {
  return dsaStarterCode(requiredQuestion(slug), language);
}

function requiredQuestion(slug: string) {
  const question = findQuestion(slug)?.question;
  if (!question) throw new Error(`Missing DSA fixture: ${slug}`);
  return question;
}
