import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch4 } from "./test-cases-batch-4";

type Batch3Case = StructuredDsaTestCase;

export const structuredDsaTestCasesBatch3: Record<string, Batch3Case[]> = {
  "string-compression": [
    { arguments: [["a", "a", "b", "b", "c", "c", "c"]], expectedValue: ["a", "2", "b", "2", "c", "3"], mode: "mutated-first-argument" },
    { arguments: [["a"]], expectedValue: ["a"], mode: "mutated-first-argument" },
    { arguments: [["a", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b"]], expectedValue: ["a", "b", "1", "2"], mode: "mutated-first-argument" }
  ],
  "longest-substring-without-repeating-characters": [
    { arguments: ["abcabcbb"], expectedValue: 3 },
    { arguments: ["bbbbb"], expectedValue: 1 },
    { arguments: ["pwwkew"], expectedValue: 3 }
  ],
  "find-all-anagrams-in-a-string": [
    { arguments: ["cbaebabacd", "abc"], expectedValue: [0, 6] },
    { arguments: ["abab", "ab"], expectedValue: [0, 1, 2] }
  ],
  "permutation-in-string": [
    { arguments: ["ab", "eidbaooo"], expectedValue: true },
    { arguments: ["ab", "eidboaoo"], expectedValue: false }
  ],
  "minimum-window-substring": [
    { arguments: ["ADOBECODEBANC", "ABC"], expectedValue: "BANC" },
    { arguments: ["a", "a"], expectedValue: "a" },
    { arguments: ["a", "aa"], expectedValue: "" }
  ],
  "longest-palindromic-substring": [
    { arguments: ["babad"], expectedValue: ["bab", "aba"], comparison: "one-of" },
    { arguments: ["cbbd"], expectedValue: "bb" }
  ],
  "roman-to-integer": [
    { arguments: ["III"], expectedValue: 3 },
    { arguments: ["LVIII"], expectedValue: 58 },
    { arguments: ["MCMXCIV"], expectedValue: 1994 }
  ],
  "integer-to-roman": [
    { arguments: [3], expectedValue: "III" },
    { arguments: [58], expectedValue: "LVIII" },
    { arguments: [1994], expectedValue: "MCMXCIV" }
  ],
  "compare-version-numbers": [
    { arguments: ["1.01", "1.001"], expectedValue: 0 },
    { arguments: ["1.0", "1.0.0"], expectedValue: 0 },
    { arguments: ["0.1", "1.1"], expectedValue: -1 }
  ],
  "count-and-say": [
    { arguments: [1], expectedValue: "1" },
    { arguments: [4], expectedValue: "1211" },
    { arguments: [5], expectedValue: "111221" }
  ],
  "zigzag-conversion": [
    { arguments: ["PAYPALISHIRING", 3], expectedValue: "PAHNAPLSIIGYIR" },
    { arguments: ["PAYPALISHIRING", 4], expectedValue: "PINALSIGYAHRPI" },
    { arguments: ["A", 1], expectedValue: "A" }
  ],
  "decode-string": [
    { arguments: ["3[a]2[bc]"], expectedValue: "aaabcbc" },
    { arguments: ["3[a2[c]]"], expectedValue: "accaccacc" },
    { arguments: ["2[abc]3[cd]ef"], expectedValue: "abcabccdcdcdef" }
  ],
  "multiply-strings": [
    { arguments: ["2", "3"], expectedValue: "6" },
    { arguments: ["123", "456"], expectedValue: "56088" }
  ],
  "find-the-index-of-the-first-occurrence-in-a-string": [
    { arguments: ["sadbutsad", "sad"], expectedValue: 0 },
    { arguments: ["leetcode", "leeto"], expectedValue: -1 },
    { arguments: ["a", "a"], expectedValue: 0 }
  ],
  "text-justification": [
    { arguments: [["This", "is", "an", "example", "of", "text", "justification."], 16], expectedValue: ["This    is    an", "example  of text", "justification.  "] },
    { arguments: [["What", "must", "be", "acknowledgment", "shall", "be"], 16], expectedValue: ["What   must   be", "acknowledgment  ", "shall be        "] }
  ],
  "maximum-average-subarray-i": [
    { arguments: [[1, 12, -5, -6, 50, 3], 4], expectedValue: 12.75 },
    { arguments: [[5], 1], expectedValue: 5 }
  ],
  "grumpy-bookstore-owner": [
    { arguments: [[1, 0, 1, 2, 1, 1, 7, 5], [0, 1, 0, 1, 0, 1, 0, 1], 3], expectedValue: 16 },
    { arguments: [[1], [0], 1], expectedValue: 1 }
  ],
  "repeated-dna-sequences": [
    { arguments: ["AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT"], expectedValue: ["AAAAACCCCC", "CCCCCAAAAA"], comparison: "unordered" },
    { arguments: ["AAAAAAAAAAAAA"], expectedValue: ["AAAAAAAAAA"] }
  ],
  "minimum-size-subarray-sum": [
    { arguments: [7, [2, 3, 1, 2, 4, 3]], expectedValue: 2 },
    { arguments: [4, [1, 4, 4]], expectedValue: 1 },
    { arguments: [11, [1, 1, 1, 1, 1, 1, 1, 1]], expectedValue: 0 }
  ],
  "max-consecutive-ones-iii": [
    { arguments: [[1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], 2], expectedValue: 6 },
    { arguments: [[0, 0, 1, 1, 1, 0, 0], 0], expectedValue: 3 }
  ]
};

export function structuredCasesForBatch3(slug: string, examples: DsaExample[]): Batch3Case[] | null {
  const cases = structuredDsaTestCasesBatch3[slug];
  // A set is valid if it covers at least the examples; extra cases are hidden.
  if (cases && cases.length >= examples.length) return cases;
  return structuredCasesForBatch4(slug, examples);
}
