/**
 * Reference solutions and input generators for Phase 4 — Binary Search.
 *
 * Same contract as the earlier phases: every reference is replayed against the
 * question's own authored cases before it is trusted to produce anything.
 *
 * Two shapes are specific to this phase.
 *
 * **Questions with more than one right answer.** "Find *a* peak element" accepts
 * any index that is a peak. Those use the `accepted` hook, which returns the
 * whole set and is emitted with `comparison: "one-of"` — and which the generator
 * checks contains the verified reference's own answer, so it can widen an
 * answer but never invent one.
 *
 * **Questions that hide a value behind an API.** `guess-number-higher-or-lower`
 * and `first-bad-version` take the hidden value as a second argument, so their
 * reference is the identity on it. That is not a shortcut — the answer to
 * "which version first broke" genuinely is the argument the harness was given.
 *
 * `time-based-key-value-store` is the phase's one class-operation question. Its
 * `arguments` are the call sequence, which fits `solve(...operations)` directly;
 * the only thing to match is the runner reporting null for `set`.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const sortedInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1))).sort(
    (a, b) => a - b
  );
};

/** A strictly-increasing run rotated left by `k`, with distinct values. */
const rotated = (n, k) => {
  const base = Array.from({ length: n }, (_, i) => i * 2);
  const shift = ((k % n) + n) % n;
  return [...base.slice(shift), ...base.slice(0, shift)];
};

