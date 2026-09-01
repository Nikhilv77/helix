import type { DsaExample } from "@/lib/dsa/dsa";
import type { StructuredDsaTestCase } from "./test-cases-batch-1";
import { structuredCasesForBatch9 } from "./test-cases-batch-9";

export const structuredDsaTestCasesBatch8: Record<string, StructuredDsaTestCase[]> = {
  "max-area-of-island": [
    { arguments: [[[0, 0, 1, 0, 0], [1, 1, 1, 0, 1], [0, 1, 0, 0, 1]]], expectedValue: 5 },
    { arguments: [[[0, 0, 0, 0, 0]]], expectedValue: 0 }
  ],
  "surrounded-regions": [
    { arguments: [[["X", "X", "X", "X"], ["X", "O", "O", "X"], ["X", "X", "O", "X"], ["X", "O", "X", "X"]]], expectedValue: [["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "O", "X", "X"]], mode: "mutated-first-argument" },
    { arguments: [[["X"]]], expectedValue: [["X"]], mode: "mutated-first-argument" }
  ],
  "rotting-oranges": [
    { arguments: [[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], expectedValue: 4 },
    { arguments: [[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], expectedValue: -1 },
    { arguments: [[[0, 2]]], expectedValue: 0 }
  ],
  "pacific-atlantic-water-flow": [
    { arguments: [[[1, 2, 2, 3, 5], [3, 2, 3, 4, 4], [2, 4, 5, 3, 1], [6, 7, 1, 4, 5], [5, 1, 1, 2, 4]]], expectedValue: [[0, 4], [1, 3], [1, 4], [2, 2], [3, 0], [3, 1], [4, 0]], comparison: "unordered-nested" },
    { arguments: [[[1]]], expectedValue: [[0, 0]] }
  ],
  "word-search": [
    { arguments: [[["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "ABCCED"], expectedValue: true },
    { arguments: [[["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "ABCB"], expectedValue: false }
  ],
  "clone-graph": [
    { arguments: [[[2, 4], [1, 3], [2, 4], [1, 3]]], expectedValue: [[2, 4], [1, 3], [2, 4], [1, 3]] },
    { arguments: [[[]]], expectedValue: [[]] },
    { arguments: [[]], expectedValue: [] }
  ],
  "number-of-connected-components-in-an-undirected-graph": [
    { arguments: [5, [[0, 1], [1, 2], [3, 4]]], expectedValue: 2 },
    { arguments: [5, [[0, 1], [1, 2], [2, 3], [3, 4]]], expectedValue: 1 }
  ],
  "graph-valid-tree": [
    { arguments: [5, [[0, 1], [0, 2], [0, 3], [1, 4]]], expectedValue: true },
    { arguments: [5, [[0, 1], [1, 2], [2, 3], [1, 3], [1, 4]]], expectedValue: false }
  ],
  "redundant-connection": [
    { arguments: [[[1, 2], [1, 3], [2, 3]]], expectedValue: [2, 3] },
    { arguments: [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]], expectedValue: [1, 4] }
  ],
  "accounts-merge": [
    { arguments: [[["John", "johnsmith@mail.com", "john_newyork@mail.com"], ["John", "johnsmith@mail.com", "john00@mail.com"], ["Mary", "mary@mail.com"], ["John", "johnnybravo@mail.com"]]], expectedValue: [["John", "john00@mail.com", "john_newyork@mail.com", "johnsmith@mail.com"], ["Mary", "mary@mail.com"], ["John", "johnnybravo@mail.com"]], comparison: "unordered-nested" },
    { arguments: [[["Gabe", "Gabe0@m.co", "Gabe3@m.co", "Gabe1@m.co"], ["Kevin", "Kevin3@m.co", "Kevin5@m.co", "Kevin0@m.co"]]], expectedValue: [["Gabe", "Gabe0@m.co", "Gabe1@m.co", "Gabe3@m.co"], ["Kevin", "Kevin0@m.co", "Kevin3@m.co", "Kevin5@m.co"]], comparison: "unordered-nested" }
  ],
  "course-schedule": [
    { arguments: [2, [[1, 0]]], expectedValue: true },
    { arguments: [2, [[1, 0], [0, 1]]], expectedValue: false }
  ],
  "course-schedule-ii": [
    { arguments: [2, [[1, 0]]], expectedValue: [0, 1] },
    { arguments: [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], expectedValue: [[0, 2, 1, 3], [0, 1, 2, 3]], comparison: "one-of" }
  ],
  "alien-dictionary": [
    { arguments: [["wrt", "wrf", "er", "ett", "rftt"]], expectedValue: "wertf" },
    { arguments: [["z", "x"]], expectedValue: "zx" },
    { arguments: [["abc", "ab"]], expectedValue: "" }
  ],
  "minimum-height-trees": [
    { arguments: [4, [[1, 0], [1, 2], [1, 3]]], expectedValue: [1] },
    { arguments: [6, [[3, 0], [3, 1], [3, 2], [3, 4], [5, 4]]], expectedValue: [3, 4], comparison: "unordered" }
  ],
  "word-ladder": [
    { arguments: ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]], expectedValue: 5 },
    { arguments: ["hit", "cog", ["hot", "dot", "dog", "lot", "log"]], expectedValue: 0 }
  ],
  "network-delay-time": [
    { arguments: [[[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2], expectedValue: 2 },
    { arguments: [[[1, 2, 1]], 2, 2], expectedValue: -1 }
  ],
  "cheapest-flights-within-k-stops": [
    { arguments: [4, [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], 0, 3, 1], expectedValue: 700 },
    { arguments: [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 0], expectedValue: 500 }
  ],
  "evaluate-division": [
    { arguments: [[["a", "b"], ["b", "c"]], [2, 3], [["a", "c"], ["b", "a"], ["a", "e"], ["a", "a"], ["x", "x"]]], expectedValue: [6, 0.5, -1, 1, -1] },
    { arguments: [[["a", "b"]], [0.5], [["a", "b"], ["b", "a"]]], expectedValue: [0.5, 2] }
  ],
  "reconstruct-itinerary": [
    { arguments: [[["MUC", "LHR"], ["JFK", "MUC"], ["SFO", "SJC"], ["LHR", "SFO"]]], expectedValue: ["JFK", "MUC", "LHR", "SFO", "SJC"] },
    { arguments: [[["JFK", "SFO"], ["JFK", "ATL"], ["SFO", "ATL"], ["ATL", "JFK"], ["ATL", "SFO"]]], expectedValue: ["JFK", "ATL", "JFK", "SFO", "ATL", "SFO"] }
  ],
  "climbing-stairs": [
    { arguments: [2], expectedValue: 2 },
    { arguments: [3], expectedValue: 3 }
  ],
  "house-robber": [
    { arguments: [[1, 2, 3, 1]], expectedValue: 4 },
    { arguments: [[2, 7, 9, 3, 1]], expectedValue: 12 }
  ],
  "house-robber-ii": [
    { arguments: [[2, 3, 2]], expectedValue: 3 },
    { arguments: [[1, 2, 3, 1]], expectedValue: 4 },
    { arguments: [[1, 2, 3]], expectedValue: 3 }
  ],
  "decode-ways": [
    { arguments: ["12"], expectedValue: 2 },
    { arguments: ["226"], expectedValue: 3 },
    { arguments: ["06"], expectedValue: 0 }
  ],
  "unique-paths": [
    { arguments: [3, 7], expectedValue: 28 },
    { arguments: [3, 2], expectedValue: 3 }
  ],
  "unique-paths-ii": [
    { arguments: [[[0, 0, 0], [0, 1, 0], [0, 0, 0]]], expectedValue: 2 },
    { arguments: [[[0, 1], [0, 0]]], expectedValue: 1 }
  ],
  "minimum-path-sum": [
    { arguments: [[[1, 3, 1], [1, 5, 1], [4, 2, 1]]], expectedValue: 7 },
    { arguments: [[[1, 2, 3], [4, 5, 6]]], expectedValue: 12 }
  ],
  "coin-change": [
    { arguments: [[1, 2, 5], 11], expectedValue: 3 },
    { arguments: [[2], 3], expectedValue: -1 },
    { arguments: [[1], 0], expectedValue: 0 }
  ],
  "coin-change-ii": [
    { arguments: [5, [1, 2, 5]], expectedValue: 4 },
    { arguments: [3, [2]], expectedValue: 0 },
    { arguments: [10, [10]], expectedValue: 1 }
  ],
  "perfect-squares": [
    { arguments: [12], expectedValue: 3 },
    { arguments: [13], expectedValue: 2 }
  ],
  "partition-equal-subset-sum": [
    { arguments: [[1, 5, 11, 5]], expectedValue: true },
    { arguments: [[1, 2, 3, 5]], expectedValue: false }
  ]
};

export function structuredCasesForBatch8(slug: string, examples: DsaExample[]): StructuredDsaTestCase[] | null {
  const cases = structuredDsaTestCasesBatch8[slug];
  // A set is valid if it covers at least the examples; extra cases are hidden.
  return cases && cases.length >= examples.length ? cases : structuredCasesForBatch9(slug, examples);
}
