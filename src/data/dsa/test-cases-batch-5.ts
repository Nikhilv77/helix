import type { DsaExample } from "@/lib/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch6 } from "./test-cases-batch-6";

export const structuredDsaTestCasesBatch5: Record<string, StructuredDsaTestCase[]> = {
  "capacity-to-ship-packages-within-d-days": [
    { arguments: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5], expectedValue: 15 },
    { arguments: [[3, 2, 2, 4, 1, 4], 3], expectedValue: 6 }
  ],
  "split-array-largest-sum": [
    { arguments: [[7, 2, 5, 10, 8], 2], expectedValue: 18 },
    { arguments: [[1, 2, 3, 4, 5], 2], expectedValue: 9 }
  ],
  "median-of-two-sorted-arrays": [
    { arguments: [[1, 3], [2]], expectedValue: 2 },
    { arguments: [[1, 2], [3, 4]], expectedValue: 2.5 }
  ],
  "reverse-linked-list": [
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: [5, 4, 3, 2, 1] },
    { arguments: [[1, 2]], expectedValue: [2, 1] },
    { arguments: [[]], expectedValue: [] }
  ],
  "merge-two-sorted-lists": [
    { arguments: [[1, 2, 4], [1, 3, 4]], expectedValue: [1, 1, 2, 3, 4, 4] },
    { arguments: [[], []], expectedValue: [] },
    { arguments: [[], [0]], expectedValue: [0] }
  ],
  "linked-list-cycle": [
    { arguments: [[3, 2, 0, -4], 1], expectedValue: true },
    { arguments: [[1, 2], 0], expectedValue: true },
    { arguments: [[1], -1], expectedValue: false }
  ],
  "intersection-of-two-linked-lists": [
    { arguments: [[4, 1, 8, 4, 5], [5, 6, 1, 8, 4, 5], 2, 3], expectedValue: 8 },
    { arguments: [[1, 9, 1, 2, 4], [3, 2, 4], 3, 1], expectedValue: 2 },
    { arguments: [[2, 6, 4], [1, 5], 3, 2], expectedValue: null }
  ],
  "remove-nth-node-from-end-of-list": [
    { arguments: [[1, 2, 3, 4, 5], 2], expectedValue: [1, 2, 3, 5] },
    { arguments: [[1], 1], expectedValue: [] },
    { arguments: [[1, 2], 1], expectedValue: [1] }
  ],
  "linked-list-cycle-ii": [
    { arguments: [[3, 2, 0, -4], 1], expectedValue: 1 },
    { arguments: [[1, 2], 0], expectedValue: 0 },
    { arguments: [[1], -1], expectedValue: -1 }
  ],
  "palindrome-linked-list": [
    { arguments: [[1, 2, 2, 1]], expectedValue: true },
    { arguments: [[1, 2]], expectedValue: false }
  ],
  "add-two-numbers": [
    { arguments: [[2, 4, 3], [5, 6, 4]], expectedValue: [7, 0, 8] },
    { arguments: [[0], [0]], expectedValue: [0] },
    { arguments: [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]], expectedValue: [8, 9, 9, 9, 0, 0, 0, 1] }
  ],
  "swap-nodes-in-pairs": [
    { arguments: [[1, 2, 3, 4]], expectedValue: [2, 1, 4, 3] },
    { arguments: [[]], expectedValue: [] },
    { arguments: [[1]], expectedValue: [1] }
  ],
  "odd-even-linked-list": [
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: [1, 3, 5, 2, 4] },
    { arguments: [[2, 1, 3, 5, 6, 4, 7]], expectedValue: [2, 3, 6, 7, 1, 5, 4] }
  ],
  "reverse-linked-list-ii": [
    { arguments: [[1, 2, 3, 4, 5], 2, 4], expectedValue: [1, 4, 3, 2, 5] },
    { arguments: [[5], 1, 1], expectedValue: [5] }
  ],
  "rotate-list": [
    { arguments: [[1, 2, 3, 4, 5], 2], expectedValue: [4, 5, 1, 2, 3] },
    { arguments: [[0, 1, 2], 4], expectedValue: [2, 0, 1] }
  ],
  "reorder-list": [
    { arguments: [[1, 2, 3, 4]], expectedValue: [1, 4, 2, 3] },
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: [1, 5, 2, 4, 3] }
  ],
  "copy-list-with-random-pointer": [
    { arguments: [[[7, null], [13, 0], [11, 4], [10, 2], [1, 0]]], expectedValue: [[7, null], [13, 0], [11, 4], [10, 2], [1, 0]] },
    { arguments: [[[1, 1], [2, 1]]], expectedValue: [[1, 1], [2, 1]] },
    { arguments: [[]], expectedValue: [] }
  ],
  "flatten-a-multilevel-doubly-linked-list": [
    { arguments: [[1, 2, 3, 4, 5, 6, null, null, null, 7, 8, 9, 10, null, null, 11, 12]], expectedValue: [1, 2, 3, 7, 8, 11, 12, 9, 10, 4, 5, 6] },
    { arguments: [[1, 2, null, 3]], expectedValue: [1, 3, 2] }
  ],
  "sort-list": [
    { arguments: [[4, 2, 1, 3]], expectedValue: [1, 2, 3, 4] },
    { arguments: [[-1, 5, 3, 4, 0]], expectedValue: [-1, 0, 3, 4, 5] },
    { arguments: [[]], expectedValue: [] }
  ],
  "merge-k-sorted-lists": [
    { arguments: [[[1, 4, 5], [1, 3, 4], [2, 6]]], expectedValue: [1, 1, 2, 3, 4, 4, 5, 6] },
    { arguments: [[]], expectedValue: [] },
    { arguments: [[[]]], expectedValue: [] }
  ]
};

export function structuredCasesForBatch5(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch5[slug];
  return cases?.length === examples.length ? cases : structuredCasesForBatch6(slug, examples);
}
