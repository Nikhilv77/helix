import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch5 } from "./test-cases-batch-5";

export const structuredDsaTestCasesBatch4: Record<string, StructuredDsaTestCase[]> = {
  "fruit-into-baskets": [
    { arguments: [[1, 2, 1]], expectedValue: 3 },
    { arguments: [[0, 1, 2, 2]], expectedValue: 3 },
    { arguments: [[1, 2, 3, 2, 2]], expectedValue: 4 }
  ],
  "longest-repeating-character-replacement": [
    { arguments: ["ABAB", 2], expectedValue: 4 },
    { arguments: ["AABABBA", 1], expectedValue: 4 }
  ],
  "subarray-product-less-than-k": [
    { arguments: [[10, 5, 2, 6], 100], expectedValue: 8 },
    { arguments: [[1, 2, 3], 0], expectedValue: 0 }
  ],
  "binary-subarrays-with-sum": [
    { arguments: [[1, 0, 1, 0, 1], 2], expectedValue: 4 },
    { arguments: [[0, 0, 0, 0, 0], 0], expectedValue: 15 }
  ],
  "count-number-of-nice-subarrays": [
    { arguments: [[1, 1, 2, 1, 1], 3], expectedValue: 2 },
    { arguments: [[2, 4, 6], 1], expectedValue: 0 },
    { arguments: [[2, 2, 2, 1, 2, 2, 1, 2, 2, 2], 2], expectedValue: 16 }
  ],
  "frequency-of-the-most-frequent-element": [
    { arguments: [[1, 2, 4], 5], expectedValue: 3 },
    { arguments: [[1, 4, 8, 13], 5], expectedValue: 2 },
    { arguments: [[3, 9, 6], 2], expectedValue: 1 }
  ],
  "find-k-closest-elements": [
    { arguments: [[1, 2, 3, 4, 5], 4, 3], expectedValue: [1, 2, 3, 4] },
    { arguments: [[1, 2, 3, 4, 5], 4, -1], expectedValue: [1, 2, 3, 4] }
  ],
  "sliding-window-maximum": [
    { arguments: [[1, 3, -1, -3, 5, 3, 6, 7], 3], expectedValue: [3, 3, 5, 5, 6, 7] },
    { arguments: [[1], 1], expectedValue: [1] }
  ],
  "binary-search": [
    { arguments: [[-1, 0, 3, 5, 9, 12], 9], expectedValue: 4 },
    { arguments: [[-1, 0, 3, 5, 9, 12], 2], expectedValue: -1 }
  ],
  "search-insert-position": [
    { arguments: [[1, 3, 5, 6], 5], expectedValue: 2 },
    { arguments: [[1, 3, 5, 6], 2], expectedValue: 1 },
    { arguments: [[1, 3, 5, 6], 7], expectedValue: 4 }
  ],
  "guess-number-higher-or-lower": [
    { arguments: [10, 6], expectedValue: 6 },
    { arguments: [1, 1], expectedValue: 1 }
  ],
  "first-bad-version": [
    { arguments: [5, 4], expectedValue: 4 },
    { arguments: [1, 1], expectedValue: 1 }
  ],
  "find-first-and-last-position-of-element-in-sorted-array": [
    { arguments: [[5, 7, 7, 8, 8, 10], 8], expectedValue: [3, 4] },
    { arguments: [[5, 7, 7, 8, 8, 10], 6], expectedValue: [-1, -1] },
    { arguments: [[], 0], expectedValue: [-1, -1] }
  ],
  "time-based-key-value-store": [
    { arguments: [["set", "foo", "bar", 1], ["get", "foo", 1], ["get", "foo", 3]], expectedValue: [null, "bar", "bar"] },
    { arguments: [["set", "foo", "bar2", 4], ["get", "foo", 4], ["get", "foo", 5]], expectedValue: [null, "bar2", "bar2"] }
  ],
  "search-a-2d-matrix": [
    { arguments: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 3], expectedValue: true },
    { arguments: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 13], expectedValue: false }
  ],
  "find-minimum-in-rotated-sorted-array": [
    { arguments: [[3, 4, 5, 1, 2]], expectedValue: 1 },
    { arguments: [[4, 5, 6, 7, 0, 1, 2]], expectedValue: 0 },
    { arguments: [[11, 13, 15, 17]], expectedValue: 11 }
  ],
  "search-in-rotated-sorted-array": [
    { arguments: [[4, 5, 6, 7, 0, 1, 2], 0], expectedValue: 4 },
    { arguments: [[4, 5, 6, 7, 0, 1, 2], 3], expectedValue: -1 },
    { arguments: [[1], 0], expectedValue: -1 }
  ],
  "peak-index-in-a-mountain-array": [
    { arguments: [[0, 1, 0]], expectedValue: 1 },
    { arguments: [[0, 2, 1, 0]], expectedValue: 1 }
  ],
  "find-peak-element": [
    { arguments: [[1, 2, 3, 1]], expectedValue: [2], comparison: "one-of" },
    { arguments: [[1, 2, 1, 3, 5, 6, 4]], expectedValue: [1, 5], comparison: "one-of" }
  ],
  "koko-eating-bananas": [
    { arguments: [[3, 6, 7, 11], 8], expectedValue: 4 },
    { arguments: [[30, 11, 23, 4, 20], 5], expectedValue: 30 },
    { arguments: [[30, 11, 23, 4, 20], 6], expectedValue: 23 }
  ]
};

export function structuredCasesForBatch4(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch4[slug];
  // A set is valid if it covers at least the examples; extra cases are hidden.
  if (cases && cases.length >= examples.length) return cases;
  return structuredCasesForBatch5(slug, examples);
}
