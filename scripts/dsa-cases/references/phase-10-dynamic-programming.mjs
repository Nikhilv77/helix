/**
 * Reference solutions and input generators for Phase 10 — Dynamic Programming.
 *
 * The cleanest phase in the bank: every question takes plain arguments and
 * returns a scalar, so no adapter and no ambiguity. One hazard replaces them.
 *
 * **Every answer has to fit in a 32-bit int.** Java and C++ return `int` here,
 * and these are exactly the questions whose answers explode — `climbing-stairs`
 * is Fibonacci, `decode-ways` is Fibonacci in disguise, `unique-paths` is a
 * binomial coefficient. `climbing-stairs(45)` is 1,836,311,903 and fits;
 * `climbing-stairs(46)` overflows and would be a case no correct Java solution
 * could pass. Inputs below are sized against that ceiling, and
 * `phase-10-fits-int32.test` in the runner spec checks every emitted value.
 *
 * Watch the argument order: `coin-change` takes `(coins, amount)` and
 * `coin-change-ii` takes `(amount, coins)`. The authored cases are the authority
 * and the replay catches a reference that assumes otherwise.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

const repeat = (character, n) => character.repeat(n);

export const phase10 = {
  "climbing-stairs": {
    solve: (n) => {
      let previous = 1;
      let current = 1;
      for (let step = 2; step <= n; step++) {
        const next = previous + current;
        previous = current;
        current = next;
      }
      return current;
    },
    // 45 is the ceiling: the answer is 1,836,311,903 and 46 overflows int32.
    generate: () => [[1], [4], [5], [10], [20], [30], [44], [45]]
  },

  "house-robber": {
    solve: (nums) => {
      let skip = 0;
      let take = 0;
      for (const value of nums) {
        const next = Math.max(take, skip + value);
        skip = take;
        take = next;
      }
      return take;
    },
    generate: () => [
      [[]],
      [[5]],
      [[1, 2]],
      [[2, 1, 1, 2]],
      [[0, 0, 0]],
      // Alternating high values, and a long uniform run.
      [[100, 1, 100, 1, 100]],
      [Array.from({ length: 400 }, () => 1_000)],
      [randomInts(400, 0, 400, 227)]
    ]
  },

  "house-robber-ii": {
    // The houses form a circle, so the first and last cannot both be taken.
    solve: (nums) => {
      const line = (values) => {
        let skip = 0;
        let take = 0;
        for (const value of values) {
          const next = Math.max(take, skip + value);
          skip = take;
          take = next;
        }
        return take;
      };
      if (nums.length === 0) return 0;
      if (nums.length === 1) return nums[0];
      return Math.max(line(nums.slice(1)), line(nums.slice(0, -1)));
    },
    generate: () => [
      [[]],
      [[5]],
      [[1, 2]],
      [[2, 2, 2]],
      // The best line answer would take both ends, which the circle forbids.
      [[5, 1, 1, 5]],
      [[1, 1, 1, 1, 1]],
      [Array.from({ length: 400 }, () => 1_000)],
      [randomInts(400, 0, 400, 229)]
    ]
  },

  "decode-ways": {
    solve: (s) => {
      if (s.length === 0 || s[0] === "0") return 0;
      let previous = 1;
      let current = 1;
      for (let i = 1; i < s.length; i++) {
        let next = 0;
        if (s[i] !== "0") next += current;
        const pair = Number(s.slice(i - 1, i + 1));
        if (pair >= 10 && pair <= 26) next += previous;
        if (next === 0) return 0;
        previous = current;
        current = next;
      }
      return current;
    },
    // All-ones grows like Fibonacci, so the length is capped well under int32.
    generate: () => [
      ["1"],
      ["0"],
      ["10"],
      ["27"],
      ["100"],
      ["101"],
      ["110"],
      ["301"],
      [repeat("1", 20)],
      [repeat("1", 40)],
      ["2101"]
    ]
  },

  "unique-paths": {
    solve: (m, n) => {
      const row = new Array(n).fill(1);
      for (let r = 1; r < m; r++) {
        for (let c = 1; c < n; c++) row[c] += row[c - 1];
      }
      return row[n - 1];
    },
    // A binomial coefficient: 17x17 is 601,080,390, and 18x18 overflows.
    generate: () => [
      [1, 1],
      [1, 10],
      [10, 1],
      [2, 2],
      [3, 3],
      [10, 10],
      [16, 16],
      [17, 17]
    ]
  },

  "unique-paths-ii": {
    solve: (obstacleGrid) => {
      const rows = obstacleGrid.length;
      const cols = obstacleGrid[0]?.length ?? 0;
      const row = new Array(cols).fill(0);
      row[0] = obstacleGrid[0][0] === 1 ? 0 : 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (obstacleGrid[r][c] === 1) row[c] = 0;
          else if (c > 0) row[c] += row[c - 1];
        }
      }
      return row[cols - 1];
    },
    generate: () => [
      [[[0]]],
      [[[1]]],
      // An obstacle on the only route, and one that blocks the finish.
      [[[0, 0], [1, 1]]],
      [[[0, 0], [0, 1]]],
      [[[0, 1, 0], [0, 0, 0], [0, 0, 0]]],
      [Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0))],
      [Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r === 3 && c < 7 ? 1 : 0)))]
    ]
  },

  "minimum-path-sum": {
    solve: (grid) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      const row = new Array(cols).fill(Infinity);
      row[0] = 0;
      for (let r = 0; r < rows; r++) {
        row[0] += grid[r][0];
        for (let c = 1; c < cols; c++) row[c] = Math.min(row[c], row[c - 1]) + grid[r][c];
      }
      return row[cols - 1];
    },
    generate: () => [
      [[[0]]],
      [[[5]]],
      [[[1, 2]]],
      [[[1], [2]]],
      // The cheap route runs along an edge rather than the diagonal.
      [[[1, 1, 1], [9, 9, 1], [9, 9, 1]]],
      [[[1, 9, 9], [1, 9, 9], [1, 1, 1]]],
      [Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => 1))],
      [Array.from({ length: 20 }, (_, r) => Array.from({ length: 20 }, (_, c) => (r * 20 + c) % 9))]
    ]
  },

  "coin-change": {
    // (coins, amount) — the reverse of coin-change-ii.
    solve: (coins, amount) => {
      const best = new Array(amount + 1).fill(Infinity);
      best[0] = 0;
      for (let value = 1; value <= amount; value++) {
        for (const coin of coins) {
          if (coin <= value) best[value] = Math.min(best[value], best[value - coin] + 1);
        }
      }
      return best[amount] === Infinity ? -1 : best[amount];
    },
    generate: () => [
      [[1], 1],
      [[2], 1],
      [[1, 2, 5], 0],
      [[5], 10],
      // The greedy choice is wrong here: 6+6 beats 7+1+1+1+1+1.
      [[1, 7, 6], 12],
      [[186, 419, 83, 408], 6_249],
      [[1, 2, 5], 1_000],
      [[7, 11], 5]
    ]
  },

  "coin-change-ii": {
    // (amount, coins) — note the order.
    solve: (amount, coins) => {
      const ways = new Array(amount + 1).fill(0);
      ways[0] = 1;
      // Coins in the outer loop counts combinations, not permutations.
      for (const coin of coins) {
        for (let value = coin; value <= amount; value++) ways[value] += ways[value - coin];
      }
      return ways[amount];
    },
    generate: () => [
      [0, [1]],
      [1, [2]],
      [4, [1, 2]],
      [10, [1, 2, 5]],
      // Order must not count twice: 1+2 and 2+1 are the same combination.
      [3, [1, 2]],
      [100, [1, 5, 10, 25]],
      [500, [1, 2, 5]]
    ]
  },

  "perfect-squares": {
    solve: (n) => {
      const best = new Array(n + 1).fill(Infinity);
      best[0] = 0;
      for (let value = 1; value <= n; value++) {
        for (let root = 1; root * root <= value; root++) {
          best[value] = Math.min(best[value], best[value - root * root] + 1);
        }
      }
      return best[n];
    },
    generate: () => [
      [1],
      [2],
      [3],
      [4],
      // 7 needs four squares, the worst case Lagrange's theorem allows.
      [7],
      [9_999],
      [10_000],
      [4_999]
    ]
  },

  "partition-equal-subset-sum": {
    solve: (nums) => {
      const total = nums.reduce((sum, value) => sum + value, 0);
      if (total % 2 !== 0) return false;
      const target = total / 2;
      const reachable = new Array(target + 1).fill(false);
      reachable[0] = true;
      for (const value of nums) {
        for (let sum = target; sum >= value; sum--) {
          if (reachable[sum - value]) reachable[sum] = true;
        }
      }
      return reachable[target];
    },
    generate: () => [
      [[1]],
      [[1, 1]],
      [[1, 2]],
      [[2, 2, 2, 2]],
      // Even total but no equal split, and a split that needs several elements.
      [[1, 1, 1, 5]],
      [[3, 3, 3, 4, 5]],
      [Array.from({ length: 100 }, () => 2)],
      [randomInts(100, 1, 40, 233)]
    ]
  },

  "target-sum": {
    solve: (nums, target) => {
      let counts = new Map([[0, 1]]);
      for (const value of nums) {
        const next = new Map();
        for (const [sum, ways] of counts) {
          for (const signed of [sum + value, sum - value]) {
            next.set(signed, (next.get(signed) ?? 0) + ways);
          }
        }
        counts = next;
      }
      return counts.get(target) ?? 0;
    },
    generate: () => [
      [[1], 1],
      [[1], -1],
      [[1], 2],
      [[0], 0],
      // Zeros double the count for every arrangement they appear in.
      [[0, 0, 1], 1],
      [[1, 1, 1, 1, 1], 5],
      [Array.from({ length: 20 }, () => 1), 0],
      [randomInts(20, 0, 5, 239), 3]
    ]
  },

  "word-break": {
    solve: (s, wordDict) => {
      const words = new Set(wordDict);
      const reachable = new Array(s.length + 1).fill(false);
      reachable[0] = true;
      for (let end = 1; end <= s.length; end++) {
        for (let start = 0; start < end; start++) {
          if (reachable[start] && words.has(s.slice(start, end))) {
            reachable[end] = true;
            break;
          }
        }
      }
      return reachable[s.length];
    },
    generate: () => [
      ["", ["a"]],
      ["a", ["a"]],
      ["a", ["b"]],
      ["aa", ["a"]],
      // The greedy longest-first split fails; only backtracking finds it.
      ["aaaaab", ["a", "aa", "aaa", "aaaa"]],
      ["cars", ["car", "ca", "rs"]],
      [repeat("a", 100), ["a", "aa", "aaa"]],
      [`${repeat("a", 60)}b`, ["a", "aa", "aaa", "aaaa"]]
    ]
  },

  "longest-increasing-subsequence": {
    // The classic O(n^2) table is the wrong answer at this size; only the
    // patience-sorting tails run in time.
    scale: () => [
      { arguments: [[0]], build: [{ ints: { n: 200_000, lo: -100_000, hi: 100_000, seed: 43 } }] }
    ],

    solve: (nums) => {
      const tails = [];
      for (const value of nums) {
        let lo = 0;
        let hi = tails.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (tails[mid] < value) lo = mid + 1;
          else hi = mid;
        }
        tails[lo] = value;
      }
      return tails.length;
    },
    generate: () => [
      [[]],
      [[1]],
      [[2, 1]],
      [[7, 7, 7, 7]],
      [[1, 2, 3, 4, 5]],
      [[5, 4, 3, 2, 1]],
      [Array.from({ length: 500 }, (_, i) => i)],
      [randomInts(500, -100, 100, 241)]
    ]
  },

  "longest-common-subsequence": {
    solve: (text1, text2) => {
      let row = new Array(text2.length + 1).fill(0);
      for (let i = 1; i <= text1.length; i++) {
        const next = new Array(text2.length + 1).fill(0);
        for (let j = 1; j <= text2.length; j++) {
          next[j] =
            text1[i - 1] === text2[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
        }
        row = next;
      }
      return row[text2.length];
    },
    generate: () => [
      ["", ""],
      ["a", ""],
      ["a", "a"],
      ["a", "b"],
      ["ab", "ba"],
      // Reversed strings share only one character in sequence.
      ["abcdef", "fedcba"],
      [repeat("a", 200), repeat("a", 200)],
      ["abcbdab", "bdcaba"]
    ]
  },

  "longest-palindromic-subsequence": {
    solve: (s) => {
      const n = s.length;
      const table = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = n - 1; i >= 0; i--) {
        table[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
          table[i][j] =
            s[i] === s[j] ? table[i + 1][j - 1] + 2 : Math.max(table[i + 1][j], table[i][j - 1]);
        }
      }
      return n === 0 ? 0 : table[0][n - 1];
    },
    generate: () => [
      ["a"],
      ["ab"],
      ["aa"],
      ["aba"],
      // No repeated character, so the answer is one.
      ["abcdef"],
      ["agbdba"],
      [repeat("a", 200)],
      ["character"]
    ]
  },

  "edit-distance": {
    solve: (word1, word2) => {
      let row = Array.from({ length: word2.length + 1 }, (_, j) => j);
      for (let i = 1; i <= word1.length; i++) {
        const next = [i];
        for (let j = 1; j <= word2.length; j++) {
          next[j] =
            word1[i - 1] === word2[j - 1]
              ? row[j - 1]
              : 1 + Math.min(row[j - 1], row[j], next[j - 1]);
        }
        row = next;
      }
      return row[word2.length];
    },
    generate: () => [
      ["", ""],
      ["a", ""],
      ["", "abc"],
      ["a", "a"],
      ["ab", "ba"],
      // Nothing in common, so the distance is the longer length.
      ["abc", "xyz"],
      [repeat("a", 100), repeat("b", 100)],
      ["kitten", "sitting"]
    ]
  },

  "interleaving-string": {
    solve: (s1, s2, s3) => {
      if (s1.length + s2.length !== s3.length) return false;
      let row = new Array(s2.length + 1).fill(false);
      row[0] = true;
      for (let j = 1; j <= s2.length; j++) row[j] = row[j - 1] && s2[j - 1] === s3[j - 1];
      for (let i = 1; i <= s1.length; i++) {
        const next = new Array(s2.length + 1).fill(false);
        next[0] = row[0] && s1[i - 1] === s3[i - 1];
        for (let j = 1; j <= s2.length; j++) {
          next[j] =
            (row[j] && s1[i - 1] === s3[i + j - 1]) || (next[j - 1] && s2[j - 1] === s3[i + j - 1]);
        }
        row = next;
      }
      return row[s2.length];
    },
    generate: () => [
      ["", "", ""],
      ["a", "", "a"],
      ["", "a", "a"],
      ["a", "b", "ab"],
      ["a", "b", "ba"],
      // Right characters, wrong total length.
      ["a", "b", "abc"],
      ["aa", "aa", "aaaa"],
      [repeat("a", 50), repeat("b", 50), `${repeat("a", 50)}${repeat("b", 50)}`]
    ]
  },

  "palindromic-substrings": {
    solve: (s) => {
      let total = 0;
      const expand = (lo, hi) => {
        while (lo >= 0 && hi < s.length && s[lo] === s[hi]) {
          total++;
          lo--;
          hi++;
        }
      };
      for (let i = 0; i < s.length; i++) {
        expand(i, i);
        expand(i, i + 1);
      }
      return total;
    },
    generate: () => [
      [""],
      ["a"],
      ["ab"],
      ["aa"],
      ["aba"],
      // Every substring is a palindrome: n(n+1)/2 of them.
      [repeat("a", 100)],
      ["abcdefg"],
      ["racecarannakayak"]
    ]
  },

  "best-time-to-buy-and-sell-stock-ii": {
    // Unlimited transactions: take every upward step.
    solve: (prices) => {
      let profit = 0;
      for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
      }
      return profit;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[2, 1]],
      [[3, 3, 3]],
      [[1, 5, 1, 5, 1, 5]],
      [Array.from({ length: 500 }, (_, i) => i)],
      [randomInts(1_000, 0, 1_000, 251)]
    ]
  },

  "best-time-to-buy-and-sell-stock-with-cooldown": {
    solve: (prices) => {
      let held = -Infinity;
      let sold = -Infinity;
      let rest = 0;
      for (const price of prices) {
        const previousHeld = held;
        const previousSold = sold;
        const previousRest = rest;
        // Cannot buy the day after selling, hence rest is the only entry point.
        held = Math.max(previousHeld, previousRest - price);
        sold = previousHeld + price;
        rest = Math.max(previousRest, previousSold);
      }
      return Math.max(sold, rest, 0);
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[2, 1]],
      [[1, 2, 3, 0, 2]],
      // Alternating prices where the cooldown costs a trade.
      [[1, 5, 1, 5, 1, 5]],
      [Array.from({ length: 300 }, (_, i) => i)],
      [randomInts(300, 0, 200, 257)]
    ]
  },

  "best-time-to-buy-and-sell-stock-iii": {
    // At most two transactions.
    solve: (prices) => {
      let buyFirst = -Infinity;
      let sellFirst = 0;
      let buySecond = -Infinity;
      let sellSecond = 0;
      for (const price of prices) {
        buyFirst = Math.max(buyFirst, -price);
        sellFirst = Math.max(sellFirst, buyFirst + price);
        buySecond = Math.max(buySecond, sellFirst - price);
        sellSecond = Math.max(sellSecond, buySecond + price);
      }
      return sellSecond;
    },
    generate: () => [
      [[]],
      [[1]],
      [[2, 1]],
      [[1, 2]],
      // Three separate rises, of which only the best two may be taken.
      [[1, 5, 1, 6, 1, 7]],
      [[7, 6, 4, 3, 1]],
      [Array.from({ length: 300 }, (_, i) => i)],
      [randomInts(300, 0, 200, 263)]
    ]
  },

  "burst-balloons": {
    solve: (nums) => {
      const padded = [1, ...nums, 1];
      const n = padded.length;
      const best = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let length = 2; length < n; length++) {
        for (let left = 0; left + length < n; left++) {
          const right = left + length;
          for (let last = left + 1; last < right; last++) {
            // `last` is burst last in this window, so its neighbours survive.
            best[left][right] = Math.max(
              best[left][right],
              best[left][last] + padded[left] * padded[last] * padded[right] + best[last][right]
            );
          }
        }
      }
      return best[0][n - 1];
    },
    // Cubic, and the answer multiplies three values — kept small on both counts.
    generate: () => [
      [[]],
      [[5]],
      [[1, 1]],
      [[3, 1, 5]],
      [[9, 76, 64, 21]],
      [Array.from({ length: 30 }, () => 5)],
      [randomInts(30, 1, 20, 269)]
    ]
  },

  "regular-expression-matching": {
    // '.' matches any single character; 'x*' matches zero or more of x.
    solve: (s, p) => {
      const match = Array.from({ length: s.length + 1 }, () =>
        new Array(p.length + 1).fill(false)
      );
      match[0][0] = true;
      for (let j = 1; j <= p.length; j++) {
        if (p[j - 1] === "*") match[0][j] = match[0][j - 2];
      }
      for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= p.length; j++) {
          if (p[j - 1] === "*") {
            const repeats = p[j - 2] === "." || p[j - 2] === s[i - 1];
            match[i][j] = match[i][j - 2] || (repeats && match[i - 1][j]);
          } else if (p[j - 1] === "." || p[j - 1] === s[i - 1]) {
            match[i][j] = match[i - 1][j - 1];
          }
        }
      }
      return match[s.length][p.length];
    },
    generate: () => [
      ["", ""],
      ["", "a*"],
      ["a", ""],
      ["a", "."],
      ["aaa", "a*a"],
      // A star that must match zero occurrences to succeed.
      ["ab", "a*ab"],
      ["mississippi", "mis*is*p*."],
      ["mississippi", "mis*is*ip*."],
      ["aaaaaaaaaab", "a*a*a*a*a*b"]
    ]
  }
};
