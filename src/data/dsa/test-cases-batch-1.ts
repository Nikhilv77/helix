import type { DsaExample } from "@/lib/dsa/dsa";
import { structuredCasesForBatch2 } from "./test-cases-batch-2";

export interface StructuredDsaTestCase {
  arguments: unknown[];
  expectedValue: unknown;
  mode?: "return" | "mutated-first-argument";
  comparison?: "exact" | "unordered" | "unordered-nested" | "one-of";
}

type StructuredDsaTestCases = Record<string, StructuredDsaTestCase[]>;

export const structuredDsaTestCases: StructuredDsaTestCases = {
  "contains-duplicate": [
    { arguments: [[1, 2, 3, 1]], expectedValue: true },
    { arguments: [[1, 2, 3, 4]], expectedValue: false },
    { arguments: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expectedValue: true }
  ],
  "two-sum": [
    { arguments: [[2, 7, 11, 15], 9], expectedValue: [0, 1] },
    { arguments: [[3, 2, 4], 6], expectedValue: [1, 2] },
    { arguments: [[3, 3], 6], expectedValue: [0, 1] }
  ],
  "best-time-to-buy-and-sell-stock": [
    { arguments: [[7, 1, 5, 3, 6, 4]], expectedValue: 5 },
    { arguments: [[7, 6, 4, 3, 1]], expectedValue: 0 }
  ],
  "maximum-subarray": [
    { arguments: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expectedValue: 6 },
    { arguments: [[1]], expectedValue: 1 },
    { arguments: [[5, 4, -1, 7, 8]], expectedValue: 23 }
  ],
  "maximum-product-subarray": [
    { arguments: [[2, 3, -2, 4]], expectedValue: 6 },
    { arguments: [[-2, 0, -1]], expectedValue: 0 }
  ],
  "move-zeroes": [
    { arguments: [[0, 1, 0, 3, 12]], expectedValue: [1, 3, 12, 0, 0], mode: "mutated-first-argument" },
    { arguments: [[0]], expectedValue: [0], mode: "mutated-first-argument" }
  ],
  "remove-duplicates-from-sorted-array": [
    { arguments: [[1, 1, 2]], expectedValue: [1, 2], mode: "mutated-first-argument" },
    { arguments: [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], expectedValue: [0, 1, 2, 3, 4], mode: "mutated-first-argument" }
  ],
  "majority-element": [
    { arguments: [[3, 2, 3]], expectedValue: 3 },
    { arguments: [[2, 2, 1, 1, 1, 2, 2]], expectedValue: 2 }
  ],
  "missing-number": [
    { arguments: [[3, 0, 1]], expectedValue: 2 },
    { arguments: [[0, 1]], expectedValue: 2 },
    { arguments: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expectedValue: 8 }
  ],
  "product-of-array-except-self": [
    { arguments: [[1, 2, 3, 4]], expectedValue: [24, 12, 8, 6] },
    { arguments: [[-1, 1, 0, -3, 3]], expectedValue: [0, 0, 9, 0, 0] }
  ]
};

export function structuredCasesFor(
  slug: string,
  examples: DsaExample[]
): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCases[slug];
  if (cases?.length === examples.length) return cases;
  return structuredCasesForBatch2(slug, examples);
}
