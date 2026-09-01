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
 * Sizing rule: inputs are capped at 2,000 elements.
 *
 * Every generated input is inlined as an array literal in the generated source.
 * Java compiles a literal into roughly one bytecode instruction per element and
 * caps a method at 64KB, so a 20,000-element case produced "code too large" and
 * broke the question for Java candidates while working fine in JavaScript.
 *
 * The cost is real and worth stating: at 2,000 elements a quadratic solution
 * still finishes in milliseconds, so these no longer catch wrong complexity.
 * Doing that needs the harness to build large inputs with a loop rather than a
 * literal — a change across all four languages, not a sizing tweak.
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
      [Array.from({ length: 2_000 }, (_, i) => i)],
      [[...Array.from({ length: 2_000 }, (_, i) => i), 0]]
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
      [randomInts(2_000, 0, 2_000, 11)]
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
      [randomInts(2_000, -1_000, 1_000, 23)]
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
      [randomInts(2_000, 0, 3, 31)]
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
      [Array.from({ length: 2_000 }, (_, i) => (i % 2 === 0 ? 9 : i))]
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
      [Array.from({ length: 2_000 }, (_, i) => i)]
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
      [Array.from({ length: 2_000 }, (_, i) => (i % 3) + 1)]
    ]
  }
};

/**
 * The rest of Phase 1. Each is replayed against the question's own authored
 * cases before it is trusted to generate anything, so a wrong reference is
 * caught by the question rather than silently baked into the bank.
 */
