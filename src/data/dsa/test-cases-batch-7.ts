import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch8 } from "./test-cases-batch-8";

export const structuredDsaTestCasesBatch7: Record<string, StructuredDsaTestCase[]> = {
  "path-sum-ii": [
    { arguments: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1], 22], expectedValue: [[5, 4, 11, 2], [5, 8, 4, 5]], comparison: "unordered-nested" },
    { arguments: [[1, 2, 3], 5], expectedValue: [] }
  ],
  "binary-tree-level-order-traversal": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: [[3], [9, 20], [15, 7]] },
    { arguments: [[1]], expectedValue: [[1]] },
    { arguments: [[]], expectedValue: [] }
  ],
  "binary-tree-zigzag-level-order-traversal": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: [[3], [20, 9], [15, 7]] },
    { arguments: [[1]], expectedValue: [[1]] },
    { arguments: [[]], expectedValue: [] }
  ],
  "binary-tree-right-side-view": [
    { arguments: [[1, 2, 3, null, 5, null, 4]], expectedValue: [1, 3, 4] },
    { arguments: [[1, null, 3]], expectedValue: [1, 3] },
    { arguments: [[]], expectedValue: [] }
  ],
  "populating-next-right-pointers-in-each-node": [
    { arguments: [[1, 2, 3, 4, 5, 6, 7]], expectedValue: [1, "#", 2, 3, "#", 4, 5, 6, 7, "#"] },
    { arguments: [[]], expectedValue: [] }
  ],
  "validate-binary-search-tree": [
    { arguments: [[2, 1, 3]], expectedValue: true },
    { arguments: [[5, 1, 4, null, null, 3, 6]], expectedValue: false }
  ],
  "kth-smallest-element-in-a-bst": [
    { arguments: [[3, 1, 4, null, 2], 1], expectedValue: 1 },
    { arguments: [[5, 3, 6, 2, 4, null, null, 1], 3], expectedValue: 3 }
  ],
  "convert-sorted-array-to-binary-search-tree": [
    { arguments: [[-10, -3, 0, 5, 9]], expectedValue: [[0, -3, 9, -10, null, 5], [0, -10, 5, null, -3, null, 9]], comparison: "one-of" },
    { arguments: [[1, 3]], expectedValue: [[3, 1], [1, null, 3]], comparison: "one-of" }
  ],
  "recover-binary-search-tree": [
    { arguments: [[1, 3, null, null, 2]], expectedValue: [3, 1, null, null, 2] },
    { arguments: [[3, 1, 4, null, null, 2]], expectedValue: [2, 1, 4, null, null, 3] }
  ],
  "flatten-binary-tree-to-linked-list": [
    { arguments: [[1, 2, 5, 3, 4, null, 6]], expectedValue: [1, null, 2, null, 3, null, 4, null, 5, null, 6] },
    { arguments: [[]], expectedValue: [] },
    { arguments: [[0]], expectedValue: [0] }
  ],
  "construct-binary-tree-from-preorder-and-inorder-traversal": [
    { arguments: [[3, 9, 20, 15, 7], [9, 3, 15, 20, 7]], expectedValue: [3, 9, 20, null, null, 15, 7] },
    { arguments: [[-1], [-1]], expectedValue: [-1] }
  ],
  "serialize-and-deserialize-binary-tree": [
    { arguments: [[1, 2, 3, null, null, 4, 5]], expectedValue: [1, 2, 3, null, null, 4, 5] },
    { arguments: [[]], expectedValue: [] }
  ],
  "lowest-common-ancestor-of-a-binary-tree": [
    { arguments: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 1], expectedValue: 3 },
    { arguments: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 4], expectedValue: 5 }
  ],
  "all-nodes-distance-k-in-binary-tree": [
    { arguments: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 2], expectedValue: [7, 4, 1], comparison: "unordered" },
    { arguments: [[1], 1, 3], expectedValue: [] }
  ],
  "path-sum-iii": [
    { arguments: [[10, 5, -3, 3, 2, null, 11, 3, -2, null, 1], 8], expectedValue: 3 },
    { arguments: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1], 22], expectedValue: 3 }
  ],
  "house-robber-iii": [
    { arguments: [[3, 2, 3, null, 3, null, 1]], expectedValue: 7 },
    { arguments: [[3, 4, 5, 1, 3, null, 1]], expectedValue: 9 }
  ],
  "binary-tree-maximum-path-sum": [
    { arguments: [[1, 2, 3]], expectedValue: 6 },
    { arguments: [[-10, 9, 20, null, null, 15, 7]], expectedValue: 42 }
  ],
  "binary-tree-cameras": [
    { arguments: [[0, 0, null, 0, 0]], expectedValue: 1 },
    { arguments: [[0, 0, null, 0, null, 0, null, 0]], expectedValue: 2 }
  ],
  "count-complete-tree-nodes": [
    { arguments: [[1, 2, 3, 4, 5, 6]], expectedValue: 6 },
    { arguments: [[]], expectedValue: 0 }
  ],
  "vertical-order-traversal-of-a-binary-tree": [
    { arguments: [[3, 9, 20, null, null, 15, 7]], expectedValue: [[9], [3, 15], [20], [7]] },
    { arguments: [[1, 2, 3, 4, 5, 6, 7]], expectedValue: [[4], [2], [1, 5, 6], [3], [7]] }
  ],
  "last-stone-weight": [
    { arguments: [[2, 7, 4, 1, 8, 1]], expectedValue: 1 },
    { arguments: [[1]], expectedValue: 1 }
  ],
  "kth-largest-element-in-an-array": [
    { arguments: [[3, 2, 1, 5, 6, 4], 2], expectedValue: 5 },
    { arguments: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], expectedValue: 4 }
  ],
  "k-closest-points-to-origin": [
    { arguments: [[[1, 3], [-2, 2]], 1], expectedValue: [[-2, 2]] },
    { arguments: [[[3, 3], [5, -1], [-2, 4]], 2], expectedValue: [[[3, 3], [-2, 4]], [[-2, 4], [3, 3]]], comparison: "one-of" }
  ],
  "top-k-frequent-elements": [
    { arguments: [[1, 1, 1, 2, 2, 3], 2], expectedValue: [1, 2], comparison: "unordered" },
    { arguments: [[1], 1], expectedValue: [1] }
  ],
  "top-k-frequent-words": [
    { arguments: [["i", "love", "leetcode", "i", "love", "coding"], 2], expectedValue: ["i", "love"] },
    { arguments: [["the", "day", "is", "sunny", "the", "the", "sunny", "is", "is"], 4], expectedValue: ["is", "the", "sunny", "day"] }
  ],
  "task-scheduler": [
    { arguments: [["A", "A", "A", "B", "B", "B"], 2], expectedValue: 8 },
    { arguments: [["A", "A", "A", "B", "B", "B"], 0], expectedValue: 6 }
  ],
  "reorganize-string": [
    { arguments: ["aab"], expectedValue: "aba" },
    { arguments: ["aaab"], expectedValue: "" }
  ],
  "find-median-from-data-stream": [
    { arguments: [[1, 2, 3]], expectedValue: 2 },
    { arguments: [[5, 5]], expectedValue: 5 }
  ],
  "ipo": [
    { arguments: [2, 0, [1, 2, 3], [0, 1, 1]], expectedValue: 4 },
    { arguments: [3, 0, [1, 2, 3], [0, 1, 2]], expectedValue: 6 }
  ],
  "number-of-islands": [
    { arguments: [[["1", "1", "1", "1", "0"], ["1", "1", "0", "1", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "0", "0", "0"]]], expectedValue: 1 },
    { arguments: [[["1", "1", "0", "0", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "1", "0", "0"], ["0", "0", "0", "1", "1"]]], expectedValue: 3 }
  ]
};

export function structuredCasesForBatch7(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch7[slug];
  return cases?.length === examples.length ? cases : structuredCasesForBatch8(slug, examples);
}
