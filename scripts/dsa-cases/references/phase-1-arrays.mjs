/**
 * Reference solutions and input generators for Phase 1.
 *
 * A reference is the source of truth for expected values — nobody hand-writes
 * them. Every reference is first replayed against the question's existing
 * hand-authored cases; if it disagrees with even one, the question is skipped
 * and reported rather than emitted. That check runs in both directions: it
 * catches a wrong reference, and it catches a wrong original case.
 *
 * `generate` returns extra argument tuples only. Expected values come from
 * running `solve` on them.
 *
 * Sizing rule: all cases for a question share one Judge0 submission with a
 * 5 second CPU budget. Stress inputs are sized so an optimal solution finishes
 * in milliseconds and a quadratic one does not — that gap is the point.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

export const phase1 = {
  "contains-duplicate": {
    solve: (nums) => new Set(nums).size !== nums.length,
    generate: () => [
      [[1]],
      [[]],
      [[-1_000_000_000, 1_000_000_000, -1_000_000_000]],
      [[5, 5]],
      [Array.from({ length: 20_000 }, (_, i) => i)],
      [[...Array.from({ length: 20_000 }, (_, i) => i), 0]]
    ].map((args) => args)
  },

  "two-sum": {
    // Returns the single valid pair; the bank compares unordered where needed.
    solve: (nums, target) => {
      const seen = new Map();
      for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need), i];
        seen.set(nums[i], i);
      }
      return [];
    },
    generate: () => [
      [[0, 4, 3, 0], 0],
      [[-3, 4, 3, 90], 0],
      [[-1, -2, -3, -4, -5], -8],
      [[1_000_000_000, 1_000_000_000], 2_000_000_000]
    ]
  },

  "best-time-to-buy-and-sell-stock": {
    solve: (prices) => {
      let min = Infinity;
      let best = 0;
      for (const price of prices) {
        if (price < min) min = price;
        else if (price - min > best) best = price - min;
      }
      return best;
    },
    generate: () => [
      [[]],
      [[5]],
      [[2, 2, 2, 2]],
      [[1, 2, 3, 4, 5]],
      [[5, 4, 3, 2, 1]],
      [randomInts(30_000, 0, 10_000, 11)]
    ]
  },

  "maximum-subarray": {
    solve: (nums) => {
      let best = -Infinity;
      let running = 0;
      for (const value of nums) {
        running = Math.max(value, running + value);
        best = Math.max(best, running);
      }
      return best;
    },
    generate: () => [
      [[-1]],
      [[-2, -1, -3]],
      [[1]],
      [[0, 0, 0]],
      [randomInts(30_000, -1_000, 1_000, 23)]
    ]
  },

  "maximum-product-subarray": {
    solve: (nums) => {
      let best = nums[0];
      let hi = nums[0];
      let lo = nums[0];
      for (let i = 1; i < nums.length; i++) {
        const value = nums[i];
        const candidates = [value, hi * value, lo * value];
        hi = Math.max(...candidates);
        lo = Math.min(...candidates);
        best = Math.max(best, hi);
      }
      return best;
    },
    generate: () => [
      [[-2]],
      [[0, 2]],
      [[-2, 0, -1]],
      [[-2, 3, -4]],
      [[2, -5, -2, -4, 3]]
    ]
  },

  "move-zeroes": {
    mode: "mutated-first-argument",
    solve: (nums) => {
      let write = 0;
      for (let i = 0; i < nums.length; i++) if (nums[i] !== 0) nums[write++] = nums[i];
      while (write < nums.length) nums[write++] = 0;
      return nums;
    },
    generate: () => [
      [[0]],
      [[1]],
      [[0, 0, 0]],
      [[1, 2, 3]],
      [[0, 0, 1]],
      [randomInts(20_000, 0, 3, 31)]
    ]
  },

  "majority-element": {
    solve: (nums) => {
      let count = 0;
      let candidate = null;
      for (const value of nums) {
        if (count === 0) candidate = value;
        count += value === candidate ? 1 : -1;
      }
      return candidate;
    },
    generate: () => [
      [[1]],
      [[2, 2, 1, 1, 1, 2, 2]],
      [[-1, -1, 2]],
      [Array.from({ length: 20_001 }, (_, i) => (i % 2 === 0 ? 9 : i))]
    ]
  },

  "missing-number": {
    solve: (nums) => {
      const n = nums.length;
      let sum = (n * (n + 1)) / 2;
      for (const value of nums) sum -= value;
      return sum;
    },
    generate: () => [
      [[0]],
      [[1]],
      [[0, 1]],
      [[1, 0, 3, 2]],
      [Array.from({ length: 20_000 }, (_, i) => i)]
    ]
  },

  "product-of-array-except-self": {
    solve: (nums) => {
      const n = nums.length;
      const output = new Array(n).fill(1);
      let prefix = 1;
      for (let i = 0; i < n; i++) {
        output[i] = prefix;
        prefix *= nums[i];
      }
      let suffix = 1;
      for (let i = n - 1; i >= 0; i--) {
        output[i] *= suffix;
        suffix *= nums[i];
      }
      return output;
    },
    generate: () => [
      [[1, 1]],
      [[0, 0]],
      [[-1, 1, 0, -3, 3]],
      [[2, 3]],
      [[1, 0]],
      [Array.from({ length: 10_000 }, (_, i) => (i % 3) + 1)]
    ]
  }
};
