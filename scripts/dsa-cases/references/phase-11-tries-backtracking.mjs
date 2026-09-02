/**
 * Reference solutions and input generators for Phase 11 — Tries & Backtracking.
 *
 * Backtracking questions return a collection whose *outer* order is arbitrary
 * but whose *inner* order is part of the answer — a permutation is its order, a
 * board's rows are its rows, and a combination is conventionally non-decreasing.
 * `unordered-nested` compares exactly that way, sorting the outer list and
 * leaving each entry alone, so it is the right comparison and no `accepted`
 * hook is needed.
 *
 * The size of the answer is the real constraint here, because the whole
 * collection is written into the bank. Subsets double per element, permutations
 * grow factorially, and eight queens has 92 solutions of eight strings each.
 * Inputs are capped so a single case stays readable rather than filling a file.
 *
 * The two class-operation questions follow the pattern proven in Phase 6: the
 * `arguments` are the call sequence, and the runner reports null for `insert`
 * and `addWord` while every other operation reports its return value.
 */

export const phase11 = {
  "implement-trie-prefix-tree": {
    // `insert` reports null; `search` and `startsWith` report their booleans.
    solve: (...operations) => {
      const root = new Map();
      const walk = (word, create) => {
        let node = root;
        for (const character of word) {
          if (!node.has(character)) {
            if (!create) return null;
            node.set(character, new Map());
          }
          node = node.get(character);
        }
        return node;
      };
      return operations.map(([name, word]) => {
        if (name === "insert") {
          walk(word, true).set("$", true);
          return null;
        }
        const node = walk(word, false);
        if (name === "startsWith") return node !== null;
        return node !== null && node.has("$");
      });
    },
    generate: () => [
      [["search", "a"]],
      [["startsWith", "a"]],
      [["insert", "a"], ["search", "a"], ["startsWith", "a"]],
      // A word that is a prefix of another, inserted in both orders.
      [["insert", "app"], ["insert", "apple"], ["search", "app"], ["search", "apple"], ["search", "appl"]],
      [["insert", "apple"], ["insert", "app"], ["search", "app"], ["startsWith", "appl"]],
      [["insert", "a"], ["insert", "a"], ["search", "a"]],
      [["insert", "abc"], ["search", "abcd"], ["startsWith", "abcd"]],
      [
        ...Array.from({ length: 50 }, (_, i) => ["insert", `word${i}`]),
        ["search", "word25"],
        ["search", "word50"],
        ["startsWith", "word"]
      ]
    ]
  },

  "design-add-and-search-words-data-structure": {
    // `.` matches any single character, so search may have to branch.
    solve: (...operations) => {
      const root = new Map();
      return operations.map(([name, word]) => {
        if (name === "addWord") {
          let node = root;
          for (const character of word) {
            if (!node.has(character)) node.set(character, new Map());
            node = node.get(character);
          }
          node.set("$", true);
          return null;
        }
        const search = (node, index) => {
          if (index === word.length) return node.has("$");
          const character = word[index];
          if (character !== ".") {
            const next = node.get(character);
            return next ? search(next, index + 1) : false;
          }
          for (const [key, next] of node) {
            if (key !== "$" && search(next, index + 1)) return true;
          }
          return false;
        };
        return search(root, 0);
      });
    },
    generate: () => [
      [["search", "a"]],
      [["search", "."]],
      [["addWord", "a"], ["search", "a"], ["search", "."], ["search", ".."]],
      // Every character a wildcard, and a wildcard that must try several branches.
      [["addWord", "bad"], ["addWord", "dad"], ["search", "..."], ["search", "...."]],
      [["addWord", "bad"], ["addWord", "bat"], ["search", "ba."], ["search", "b.d"], ["search", "b.z"]],
      [["addWord", "a"], ["addWord", "ab"], ["search", "a"], ["search", "a."], ["search", ".b"]],
      [
        ...Array.from({ length: 30 }, (_, i) => ["addWord", `w${String.fromCharCode(97 + (i % 26))}${i}`]),
        ["search", "w.0"],
        ["search", "..."],
        ["search", "zzz"]
      ]
    ]
  },

  subsets: {
    comparison: "unordered-nested",
    solve: (nums) => {
      const out = [];
      const walk = (index, current) => {
        if (index === nums.length) {
          out.push([...current]);
          return;
        }
        walk(index + 1, current);
        current.push(nums[index]);
        walk(index + 1, current);
        current.pop();
      };
      walk(0, []);
      return out;
    },
    // 2^n entries, so six elements is already 64 rows in the bank.
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[0, 1, 2]],
      [[-1, 1]],
      [[1, 2, 3, 4]],
      [[1, 2, 3, 4, 5, 6]]
    ]
  },

  "combination-sum": {
    comparison: "unordered-nested",
    // Candidates may repeat; each combination comes out non-decreasing.
    solve: (candidates, target) => {
      const sorted = [...candidates].sort((a, b) => a - b);
      const out = [];
      const walk = (start, remaining, current) => {
        if (remaining === 0) {
          out.push([...current]);
          return;
        }
        for (let i = start; i < sorted.length; i++) {
          if (sorted[i] > remaining) break;
          current.push(sorted[i]);
          walk(i, remaining - sorted[i], current);
          current.pop();
        }
      };
      walk(0, target, []);
      return out;
    },
    generate: () => [
      [[2], 1],
      [[2], 2],
      [[1], 3],
      [[2, 4], 6],
      // No combination reaches the target, and one candidate is the target.
      [[5, 7], 3],
      [[3, 5, 8], 11],
      [[2, 3, 5], 12]
    ]
  },

  permutations: {
    comparison: "unordered-nested",
    solve: (nums) => {
      const out = [];
      const used = new Array(nums.length).fill(false);
      const walk = (current) => {
        if (current.length === nums.length) {
          out.push([...current]);
          return;
        }
        for (let i = 0; i < nums.length; i++) {
          if (used[i]) continue;
          used[i] = true;
          current.push(nums[i]);
          walk(current);
          current.pop();
          used[i] = false;
        }
      };
      walk([]);
      return out;
    },
    // n! entries: five elements is 120 rows, six would be 720.
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      // Descending input: the output still covers every ordering.
      [[9, 8, 7]],
      [[1, 2, 3, 4]],
      [[-1, 0, 1]],
      [[1, 2, 3, 4, 5]]
    ]
  },

  "word-search-ii": {
    comparison: "unordered",
    solve: (board, words) => {
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      const found = new Set();
      const walk = (r, c, word, index) => {
        if (index === word.length) return true;
        if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
        if (board[r][c] !== word[index]) return false;
        const kept = board[r][c];
        board[r][c] = "#";
        const hit =
          walk(r + 1, c, word, index + 1) ||
          walk(r - 1, c, word, index + 1) ||
          walk(r, c + 1, word, index + 1) ||
          walk(r, c - 1, word, index + 1);
        board[r][c] = kept;
        return hit;
      };
      for (const word of words) {
        for (let r = 0; r < rows && !found.has(word); r++) {
          for (let c = 0; c < cols && !found.has(word); c++) {
            if (walk(r, c, word, 0)) found.add(word);
          }
        }
      }
      return [...found];
    },
    generate: () => [
      [[["a"]], ["a"]],
      [[["a"]], ["b"]],
      [[["a", "b"]], ["ab", "ba"]],
      // A cell cannot be reused inside one word, so "aa" needs two cells.
      [[["a", "a"]], ["aa", "aaa"]],
      [[["o", "a"], ["e", "t"]], ["oat", "oa", "ate", "zz"]],
      [
        [["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]],
        ["abc", "adg", "aei", "cfi", "xyz", "beh"]
      ]
    ]
  },

  "n-queens": {
    comparison: "unordered-nested",
    solve: (n) => {
      const out = [];
      const columns = new Set();
      const diagonals = new Set();
      const antiDiagonals = new Set();
      const placement = [];
      const walk = (row) => {
        if (row === n) {
          out.push(
            placement.map((column) => ".".repeat(column) + "Q" + ".".repeat(n - column - 1))
          );
          return;
        }
        for (let column = 0; column < n; column++) {
          if (columns.has(column) || diagonals.has(row - column) || antiDiagonals.has(row + column)) {
            continue;
          }
          columns.add(column);
          diagonals.add(row - column);
          antiDiagonals.add(row + column);
          placement.push(column);
          walk(row + 1);
          placement.pop();
          columns.delete(column);
          diagonals.delete(row - column);
          antiDiagonals.delete(row + column);
        }
      };
      walk(0);
      return out;
    },
    // 2 and 3 have no solution; 7 has 40, and 8 would be 92 boards of 8 rows.
    generate: () => [[2], [3], [5], [6], [7]]
  }
};
