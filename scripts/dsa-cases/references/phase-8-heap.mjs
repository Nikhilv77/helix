/**
 * Reference solutions and input generators for Phase 8 — Heap / Priority Queue.
 *
 * Two questions here have more than one correct answer, handled the two ways
 * this generator supports:
 *
 *   k-closest-points-to-origin  the *set* is fixed but the order is not, so the
 *                               cases compare unordered — and generated inputs
 *                               are filtered to avoid a distance tie at the k
 *                               boundary, where which points belong is itself
 *                               ambiguous.
 *   reorganize-string           any arrangement with no two adjacent letters
 *                               equal is correct, so inputs are filtered by
 *                               brute force to those with exactly one valid
 *                               answer, plus impossible ones whose answer is "".
 *
 * `top-k-frequent-words` looks like it belongs on that list and does not: the
 * problem fixes the order — frequency descending, then lexicographic — so it
 * compares exactly.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

/** Every distinct arrangement of `s` with no two adjacent characters equal. */
function validReorganizations(s) {
  const found = new Set();
  const counts = new Map();
  for (const character of s) counts.set(character, (counts.get(character) ?? 0) + 1);
  const build = (prefix) => {
    if (prefix.length === s.length) {
      found.add(prefix);
      return;
    }
    for (const [character, remaining] of counts) {
      if (remaining === 0 || character === prefix[prefix.length - 1]) continue;
      counts.set(character, remaining - 1);
      build(prefix + character);
      counts.set(character, remaining);
    }
  };
  build("");
  return found;
}

/** True when the k-th and (k+1)-th smallest distances differ, so the set is fixed. */
function closestSetIsFixed(points, k) {
  const distances = points
    .map(([x, y]) => x * x + y * y)
    .sort((a, b) => a - b);
  return k >= points.length || distances[k - 1] !== distances[k];
}

/** True when the k-th and (k+1)-th frequencies differ, so the top k is fixed. */
function topKIsFixed(values, k) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ordered = [...counts.values()].sort((a, b) => b - a);
  return k >= ordered.length || ordered[k - 1] !== ordered[k];
}

