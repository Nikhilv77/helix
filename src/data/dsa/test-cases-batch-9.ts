import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";

export const structuredDsaTestCasesBatch9: Record<string, StructuredDsaTestCase[]> = {
  "target-sum": [
    { arguments: [[1, 1, 1, 1, 1], 3], expectedValue: 5 },
    { arguments: [[1], 1], expectedValue: 1 }
  ],
  "word-break": [
    { arguments: ["leetcode", ["leet", "code"]], expectedValue: true },
    { arguments: ["applepenapple", ["apple", "pen"]], expectedValue: true },
    { arguments: ["catsandog", ["cats", "dog", "sand", "and", "cat"]], expectedValue: false }
  ],
  "longest-increasing-subsequence": [
    { arguments: [[10, 9, 2, 5, 3, 7, 101, 18]], expectedValue: 4 },
    { arguments: [[0, 1, 0, 3, 2, 3]], expectedValue: 4 }
  ],
  "longest-common-subsequence": [
    { arguments: ["abcde", "ace"], expectedValue: 3 },
    { arguments: ["abc", "abc"], expectedValue: 3 },
    { arguments: ["abc", "def"], expectedValue: 0 }
  ],
  "longest-palindromic-subsequence": [
    { arguments: ["bbbab"], expectedValue: 4 },
    { arguments: ["cbbd"], expectedValue: 2 }
  ],
  "edit-distance": [
    { arguments: ["horse", "ros"], expectedValue: 3 },
    { arguments: ["intention", "execution"], expectedValue: 5 }
  ],
  "interleaving-string": [
    { arguments: ["aabcc", "dbbca", "aadbbcbcac"], expectedValue: true },
    { arguments: ["aabcc", "dbbca", "aadbbbaccc"], expectedValue: false }
  ],
  "palindromic-substrings": [
    { arguments: ["abc"], expectedValue: 3 },
    { arguments: ["aaa"], expectedValue: 6 }
  ],
  "best-time-to-buy-and-sell-stock-ii": [
    { arguments: [[7, 1, 5, 3, 6, 4]], expectedValue: 7 },
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: 4 },
    { arguments: [[7, 6, 4, 3, 1]], expectedValue: 0 }
  ],
  "best-time-to-buy-and-sell-stock-with-cooldown": [
    { arguments: [[1, 2, 3, 0, 2]], expectedValue: 3 },
    { arguments: [[1]], expectedValue: 0 }
  ],
  "best-time-to-buy-and-sell-stock-iii": [
    { arguments: [[3, 3, 5, 0, 0, 3, 1, 4]], expectedValue: 6 },
    { arguments: [[1, 2, 3, 4, 5]], expectedValue: 4 }
  ],
  "burst-balloons": [
    { arguments: [[3, 1, 5, 8]], expectedValue: 167 },
    { arguments: [[1, 5]], expectedValue: 10 }
  ],
  "regular-expression-matching": [
    { arguments: ["aa", "a"], expectedValue: false },
    { arguments: ["aa", "a*"], expectedValue: true },
    { arguments: ["ab", ".*"], expectedValue: true }
  ],
  "implement-trie-prefix-tree": [
    { arguments: [["insert", "apple"], ["search", "apple"], ["search", "app"], ["startsWith", "app"], ["insert", "app"], ["search", "app"]], expectedValue: [null, true, false, true, null, true] },
    { arguments: [["insert", "cat"], ["startsWith", "car"]], expectedValue: [null, false] }
  ],
  "design-add-and-search-words-data-structure": [
    { arguments: [["addWord", "bad"], ["addWord", "dad"], ["addWord", "mad"], ["search", "pad"], ["search", "bad"], ["search", ".ad"], ["search", "b.."]], expectedValue: [null, null, null, false, true, true, true] },
    { arguments: [["addWord", "a"], ["search", "."], ["search", "b"]], expectedValue: [null, true, false] }
  ],
  "subsets": [
    { arguments: [[1, 2, 3]], expectedValue: [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]], comparison: "unordered-nested" },
    { arguments: [[0]], expectedValue: [[], [0]], comparison: "unordered-nested" }
  ],
  "combination-sum": [
    { arguments: [[2, 3, 6, 7], 7], expectedValue: [[2, 2, 3], [7]], comparison: "unordered-nested" },
    { arguments: [[2, 3, 5], 8], expectedValue: [[2, 2, 2, 2], [2, 3, 3], [3, 5]], comparison: "unordered-nested" }
  ],
  "permutations": [
    { arguments: [[1, 2, 3]], expectedValue: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]], comparison: "unordered-nested" },
    { arguments: [[0, 1]], expectedValue: [[0, 1], [1, 0]], comparison: "unordered-nested" }
  ],
  "word-search-ii": [
    { arguments: [[["o", "a", "a", "n"], ["e", "t", "a", "e"], ["i", "h", "k", "r"], ["i", "f", "l", "v"]], ["oath", "pea", "eat", "rain"]], expectedValue: ["eat", "oath"], comparison: "unordered" },
    { arguments: [[["a", "b"], ["c", "d"]], ["abcb"]], expectedValue: [] }
  ],
  "n-queens": [
    { arguments: [4], expectedValue: [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]], comparison: "unordered-nested" },
    { arguments: [1], expectedValue: [["Q"]] }
  ]
};

export function structuredCasesForBatch9(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch9[slug];
  return cases?.length === examples.length ? cases : null;
}