export const phase1Rest = {
  "remove-duplicates-from-sorted-array": {
    mode: "mutated-first-argument",
    solve: (nums) => {
      if (nums.length === 0) return nums;
      let write = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[write - 1]) nums[write++] = nums[i];
      }
      nums.length = write;
      return nums;
    },
    generate: () => [[[]], [[1]], [[1, 1]], [[1, 2, 3]], [[0, 0, 0, 0]]]
  },

  "rotate-array": {
    mode: "mutated-first-argument",
    solve: (nums, k) => {
      const n = nums.length;
      if (n === 0) return nums;
      const shift = ((k % n) + n) % n;
      const tail = nums.slice(n - shift);
      const head = nums.slice(0, n - shift);
      for (let i = 0; i < n; i++) nums[i] = i < shift ? tail[i] : head[i - shift];
      return nums;
    },
    generate: () => [
      [[1], 0],
      [[1, 2], 3],
      [[1, 2, 3], 0],
      [[1, 2, 3, 4], 4],
      [[1, 2, 3, 4, 5], 7]
    ]
  },

  "sort-colors": {
    mode: "mutated-first-argument",
    solve: (nums) => {
      let low = 0;
      let mid = 0;
      let high = nums.length - 1;
      while (mid <= high) {
        if (nums[mid] === 0) [nums[low++], nums[mid++]] = [nums[mid], nums[low]];
        else if (nums[mid] === 2) [nums[mid], nums[high--]] = [nums[high], nums[mid]];
        else mid++;
      }
      return nums;
    },
    generate: () => [[[0]], [[2]], [[1, 1, 1]], [[2, 2, 0, 0]], [[0, 1, 2, 0, 1, 2]]]
  },

  "container-with-most-water": {
    solve: (height) => {
      let left = 0;
      let right = height.length - 1;
      let best = 0;
      while (left < right) {
        best = Math.max(best, Math.min(height[left], height[right]) * (right - left));
        if (height[left] < height[right]) left++;
        else right--;
      }
      return best;
    },
    generate: () => [[[1, 1]], [[0, 0]], [[1, 2, 1]], [[2, 3, 4, 5, 18, 17, 6]], [[1, 2, 4, 3]]]
  },

  "3sum": {
    comparison: "unordered-nested",
    solve: (nums) => {
      const sorted = [...nums].sort((a, b) => a - b);
      const out = [];
      for (let i = 0; i < sorted.length - 2; i++) {
        if (i > 0 && sorted[i] === sorted[i - 1]) continue;
        let lo = i + 1;
        let hi = sorted.length - 1;
        while (lo < hi) {
          const sum = sorted[i] + sorted[lo] + sorted[hi];
          if (sum === 0) {
            out.push([sorted[i], sorted[lo], sorted[hi]]);
            while (lo < hi && sorted[lo] === sorted[lo + 1]) lo++;
            while (lo < hi && sorted[hi] === sorted[hi - 1]) hi--;
            lo++;
            hi--;
          } else if (sum < 0) lo++;
          else hi--;
        }
      }
      return out;
    },
    generate: () => [[[]], [[0, 0, 0]], [[0, 0, 0, 0]], [[-2, 0, 1, 1, 2]], [[1, 2, -2, -1]]]
  },

  "4sum": {
    comparison: "unordered-nested",
    solve: (nums, target) => {
      const sorted = [...nums].sort((a, b) => a - b);
      const out = [];
      const n = sorted.length;
      for (let i = 0; i < n - 3; i++) {
        if (i > 0 && sorted[i] === sorted[i - 1]) continue;
        for (let j = i + 1; j < n - 2; j++) {
          if (j > i + 1 && sorted[j] === sorted[j - 1]) continue;
          let lo = j + 1;
          let hi = n - 1;
          while (lo < hi) {
            const sum = sorted[i] + sorted[j] + sorted[lo] + sorted[hi];
            if (sum === target) {
              out.push([sorted[i], sorted[j], sorted[lo], sorted[hi]]);
              while (lo < hi && sorted[lo] === sorted[lo + 1]) lo++;
              while (lo < hi && sorted[hi] === sorted[hi - 1]) hi--;
              lo++;
              hi--;
            } else if (sum < target) lo++;
            else hi--;
          }
        }
      }
      return out;
    },
    generate: () => [[[], 0], [[0, 0, 0, 0], 0], [[1, 2, 3, 4], 100], [[-3, -1, 0, 2, 4, 5], 2]]
  },

  "trapping-rain-water": {
    solve: (height) => {
      let left = 0;
      let right = height.length - 1;
      let leftMax = 0;
      let rightMax = 0;
      let total = 0;
      while (left < right) {
        if (height[left] < height[right]) {
          leftMax = Math.max(leftMax, height[left]);
          total += leftMax - height[left];
          left++;
        } else {
          rightMax = Math.max(rightMax, height[right]);
          total += rightMax - height[right];
          right--;
        }
      }
      return total;
    },
    generate: () => [[[]], [[3]], [[1, 2, 3]], [[3, 2, 1]], [[5, 0, 5]], [[0, 0, 0]]]
  },

  "next-permutation": {
    mode: "mutated-first-argument",
    solve: (nums) => {
      let i = nums.length - 2;
      while (i >= 0 && nums[i] >= nums[i + 1]) i--;
      if (i >= 0) {
        let j = nums.length - 1;
        while (nums[j] <= nums[i]) j--;
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      for (let lo = i + 1, hi = nums.length - 1; lo < hi; lo++, hi--) {
        [nums[lo], nums[hi]] = [nums[hi], nums[lo]];
      }
      return nums;
    },
    generate: () => [[[1]], [[1, 1]], [[1, 1, 5]], [[2, 3, 1]], [[5, 4, 7, 5, 3, 2]]]
  },

  "find-the-duplicate-number": {
    solve: (nums) => {
      let slow = nums[0];
      let fast = nums[0];
      do {
        slow = nums[slow];
        fast = nums[nums[fast]];
      } while (slow !== fast);
      slow = nums[0];
      while (slow !== fast) {
        slow = nums[slow];
        fast = nums[fast];
      }
      return slow;
    },
    generate: () => [[[1, 1]], [[2, 2, 2, 2, 2]], [[1, 4, 6, 6, 6, 2, 3, 5]], [[2, 1, 3, 4, 4]]]
  },

  "first-missing-positive": {
    solve: (nums) => {
      const n = nums.length;
      const copy = [...nums];
      for (let i = 0; i < n; i++) {
        while (copy[i] > 0 && copy[i] <= n && copy[copy[i] - 1] !== copy[i]) {
          const target = copy[i] - 1;
          [copy[i], copy[target]] = [copy[target], copy[i]];
        }
      }
      for (let i = 0; i < n; i++) if (copy[i] !== i + 1) return i + 1;
      return n + 1;
    },
    generate: () => [[[]], [[1]], [[2]], [[7, 8, 9, 11, 12]], [[1, 1]], [[-5, -3]]]
  },

  "merge-intervals": {
    solve: (intervals) => {
      if (intervals.length === 0) return [];
      const sorted = intervals.map((i) => [...i]).sort((a, b) => a[0] - b[0]);
      const out = [sorted[0]];
      for (const [start, end] of sorted.slice(1)) {
        const last = out[out.length - 1];
        if (start <= last[1]) last[1] = Math.max(last[1], end);
        else out.push([start, end]);
      }
      return out;
    },
    generate: () => [
      [[]],
      [[[1, 4]]],
      [[[1, 4], [0, 4]]],
      [[[1, 4], [2, 3]]],
      [[[1, 4], [5, 6]]]
    ]
  },

  "insert-interval": {
    solve: (intervals, newInterval) => {
      const out = [];
      let [start, end] = newInterval;
      let i = 0;
      while (i < intervals.length && intervals[i][1] < start) out.push([...intervals[i++]]);
      while (i < intervals.length && intervals[i][0] <= end) {
        start = Math.min(start, intervals[i][0]);
        end = Math.max(end, intervals[i][1]);
        i++;
      }
      out.push([start, end]);
      while (i < intervals.length) out.push([...intervals[i++]]);
      return out;
    },
    generate: () => [
      [[], [5, 7]],
      [[[1, 5]], [2, 3]],
      [[[1, 5]], [6, 8]],
      [[[3, 5]], [1, 2]],
      [[[1, 2], [5, 6]], [3, 4]]
    ]
  },

  "set-matrix-zeroes": {
    mode: "mutated-first-argument",
    solve: (matrix) => {
      const rows = new Set();
      const cols = new Set();
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] === 0) {
            rows.add(r);
            cols.add(c);
          }
        }
      }
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (rows.has(r) || cols.has(c)) matrix[r][c] = 0;
        }
      }
      return matrix;
    },
    generate: () => [
      [[[1]]],
      [[[0]]],
      [[[1, 2], [3, 4]]],
      [[[0, 1], [1, 1]]],
      [[[1, 1, 1], [1, 1, 1]]]
    ]
  },

  "spiral-matrix": {
    solve: (matrix) => {
      const out = [];
      if (matrix.length === 0) return out;
      let top = 0;
      let bottom = matrix.length - 1;
      let left = 0;
      let right = matrix[0].length - 1;
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) out.push(matrix[top][c]);
        top++;
        for (let r = top; r <= bottom; r++) out.push(matrix[r][right]);
        right--;
        if (top <= bottom) {
          for (let c = right; c >= left; c--) out.push(matrix[bottom][c]);
          bottom--;
        }
        if (left <= right) {
          for (let r = bottom; r >= top; r--) out.push(matrix[r][left]);
          left++;
        }
      }
      return out;
    },
    generate: () => [
      [[[1]]],
      [[[1, 2]]],
      [[[1], [2]]],
      [[[1, 2], [3, 4]]],
      [[[1, 2, 3], [4, 5, 6]]]
    ]
  },

  "rotate-image": {
    mode: "mutated-first-argument",
    solve: (matrix) => {
      const n = matrix.length;
      for (let r = 0; r < n; r++) {
        for (let c = r + 1; c < n; c++) {
          [matrix[r][c], matrix[c][r]] = [matrix[c][r], matrix[r][c]];
        }
      }
      for (const row of matrix) row.reverse();
      return matrix;
    },
    generate: () => [[[[1]]], [[[1, 2], [3, 4]]], [[[0, 0], [0, 0]]]]
  },

  "game-of-life": {
    mode: "mutated-first-argument",
    solve: (board) => {
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      const snapshot = board.map((row) => [...row]);
      const live = (r, c) =>
        r >= 0 && r < rows && c >= 0 && c < cols && snapshot[r][c] === 1 ? 1 : 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const n =
            live(r - 1, c - 1) + live(r - 1, c) + live(r - 1, c + 1) +
            live(r, c - 1) + live(r, c + 1) +
            live(r + 1, c - 1) + live(r + 1, c) + live(r + 1, c + 1);
          board[r][c] = snapshot[r][c] === 1 ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
        }
      }
      return board;
    },
    generate: () => [[[[0]]], [[[1]]], [[[1, 1], [1, 1]]], [[[0, 0], [0, 0]]]]
  }
};