export const phase8 = {
  "last-stone-weight": {
    solve: (stones) => {
      const heap = [...stones];
      while (heap.length > 1) {
        heap.sort((a, b) => b - a);
        const first = heap.shift();
        const second = heap.shift();
        if (first !== second) heap.push(first - second);
      }
      return heap[0] ?? 0;
    },
    generate: () => [
      [[]],
      [[5]],
      [[1, 1]],
      [[2, 2, 2]],
      // Everything cancels, and nothing does.
      [[1, 1, 2, 2, 3, 3]],
      [[1, 2, 4, 8, 16]],
      [Array.from({ length: 500 }, () => 7)],
      [randomInts(1_000, 1, 1_000, 173)]
    ]
  },

  "kth-largest-element-in-an-array": {
    // A selection sort finds the same answer and takes 2*10^10 comparisons.
    scale: () => [
      { arguments: [[0], 5_000], build: [{ ints: { n: 200_000, lo: -1_000_000, hi: 1_000_000, seed: 41 } }, null] }
    ],

    solve: (nums, k) => [...nums].sort((a, b) => b - a)[k - 1],
    generate: () => [
      [[1], 1],
      [[2, 1], 1],
      [[2, 1], 2],
      [[1, 1, 1], 2],
      // k at both ends of a long array.
      [[-1, -2, -3], 2],
      [Array.from({ length: 1_000 }, (_, i) => i), 1],
      [Array.from({ length: 1_000 }, (_, i) => i), 1_000],
      [randomInts(2_000, -500, 500, 179), 100]
    ]
  },

  "k-closest-points-to-origin": {
    // The set is fixed; the order the points come back in is not.
    comparison: "unordered-nested",
    solve: (points, k) =>
      [...points].sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1])).slice(0, k),
    generate: () =>
      [
        [[[0, 0]], 1],
        [[[1, 0], [0, 2]], 1],
        [[[1, 0], [0, 2]], 2],
        [[[3, 3], [5, -1], [-2, 4], [0, 1]], 2],
        [[[-1, -1], [2, 2], [3, 3]], 1],
        [Array.from({ length: 500 }, (_, i) => [i, 0]), 5],
        [Array.from({ length: 500 }, (_, i) => [i, i]), 500]
      ].filter(([points, k]) => closestSetIsFixed(points, k))
  },

  "top-k-frequent-elements": {
    comparison: "unordered",
    solve: (nums, k) => {
      const counts = new Map();
      for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([value]) => value);
    },
    generate: () =>
      [
        [[1, 1, 2], 1],
        [[1, 1, 2], 2],
        [[1, 2, 3], 3],
        [[-1, -1, -1, 2, 2, 3], 2],
        [[5, 5, 5, 5], 1],
        [Array.from({ length: 1_000 }, (_, i) => i % 10), 10],
        [
          [
            ...Array.from({ length: 100 }, () => 1),
            ...Array.from({ length: 50 }, () => 2),
            ...Array.from({ length: 10 }, () => 3)
          ],
          2
        ]
      ].filter(([nums, k]) => topKIsFixed(nums, k))
  },

  "top-k-frequent-words": {
    // Frequency descending, then lexicographic — a fully specified order.
    solve: (words, k) => {
      const counts = new Map();
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .slice(0, k)
        .map(([word]) => word);
    },
    generate: () => [
      [["a"], 1],
      [["b", "a"], 2],
      // Equal frequencies: the lexicographic tiebreak decides, and it is the
      // half of the comparator a frequency-only sort gets wrong.
      [["b", "a", "c"], 3],
      [["aa", "a"], 2],
      [["z", "z", "a"], 2],
      [["apple", "banana", "apple", "cherry", "banana", "apple"], 3],
      [Array.from({ length: 500 }, (_, i) => `w${i % 20}`), 20]
    ]
  },

  "task-scheduler": {
    solve: (tasks, n) => {
      const counts = new Map();
      for (const task of tasks) counts.set(task, (counts.get(task) ?? 0) + 1);
      const highest = Math.max(...counts.values());
      const atHighest = [...counts.values()].filter((count) => count === highest).length;
      // Either the idle-slot layout dominates, or there are enough distinct
      // tasks to fill every gap and the answer is just the task count.
      return Math.max(tasks.length, (highest - 1) * (n + 1) + atHighest);
    },
    generate: () => [
      [["A"], 0],
      [["A"], 100],
      [["A", "A"], 1],
      [["A", "B"], 5],
      [["A", "A", "B", "B"], 1],
      // Several tasks tied at the highest frequency.
      [["A", "A", "B", "B", "C", "C"], 2],
      [["A", "A", "A", "B", "C", "D", "E", "F"], 2],
      [Array.from({ length: 500 }, (_, i) => String.fromCharCode(65 + (i % 26))), 3]
    ]
  },

  "reorganize-string": {
    solve: (s) => {
      const counts = new Map();
      for (const character of s) counts.set(character, (counts.get(character) ?? 0) + 1);
      const highest = Math.max(...counts.values(), 0);
      if (highest > Math.ceil(s.length / 2)) return "";
      // Fill the even positions with the most frequent letter first, then the
      // odd ones; that never places two of the same letter side by side.
      const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const out = new Array(s.length);
      let index = 0;
      for (const [character, count] of ordered) {
        for (let i = 0; i < count; i++) {
          if (index >= s.length) index = 1;
          out[index] = character;
          index += 2;
        }
      }
      return out.join("");
    },
    /**
     * Only inputs with a single valid arrangement, or none at all. Anything
     * looser and a correct solution that produced a different valid string
     * would be marked wrong.
     */
    generate: () =>
      [
        ["a"],
        ["ab"],
        ["aa"],
        ["aab"],
        ["aabb"],
        ["aaab"],
        ["aaabb"],
        // a^(k+1) b^k is the family whose arrangement is forced, which is what
        // keeps a constructive answer in the set rather than only impossible ones.
        ["aaaabbb"],
        ["aaaaabbbb"],
        ["aaaaaabbbbb"],
        ["aaaabc"],
        ["aabbcc"],
        ["a".repeat(20)],
        [`${"a".repeat(11)}${"b".repeat(9)}`]
      ].filter(([s]) => validReorganizations(s).size <= 1)
  },

  "find-median-from-data-stream": {
    /**
     * The runner adds every value then asks once for the median, so the
     * expected value is a single number rather than a list.
     *
     * A median of integers is whole or exactly x.5, both binary-exact, so this
     * needs no floating-point filtering.
     */
    solve: (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    },
    generate: () => [
      [[1]],
      [[2, 1]],
      [[1, 2, 3, 4]],
      [[-1, -2, -3]],
      // Already sorted, reverse sorted, and heavily duplicated.
      [Array.from({ length: 500 }, (_, i) => i)],
      [Array.from({ length: 500 }, (_, i) => 500 - i)],
      [Array.from({ length: 501 }, () => 7)],
      [randomInts(1_000, -100, 100, 181)]
    ]
  },

  ipo: {
    solve: (k, w, profits, capital) => {
      const projects = profits
        .map((profit, index) => [capital[index], profit])
        .sort((a, b) => a[0] - b[0]);
      let available = w;
      let next = 0;
      const affordable = [];
      for (let round = 0; round < k; round++) {
        while (next < projects.length && projects[next][0] <= available) {
          affordable.push(projects[next][1]);
          next++;
        }
        if (affordable.length === 0) break;
        // Take the best project we can currently afford.
        affordable.sort((a, b) => b - a);
        available += affordable.shift();
      }
      return available;
    },
    generate: () => [
      [1, 0, [1], [0]],
      [1, 0, [1], [1]],
      [0, 5, [1, 2], [0, 0]],
      [2, 0, [1, 2, 3], [0, 0, 0]],
      // More rounds than affordable projects, and capital that only unlocks
      // later once earlier profits are banked.
      [10, 0, [1, 2, 3], [0, 1, 2]],
      [3, 1, [5, 10, 20], [2, 6, 16]],
      [5, 0, randomInts(200, 1, 100, 191), randomInts(200, 0, 50, 193)]
    ]
  }
};
