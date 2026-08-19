import type { DsaExample } from "@/lib/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch7 } from "./test-cases-batch-7";

export const structuredDsaTestCasesBatch6: Record<string, StructuredDsaTestCase[]> = {
  "reverse-nodes-in-k-group": [
    { arguments: [[1, 2, 3, 4, 5], 2], expectedValue: [2, 1, 4, 3, 5] },
    { arguments: [[1, 2, 3, 4, 5], 3], expectedValue: [3, 2, 1, 4, 5] }
  ],
  "design-browser-history": [
    { arguments: [["leetcode.com", "google.com", "facebook.com", "youtube.com"], ["back", 1], ["back", 1], ["forward", 1]], expectedValue: [null, null, null, null, "facebook.com", "google.com", "facebook.com"] },
    { arguments: [["a.com", "b.com"], ["back", 1], ["forward", 1]], expectedValue: [null, "a.com", "b.com"] }
  ],
  "lru-cache": [
    { arguments: [[2], ["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]], expectedValue: [null, null, 1, null, -1, null, -1, 3, 4] },
    { arguments: [[1], ["put", 2, 1], ["get", 2], ["put", 3, 2], ["get", 2]], expectedValue: [null, 1, null, -1] }
  ],
  "valid-parentheses": [
    { arguments: ["()"], expectedValue: true },
    { arguments: ["()[]{}"], expectedValue: true },
    { arguments: ["(]"], expectedValue: false }
  ],
  "min-stack": [
    { arguments: [["push", -2], ["push", 0], ["push", -3], ["getMin"], ["pop"], ["top"], ["getMin"]], expectedValue: [null, null, null, -3, null, 0, -2] },
    { arguments: [["push", 2], ["getMin"], ["push", 1], ["getMin"], ["pop"], ["getMin"]], expectedValue: [null, 2, null, 1, null, 2] }
  ],
  "evaluate-reverse-polish-notation": [
    { arguments: [["2", "1", "+", "3", "*"]], expectedValue: 9 },
    { arguments: [["4", "13", "5", "/", "+"]], expectedValue: 6 },
    { arguments: [["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]], expectedValue: 22 }
  ],
  "simplify-path": [
    { arguments: ["/home/"], expectedValue: "/home" },
    { arguments: ["/../"], expectedValue: "/" },
    { arguments: ["/home//foo/"], expectedValue: "/home/foo" }
  ],
  "asteroid-collision": [
    { arguments: [[5, 10, -5]], expectedValue: [5, 10] },
    { arguments: [[8, -8]], expectedValue: [] },
    { arguments: [[10, 2, -5]], expectedValue: [10] }
  ],
  "implement-queue-using-stacks": [
    { arguments: [["push", 1], ["push", 2], ["peek"], ["pop"], ["empty"]], expectedValue: [null, null, 1, 1, false] },
    { arguments: [["push", 1], ["empty"], ["pop"], ["empty"]], expectedValue: [null, false, 1, true] }
  ],
  "implement-stack-using-queues": [
    { arguments: [["push", 1], ["push", 2], ["top"], ["pop"], ["empty"]], expectedValue: [null, null, 2, 2, false] },
    { arguments: [["push", 1], ["empty"], ["pop"], ["empty"]], expectedValue: [null, false, 1, true] }
  ],
  "design-circular-queue": [
    { arguments: [[3], ["enQueue", 1], ["enQueue", 2], ["enQueue", 3], ["enQueue", 4], ["Rear"], ["isFull"], ["deQueue"], ["enQueue", 4], ["Rear"]], expectedValue: [true, true, true, false, 3, true, true, true, 4] },
    { arguments: [[1], ["enQueue", 5], ["Front"], ["Rear"], ["deQueue"], ["isEmpty"]], expectedValue: [true, 5, 5, true, true] }
  ],
  "daily-temperatures": [
    { arguments: [[73, 74, 75, 71, 69, 72, 76, 73]], expectedValue: [1, 1, 4, 2, 1, 1, 0, 0] },
    { arguments: [[30, 40, 50, 60]], expectedValue: [1, 1, 1, 0] },
    { arguments: [[30, 60, 90]], expectedValue: [1, 1, 0] }
  ],
  "next-greater-element-i": [
    { arguments: [[4, 1, 2], [1, 3, 4, 2]], expectedValue: [-1, 3, -1] },
    { arguments: [[2, 4], [1, 2, 3, 4]], expectedValue: [3, -1] }
  ],
  "next-greater-element-ii": [
    { arguments: [[1, 2, 1]], expectedValue: [2, -1, 2] },
    { arguments: [[1, 2, 3, 4, 3]], expectedValue: [2, 3, 4, -1, 4] }
  ],
  "online-stock-span": [
    { arguments: [[100, 80, 60, 70, 60, 75, 85]], expectedValue: [1, 1, 1, 2, 1, 4, 6] },
    { arguments: [[31, 41, 48, 59]], expectedValue: [1, 2, 3, 4] }
  ],
  "remove-k-digits": [
    { arguments: ["1432219", 3], expectedValue: "1219" },
    { arguments: ["10200", 1], expectedValue: "200" },
    { arguments: ["10", 2], expectedValue: "0" }
  ],
  "car-fleet": [
    { arguments: [12, [10, 8, 0, 5, 3], [2, 4, 1, 1, 3]], expectedValue: 3 },
    { arguments: [10, [3], [3]], expectedValue: 1 }
  ],
  "basic-calculator-ii": [
    { arguments: ["3+2*2"], expectedValue: 7 },
    { arguments: [" 3/2 "], expectedValue: 1 },
    { arguments: [" 3+5 / 2 "], expectedValue: 5 }
  ],
  "basic-calculator": [
    { arguments: ["1 + 1"], expectedValue: 2 },
    { arguments: [" 2-1 + 2 "], expectedValue: 3 },
    { arguments: ["(1+(4+5+2)-3)+(6+8)"], expectedValue: 23 }
  ],
  "largest-rectangle-in-histogram": [
    { arguments: [[2, 1, 5, 6, 2, 3]], expectedValue: 10 },
    { arguments: [[2, 4]], expectedValue: 4 }
  ],
  "maximum-depth-of-binary-tree": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: 3 },
    { arguments: [[1, null, 2]], expectedValue: 2 }
  ],
  "minimum-depth-of-binary-tree": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: 2 },
    { arguments: [[2, null, 3, null, 4, null, 5, null, 6]], expectedValue: 5 }
  ],
  "same-tree": [
    { arguments: [[1, 2, 3], [1, 2, 3]], expectedValue: true },
    { arguments: [[1, 2], [1, null, 2]], expectedValue: false },
    { arguments: [[1, 2, 1], [1, 1, 2]], expectedValue: false }
  ],
  "symmetric-tree": [
    { arguments: [[1, 2, 2, 3, 4, 4, 3]], expectedValue: true },
    { arguments: [[1, 2, 2, null, 3, null, 3]], expectedValue: false }
  ],
  "invert-binary-tree": [
    { arguments: [[4, 2, 7, 1, 3, 6, 9]], expectedValue: [4, 7, 2, 9, 6, 3, 1] },
    { arguments: [[2, 1, 3]], expectedValue: [2, 3, 1] },
    { arguments: [[]], expectedValue: [] }
  ],
  "subtree-of-another-tree": [
    { arguments: [[3, 4, 5, 1, 2], [4, 1, 2]], expectedValue: true },
    { arguments: [[3, 4, 5, 1, 2, null, null, null, null, 0], [4, 1, 2]], expectedValue: false }
  ],
  "balanced-binary-tree": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: true },
    { arguments: [[1, 2, 2, 3, 3, null, null, 4, 4]], expectedValue: false }
  ],
  "diameter-of-binary-tree": [
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: 3 },
    { arguments: [[1, 2]], expectedValue: 1 }
  ],
  "path-sum": [
    { arguments: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1], 22], expectedValue: true },
    { arguments: [[1, 2, 3], 5], expectedValue: false }
  ],
  "sum-root-to-leaf-numbers": [
    { arguments: [[1, 2, 3]], expectedValue: 25 },
    { arguments: [[4, 9, 0, 5, 1]], expectedValue: 1026 }
  ]
};

export function structuredCasesForBatch6(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch6[slug];
  return cases?.length === examples.length ? cases : structuredCasesForBatch7(slug, examples);
}