export const phase4 = {
  "binary-search": {
    solve: (nums, target) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    },
    generate: () => [
      [[], 1],
      [[1], 1],
      [[1], 2],
      [[1, 2], 1],
      [[1, 2], 2],
      // Target below and above the whole range.
      [[5, 6, 7], 4],
      [[5, 6, 7], 8],
      [Array.from({ length: 2_000 }, (_, i) => i * 3), 5_997],
      [Array.from({ length: 2_000 }, (_, i) => i * 3), 5_998]
    ]
  },

  "search-insert-position": {
    solve: (nums, target) => {
      let lo = 0;
      let hi = nums.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    generate: () => [
      [[], 1],
      [[1], 0],
      [[1], 1],
      [[1], 2],
      [[1, 3], 2],
      // Insertion at both ends of a longer array.
      [[2, 4, 6, 8], 1],
      [[2, 4, 6, 8], 9],
      [Array.from({ length: 2_000 }, (_, i) => i * 2), 1_999]
    ]
  },

  "guess-number-higher-or-lower": {
    // The pick is handed in as the second argument; the answer is that pick.
    solve: (n, pick) => pick,
    generate: () => [
      [1, 1],
      [2, 1],
      [2, 2],
      [100, 1],
      [100, 100],
      [100, 50],
      [1_000_000, 1],
      [1_000_000, 999_999],
      [2_147_483_647, 1_702_766_719]
    ]
  },

  "first-bad-version": {
    solve: (n, bad) => bad,
    generate: () => [
      [2, 1],
      [2, 2],
      [3, 2],
      [100, 1],
      [100, 100],
      // A large n where a midpoint computed as (lo + hi) would overflow int32.
      [2_126_753_390, 1_702_766_719],
      [2_147_483_647, 2_147_483_647]
    ]
  },

  "find-first-and-last-position-of-element-in-sorted-array": {
    solve: (nums, target) => {
      const bound = (findFirst) => {
        let lo = 0;
        let hi = nums.length - 1;
        let found = -1;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (nums[mid] === target) {
            found = mid;
            if (findFirst) hi = mid - 1;
            else lo = mid + 1;
          } else if (nums[mid] < target) lo = mid + 1;
          else hi = mid - 1;
        }
        return found;
      };
      return [bound(true), bound(false)];
    },
    generate: () => [
      [[1], 1],
      [[1], 2],
      [[1, 1], 1],
      [[1, 2, 3], 2],
      // Every element is the target — the range is the whole array.
      [[2, 2, 2, 2], 2],
      [[1, 2, 2, 3], 2],
      [Array.from({ length: 2_000 }, () => 5), 5],
      [Array.from({ length: 2_000 }, (_, i) => Math.floor(i / 100)), 7]
    ]
  },

  "search-a-2d-matrix": {
    solve: (matrix, target) => {
      const rows = matrix.length;
      const cols = matrix[0]?.length ?? 0;
      let lo = 0;
      let hi = rows * cols - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const value = matrix[Math.floor(mid / cols)][mid % cols];
        if (value === target) return true;
        if (value < target) lo = mid + 1;
        else hi = mid - 1;
      }
      return false;
    },
    generate: () => [
      [[[1]], 1],
      [[[1]], 2],
      [[[1, 3]], 3],
      [[[1], [3]], 3],
      [[[1, 2], [3, 4]], 0],
      [[[1, 2], [3, 4]], 5],
      // The target falls between two rows — the row-then-column search has to
      // pick the right row before concluding.
      [[[1, 3], [5, 7]], 4],
      [Array.from({ length: 40 }, (_, r) => Array.from({ length: 40 }, (_, c) => r * 40 + c)), 1_599]
    ]
  },

  "find-minimum-in-rotated-sorted-array": {
    solve: (nums) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] > nums[hi]) lo = mid + 1;
        else hi = mid;
      }
      return nums[lo];
    },
    generate: () => [
      [[1]],
      [[2, 1]],
      [[1, 2]],
      [[3, 1, 2]],
      [[2, 3, 1]],
      // Not rotated at all, and rotated by exactly its own length.
      [rotated(500, 0)],
      [rotated(500, 1)],
      [rotated(500, 499)],
      [rotated(2_000, 1_237)]
    ]
  },

  "search-in-rotated-sorted-array": {
    solve: (nums, target) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] === target) return mid;
        if (nums[lo] <= nums[mid]) {
          // Left half is sorted.
          if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
          else lo = mid + 1;
        } else {
          if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
          else hi = mid - 1;
        }
      }
      return -1;
    },
    generate: () => [
      [[], 1],
      [[1], 1],
      [[3, 1], 1],
      [[3, 1], 3],
      [[4, 5, 6, 7, 0, 1, 2], 6],
      [[4, 5, 6, 7, 0, 1, 2], 5],
      // Present, absent, and either side of the pivot in a long rotation.
      [rotated(1_000, 613), 0],
      [rotated(1_000, 613), 1_998],
      [rotated(1_000, 613), 1_999]
    ]
  },

  "peak-index-in-a-mountain-array": {
    // A mountain array has exactly one peak by definition, so no `accepted`.
    solve: (arr) => {
      let lo = 0;
      let hi = arr.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (arr[mid] < arr[mid + 1]) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    generate: () => [
      [[0, 1, 0]],
      [[0, 10, 5, 2]],
      [[3, 4, 5, 1]],
      [[24, 69, 100, 99, 79, 78, 67, 36, 26, 19]],
      // Peak at the second and second-to-last positions.
      [[...Array.from({ length: 998 }, (_, i) => i), 2_000, 998]],
      [[0, 2_000, ...Array.from({ length: 998 }, (_, i) => 998 - i)]]
    ]
  },

  "find-peak-element": {
    solve: (nums) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] < nums[mid + 1]) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    /**
     * Any index strictly greater than both neighbours, with the out-of-range
     * neighbours treated as negative infinity, as the problem specifies.
     */
    accepted: (nums) => {
      const peaks = [];
      for (let i = 0; i < nums.length; i++) {
        const left = i === 0 ? -Infinity : nums[i - 1];
        const right = i === nums.length - 1 ? -Infinity : nums[i + 1];
        if (nums[i] > left && nums[i] > right) peaks.push(i);
      }
      return peaks;
    },
    generate: () => [
      [[1]],
      [[1, 2]],
      [[2, 1]],
      [[1, 3, 2, 4, 1]],
      // Several peaks — the case a unique-answer expectation would get wrong.
      [[1, 2, 1, 2, 1, 2, 1]],
      [Array.from({ length: 1_000 }, (_, i) => i)],
      [Array.from({ length: 1_000 }, (_, i) => 1_000 - i)],
      // Kept short: every odd index is a peak, and the accepted set is written
      // out in full, so a 1,000-element version would emit 500 answers.
      [Array.from({ length: 41 }, (_, i) => (i % 2 === 0 ? 0 : 1))]
    ]
  },

  "koko-eating-bananas": {
    solve: (piles, h) => {
      const hours = (speed) =>
        piles.reduce((total, pile) => total + Math.ceil(pile / speed), 0);
      let lo = 1;
      let hi = Math.max(...piles);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (hours(mid) <= h) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    },
    generate: () => [
      [[1], 1],
      [[1], 100],
      [[1000000000], 2],
      [[3, 6, 7, 11], 4],
      // h equal to the pile count forces the maximum pile as the speed.
      [[3, 6, 7, 11], 11],
      [[312884470], 968709470],
      [Array.from({ length: 500 }, (_, i) => i + 1), 500],
      [Array.from({ length: 500 }, (_, i) => i + 1), 1_000]
    ]
  },

  "capacity-to-ship-packages-within-d-days": {
    solve: (weights, days) => {
      const needed = (capacity) => {
        let used = 1;
        let load = 0;
        for (const weight of weights) {
          if (load + weight > capacity) {
            used++;
            load = 0;
          }
          load += weight;
        }
        return used;
      };
      let lo = Math.max(...weights);
      let hi = weights.reduce((total, weight) => total + weight, 0);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (needed(mid) <= days) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    },
    generate: () => [
      [[1], 1],
      [[1, 1], 1],
      [[1, 1], 2],
      [[5, 5, 5], 3],
      // One day means one ship carrying everything; one package per day means
      // the heaviest package.
      [[1, 2, 3, 4, 5], 1],
      [[1, 2, 3, 4, 5], 5],
      [[3, 2, 2, 4, 1, 4], 4],
      [Array.from({ length: 500 }, (_, i) => (i % 10) + 1), 50]
    ]
  },

  "split-array-largest-sum": {
    solve: (nums, k) => {
      const needed = (limit) => {
        let parts = 1;
        let running = 0;
        for (const value of nums) {
          if (running + value > limit) {
            parts++;
            running = 0;
          }
          running += value;
        }
        return parts;
      };
      let lo = Math.max(...nums);
      let hi = nums.reduce((total, value) => total + value, 0);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (needed(mid) <= k) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    },
    generate: () => [
      [[1], 1],
      [[1, 1], 1],
      [[1, 1], 2],
      [[1, 4, 4], 3],
      // k = 1 is the whole sum; k = n is the largest element.
      [[7, 2, 5, 10, 8], 1],
      [[7, 2, 5, 10, 8], 5],
      [[2, 3, 1, 2, 4, 3], 5],
      [Array.from({ length: 500 }, (_, i) => (i % 7) + 1), 20]
    ]
  },

  "median-of-two-sorted-arrays": {
    /**
     * The median of integers is either whole or exactly x.5, both of which are
     * binary-exact, so this needs none of the floating-point filtering the
     * average-of-a-window question does.
     */
    solve: (nums1, nums2) => {
      const merged = [...nums1, ...nums2].sort((a, b) => a - b);
      const middle = Math.floor(merged.length / 2);
      return merged.length % 2 === 1
        ? merged[middle]
        : (merged[middle - 1] + merged[middle]) / 2;
    },
    generate: () => [
      [[1], []],
      [[], [1]],
      [[1], [2]],
      [[1, 2], []],
      [[0, 0], [0, 0]],
      // Disjoint ranges in both directions, and very lopsided lengths.
      [[1, 2, 3], [100, 200, 300]],
      [[100, 200, 300], [1, 2, 3]],
      [Array.from({ length: 999 }, (_, i) => i * 2), [1]],
      [[1], Array.from({ length: 1_000 }, (_, i) => i * 2)],
      [sortedInts(1_000, -500, 500, 107), sortedInts(999, -500, 500, 109)]
    ]
  },

  "time-based-key-value-store": {
    // `set` reports null; `get` returns the value stored at the largest
    // timestamp not after the one asked for, or the empty string.
    solve: (...operations) => {
      const store = new Map();
      return operations.map(([name, key, second, third]) => {
        if (name === "set") {
          if (!store.has(key)) store.set(key, []);
          store.get(key).push([third, second]);
          return null;
        }
        const entries = store.get(key) ?? [];
        let lo = 0;
        let hi = entries.length - 1;
        let best = "";
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (entries[mid][0] <= second) {
            best = entries[mid][1];
            lo = mid + 1;
          } else hi = mid - 1;
        }
        return best;
      });
    },
    generate: () => [
      [["get", "missing", 1]],
      [["set", "k", "v", 5], ["get", "k", 4]],
      [["set", "k", "v", 5], ["get", "k", 5]],
      [["set", "k", "a", 1], ["set", "k", "b", 2], ["get", "k", 1], ["get", "k", 2], ["get", "k", 99]],
      // Two keys must not see each other's history.
      [["set", "a", "1", 1], ["set", "b", "2", 1], ["get", "a", 1], ["get", "b", 1]],
      [
        ...Array.from({ length: 50 }, (_, i) => ["set", "k", `v${i}`, i + 1]),
        ["get", "k", 1],
        ["get", "k", 25],
        ["get", "k", 50],
        ["get", "k", 500]
      ]
    ]
  }
};
