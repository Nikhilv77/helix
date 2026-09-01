import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch3 } from "./test-cases-batch-3";

export const structuredDsaTestCasesBatch2: Record<string, StructuredDsaTestCase[]> = {
  "rotate-array": [
    { arguments: [[1, 2, 3, 4, 5, 6, 7], 3], expectedValue: [5, 6, 7, 1, 2, 3, 4], mode: "mutated-first-argument" },
    { arguments: [[-1, -100, 3, 99], 2], expectedValue: [3, 99, -1, -100], mode: "mutated-first-argument" }
  ],
  "sort-colors": [
    { arguments: [[2, 0, 2, 1, 1, 0]], expectedValue: [0, 0, 1, 1, 2, 2], mode: "mutated-first-argument" },
    { arguments: [[2, 0, 1]], expectedValue: [0, 1, 2], mode: "mutated-first-argument" }
  ],
  "container-with-most-water": [
    { arguments: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expectedValue: 49 },
    { arguments: [[1, 1]], expectedValue: 1 }
  ],
  "3sum": [
    { arguments: [[-1, 0, 1, 2, -1, -4]], expectedValue: [[-1, -1, 2], [-1, 0, 1]], comparison: "unordered-nested" },
    { arguments: [[0, 1, 1]], expectedValue: [] },
    { arguments: [[0, 0, 0]], expectedValue: [[0, 0, 0]], comparison: "unordered-nested" }
  ],
  "4sum": [
    { arguments: [[1, 0, -1, 0, -2, 2], 0], expectedValue: [[-2, -1, 1, 2], [-2, 0, 0, 2], [-1, 0, 0, 1]], comparison: "unordered-nested" },
    { arguments: [[2, 2, 2, 2, 2], 8], expectedValue: [[2, 2, 2, 2]], comparison: "unordered-nested" }
  ],
  "trapping-rain-water": [
    { arguments: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expectedValue: 6 },
    { arguments: [[4, 2, 0, 3, 2, 5]], expectedValue: 9 }
  ],
  "next-permutation": [
    { arguments: [[1, 2, 3]], expectedValue: [1, 3, 2], mode: "mutated-first-argument" },
    { arguments: [[3, 2, 1]], expectedValue: [1, 2, 3], mode: "mutated-first-argument" },
    { arguments: [[1, 1, 5]], expectedValue: [1, 5, 1], mode: "mutated-first-argument" }
  ],
  "find-the-duplicate-number": [
    { arguments: [[1, 3, 4, 2, 2]], expectedValue: 2 },
    { arguments: [[3, 1, 3, 4, 2]], expectedValue: 3 },
    { arguments: [[3, 3, 3, 3, 3]], expectedValue: 3 }
  ],
  "first-missing-positive": [
    { arguments: [[1, 2, 0]], expectedValue: 3 },
    { arguments: [[3, 4, -1, 1]], expectedValue: 2 },
    { arguments: [[7, 8, 9, 11, 12]], expectedValue: 1 }
  ],
  "merge-intervals": [
    { arguments: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expectedValue: [[1, 6], [8, 10], [15, 18]] },
    { arguments: [[[1, 4], [4, 5]]], expectedValue: [[1, 5]] }
  ],
  "insert-interval": [
    { arguments: [[[1, 3], [6, 9]], [2, 5]], expectedValue: [[1, 5], [6, 9]] },
    { arguments: [[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], expectedValue: [[1, 2], [3, 10], [12, 16]] }
  ],
  "set-matrix-zeroes": [
    { arguments: [[[1, 1, 1], [1, 0, 1], [1, 1, 1]]], expectedValue: [[1, 0, 1], [0, 0, 0], [1, 0, 1]], mode: "mutated-first-argument" },
    { arguments: [[[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]]], expectedValue: [[0, 0, 0, 0], [0, 4, 5, 0], [0, 3, 1, 0]], mode: "mutated-first-argument" }
  ],
  "spiral-matrix": [
    { arguments: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], expectedValue: [1, 2, 3, 6, 9, 8, 7, 4, 5] },
    { arguments: [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]], expectedValue: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7] }
  ],
  "rotate-image": [
    { arguments: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], expectedValue: [[7, 4, 1], [8, 5, 2], [9, 6, 3]], mode: "mutated-first-argument" },
    { arguments: [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]], expectedValue: [[13, 9, 5, 1], [14, 10, 6, 2], [15, 11, 7, 3], [16, 12, 8, 4]], mode: "mutated-first-argument" }
  ],
  "game-of-life": [
    { arguments: [[[0, 1, 0], [0, 0, 1], [1, 1, 1], [0, 0, 0]]], expectedValue: [[0, 0, 0], [1, 0, 1], [0, 1, 1], [0, 1, 0]], mode: "mutated-first-argument" },
    { arguments: [[[1, 1], [1, 0]]], expectedValue: [[1, 1], [1, 1]], mode: "mutated-first-argument" }
  ],
  "valid-anagram": [
    { arguments: ["anagram", "nagaram"], expectedValue: true },
    { arguments: ["rat", "car"], expectedValue: false }
  ],
  "group-anagrams": [
    { arguments: [["eat", "tea", "tan", "ate", "nat", "bat"]], expectedValue: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]], comparison: "unordered-nested" },
    { arguments: [[""]], expectedValue: [[""]] },
    { arguments: [["a"]], expectedValue: [["a"]] }
  ],
  "valid-palindrome": [
    { arguments: ["A man, a plan, a canal: Panama"], expectedValue: true },
    { arguments: ["race a car"], expectedValue: false },
    { arguments: [" "], expectedValue: true }
  ],
  "longest-common-prefix": [
    { arguments: [["flower", "flow", "flight"]], expectedValue: "fl" },
    { arguments: [["dog", "racecar", "car"]], expectedValue: "" }
  ],
  "reverse-words-in-a-string": [
    { arguments: ["the sky is blue"], expectedValue: "blue is sky the" },
    { arguments: ["  hello world  "], expectedValue: "world hello" },
    { arguments: ["a good   example"], expectedValue: "example good a" }
  ]
};

export function structuredCasesForBatch2(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch2[slug];
  // A set is valid if it covers at least the examples; extra cases are hidden.
  if (cases && cases.length >= examples.length) return cases;
  return structuredCasesForBatch3(slug, examples);
}
