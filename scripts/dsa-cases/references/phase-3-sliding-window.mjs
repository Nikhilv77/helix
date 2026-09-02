/**
 * Reference solutions and input generators for Phase 3 — Sliding Window.
 *
 *
 * One hazard specific to this phase — **floating point**. `maximum-average-
 * subarray-i` returns a double, and the harness compares expected values by
 * exact JSON equality across four languages. Generated inputs are therefore
 * restricted to ones whose answer is a whole number; the authored 12.75 case
 * already covers the fractional path and proves the four runtimes agree on it.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

const randomString = (n, alphabet, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
};

export const phase3 = {
  "maximum-average-subarray-i": {
    solve: (nums, k) => {
      let window = 0;
      for (let i = 0; i < k; i++) window += nums[i];
      let best = window;
      for (let i = k; i < nums.length; i++) {
        window += nums[i] - nums[i - k];
        best = Math.max(best, window);
      }
      return best / k;
    },
    /**
     * Only whole-number answers. A value like 1/3 differs in the last bit
     * between the four runtimes' printers, and the harness compares exactly —
     * so the case would fail a correct solution for reasons that have nothing
     * to do with sliding windows.
     */
    generate: () =>
      [
        [[1], 1],
        [[0, 0, 0], 2],
        [[-1, -2, -3], 1],
        [[5, 5, 5, 5], 4],
        [[-10, 10, -10, 10], 2],
        [[4, 0, 4, 0, 4, 0], 3],
        [randomInts(2_000, -100, 100, 61).map((value) => value * 2), 2]
      ].filter(([nums, k]) => {
        let window = 0;
        for (let i = 0; i < k; i++) window += nums[i];
        let best = window;
        for (let i = k; i < nums.length; i++) {
          window += nums[i] - nums[i - k];
          best = Math.max(best, window);
        }
        return best % k === 0;
      })
  },

  "grumpy-bookstore-owner": {
    solve: (customers, grumpy, minutes) => {
      let base = 0;
      for (let i = 0; i < customers.length; i++) if (grumpy[i] === 0) base += customers[i];
      let window = 0;
      let best = 0;
      for (let i = 0; i < customers.length; i++) {
        if (grumpy[i] === 1) window += customers[i];
        if (i >= minutes && grumpy[i - minutes] === 1) window -= customers[i - minutes];
        best = Math.max(best, window);
      }
      return base + best;
    },
    generate: () => [
      [[1], [1], 1],
      [[0], [1], 1],
      [[1, 2, 3], [0, 0, 0], 2],
      [[1, 2, 3], [1, 1, 1], 3],
      // The window is longer than the array — every grumpy minute is covered.
      [[4, 10, 10], [1, 1, 1], 10],
      [[2, 6, 6, 9], [0, 0, 1, 1], 1],
      [
        randomInts(1_000, 0, 500, 67),
        randomInts(1_000, 0, 1, 71),
        50
      ]
    ]
  },

  "repeated-dna-sequences": {
    // The problem fixes no order for the returned sequences.
    comparison: "unordered",
    solve: (s) => {
      const seen = new Set();
      const repeated = new Set();
      for (let i = 0; i + 10 <= s.length; i++) {
        const window = s.slice(i, i + 10);
        if (seen.has(window)) repeated.add(window);
        else seen.add(window);
      }
      return [...repeated];
    },
    generate: () => [
      [""],
      ["AAAAAAAAA"],
      ["AAAAAAAAAA"],
      ["AAAAAAAAAAA"],
      ["ACGTACGTAC"],
      ["ACGTACGTACACGTACGTAC"],
      ["AAAAACCCCCAAAAACCCCCCAAAAAGGGTTTAAAAACCCCC"],
      ["ACGT".repeat(500)]
    ]
  },

  "minimum-size-subarray-sum": {
    // The window is the answer; a nested restart from every index is 4*10^10 steps.
    scale: () => [
      { arguments: [1_000_000, [1]], build: [null, { ints: { n: 200_000, lo: 1, hi: 100, seed: 29 } }] }
    ],

    // Argument order is (target, nums), matching the authored cases.
    solve: (target, nums) => {
      let start = 0;
      let sum = 0;
      let best = Infinity;
      for (let end = 0; end < nums.length; end++) {
        sum += nums[end];
        while (sum >= target) {
          best = Math.min(best, end - start + 1);
          sum -= nums[start++];
        }
      }
      return best === Infinity ? 0 : best;
    },
    generate: () => [
      [1, []],
      [1, [1]],
      [2, [1]],
      [1, [0, 0, 1]],
      [11, [1, 2, 3, 4, 5]],
      [15, [1, 2, 3, 4, 5]],
      [16, [1, 2, 3, 4, 5]],
      // The answer is the whole array; an off-by-one on the shrink loop misses it.
      [2_000, Array.from({ length: 2_000 }, () => 1)]
    ]
  },

  "max-consecutive-ones-iii": {
    scale: () => [
      { arguments: [[0], 5_000], build: [{ ints: { n: 200_000, lo: 0, hi: 1, seed: 31 } }, null] }
    ],

    solve: (nums, k) => {
      let start = 0;
      let zeros = 0;
      let best = 0;
      for (let end = 0; end < nums.length; end++) {
        if (nums[end] === 0) zeros++;
        while (zeros > k) if (nums[start++] === 0) zeros--;
        best = Math.max(best, end - start + 1);
      }
      return best;
    },
    generate: () => [
      [[], 0],
      [[0], 0],
      [[0], 1],
      [[1], 0],
      [[0, 0, 0], 3],
      [[1, 1, 1], 0],
      // More budget than there are zeros — the answer is the whole array.
      [[1, 0, 1, 0, 1], 10],
      [randomInts(2_000, 0, 1, 73), 5]
    ]
  },

  "fruit-into-baskets": {
    scale: () => [
      { arguments: [[0]], build: [{ ints: { n: 200_000, lo: 0, hi: 20, seed: 37 } }] }
    ],

    solve: (fruits) => {
      const counts = new Map();
      let start = 0;
      let best = 0;
      for (let end = 0; end < fruits.length; end++) {
        counts.set(fruits[end], (counts.get(fruits[end]) ?? 0) + 1);
        while (counts.size > 2) {
          const leaving = fruits[start++];
          const remaining = counts.get(leaving) - 1;
          if (remaining === 0) counts.delete(leaving);
          else counts.set(leaving, remaining);
        }
        best = Math.max(best, end - start + 1);
      }
      return best;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 1, 1]],
      [[1, 2]],
      [[1, 2, 3]],
      // Three types where the best pair is not the first pair seen.
      [[3, 3, 3, 1, 2, 1, 1, 2, 3, 3, 4]],
      [[1, 2, 1, 2, 1, 2, 3, 3, 3, 3]],
      [randomInts(2_000, 0, 4, 79)]
    ]
  },

  "longest-repeating-character-replacement": {
    solve: (s, k) => {
      const counts = new Map();
      let start = 0;
      let mostFrequent = 0;
      let best = 0;
      for (let end = 0; end < s.length; end++) {
        counts.set(s[end], (counts.get(s[end]) ?? 0) + 1);
        mostFrequent = Math.max(mostFrequent, counts.get(s[end]));
        while (end - start + 1 - mostFrequent > k) {
          counts.set(s[start], counts.get(s[start]) - 1);
          start++;
          // Recomputed rather than carried: the classic solution never shrinks
          // `mostFrequent`, which is correct for the answer but not for a
          // reference that has to be right for its own sake.
          mostFrequent = Math.max(...counts.values());
        }
        best = Math.max(best, end - start + 1);
      }
      return best;
    },
    generate: () => [
      ["", 0],
      ["A", 0],
      ["A", 5],
      ["AB", 0],
      ["AAAA", 2],
      ["ABCDE", 1],
      ["ABBB", 2],
      [randomString(2_000, "ABCD", 83), 3]
    ]
  },

  "subarray-product-less-than-k": {
    solve: (nums, k) => {
      if (k <= 1) return 0;
      let product = 1;
      let start = 0;
      let total = 0;
      for (let end = 0; end < nums.length; end++) {
        product *= nums[end];
        while (product >= k) product /= nums[start++];
        // Every subarray ending at `end` and starting at or after `start`.
        total += end - start + 1;
      }
      return total;
    },
    generate: () => [
      [[], 100],
      [[1], 1],
      [[1], 2],
      [[10], 5],
      [[1, 1, 1], 2],
      [[1, 2, 3], 1],
      [[10, 9, 10, 4, 3, 8, 2], 19],
      // All ones with a large bound — every subarray counts, n(n+1)/2 of them.
      [Array.from({ length: 300 }, () => 1), 2]
    ]
  },

  "binary-subarrays-with-sum": {
    solve: (nums, goal) => {
      const prefixCounts = new Map([[0, 1]]);
      let running = 0;
      let total = 0;
      for (const value of nums) {
        running += value;
        total += prefixCounts.get(running - goal) ?? 0;
        prefixCounts.set(running, (prefixCounts.get(running) ?? 0) + 1);
      }
      return total;
    },
    generate: () => [
      [[], 0],
      [[0], 0],
      [[1], 0],
      [[1], 1],
      [[1, 1, 1], 2],
      [[0, 1, 0], 1],
      // goal = 0 with zeros present is where the two-pointer variants break.
      [[0, 0, 1, 0, 0], 0],
      [[1, 0, 1, 0, 1], 0],
      [randomInts(1_000, 0, 1, 89), 10]
    ]
  },

  "count-number-of-nice-subarrays": {
    solve: (nums, k) => {
      const prefixCounts = new Map([[0, 1]]);
      let odds = 0;
      let total = 0;
      for (const value of nums) {
        odds += value % 2;
        total += prefixCounts.get(odds - k) ?? 0;
        prefixCounts.set(odds, (prefixCounts.get(odds) ?? 0) + 1);
      }
      return total;
    },
    generate: () => [
      [[], 1],
      [[1], 1],
      [[2], 1],
      [[1, 1], 1],
      [[2, 2, 2], 0],
      [[1, 2, 3, 4, 5], 2],
      [[1, 1, 1, 1, 1], 1],
      [randomInts(1_000, 1, 10, 97), 3]
    ]
  },

  "frequency-of-the-most-frequent-element": {
    solve: (nums, k) => {
      const sorted = [...nums].sort((a, b) => a - b);
      let start = 0;
      let sum = 0;
      let best = 1;
      for (let end = 0; end < sorted.length; end++) {
        sum += sorted[end];
        // Cost of raising every element in the window to sorted[end].
        while (sorted[end] * (end - start + 1) - sum > k) sum -= sorted[start++];
        best = Math.max(best, end - start + 1);
      }
      return best;
    },
    generate: () => [
      [[1], 0],
      [[1, 1, 1], 0],
      [[1, 2, 3], 0],
      [[5, 5, 4], 1],
      [[1, 100], 98],
      [[1, 100], 99],
      // Already equal — the answer is the whole array with no operations.
      [Array.from({ length: 500 }, () => 7), 0],
      [randomInts(1_000, 1, 1_000, 101), 10_000]
    ]
  },

  "find-k-closest-elements": {
    solve: (arr, k, x) => {
      let lo = 0;
      let hi = arr.length - k;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        // A tie goes to the smaller element, which is what the problem asks for.
        if (x - arr[mid] > arr[mid + k] - x) lo = mid + 1;
        else hi = mid;
      }
      return arr.slice(lo, lo + k);
    },
    generate: () => [
      [[1], 1, 1],
      [[1, 2], 1, 1],
      [[1, 2], 2, 100],
      [[1, 1, 1, 10, 10, 10], 1, 9],
      // x sits exactly between two candidates; the smaller one wins.
      [[1, 3], 1, 2],
      [[0, 0, 1, 2, 3, 3, 4, 7, 7, 8], 3, 5],
      [Array.from({ length: 1_000 }, (_, i) => i), 5, 500],
      [Array.from({ length: 1_000 }, (_, i) => i), 1_000, 0]
    ]
  },

  "sliding-window-maximum": {
    solve: (nums, k) => {
      const deque = [];
      const out = [];
      for (let i = 0; i < nums.length; i++) {
        while (deque.length && deque[0] <= i - k) deque.shift();
        while (deque.length && nums[deque[deque.length - 1]] <= nums[i]) deque.pop();
        deque.push(i);
        if (i >= k - 1) out.push(nums[deque[0]]);
      }
      return out;
    },
    generate: () => [
      [[1, 2], 1],
      [[1, 2], 2],
      [[2, 1], 2],
      [[5, 5, 5, 5], 2],
      [[-7, -8, 7, 5, 7, 1, 6, 0], 4],
      // Strictly decreasing: the window maximum is always the element leaving.
      [Array.from({ length: 500 }, (_, i) => 500 - i), 3],
      [Array.from({ length: 500 }, (_, i) => i), 500],
      [randomInts(1_000, -100, 100, 103), 7]
    ]
  }
};
