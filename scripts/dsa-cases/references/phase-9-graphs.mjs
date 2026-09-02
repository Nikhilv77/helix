/**
 * Reference solutions and input generators for Phase 9 — Graphs.
 *
 * Every question here takes plain arrays — grids, edge lists, adjacency lists —
 * so no new adapter was needed. Three things did need care.
 *
 * **Several correct answers.** `course-schedule-ii` and `alien-dictionary` both
 * ask for *a* topological order, and most graphs have more than one. Both use
 * the `accepted` hook, enumerating every valid order and skipping any input
 * whose set grows past a cap — the set is written into the bank in full.
 *
 * **Floating point.** `evaluate-division` returns ratios, and the harness
 * compares exactly across four languages. Generated values are all powers of
 * two, so every product and quotient is dyadic and therefore exact; anything
 * like 1/3 would differ in the last bit between runtimes.
 *
 * `clone-graph` is absent. It has no adapter, its adjacency list round-trips
 * unchanged, and `return adjList` passes every case. Like the deep-copy and
 * serializer questions, the check has to verify the returned nodes are *new*,
 * which the array encoding cannot express.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomGrid = (rows, cols, seed, values = [0, 1]) => {
  const rand = seeded(seed);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => values[Math.floor(rand() * values.length)])
  );
};

/**
 * Every topological order of a DAG on `n` nodes, or null once the count passes
 * `limit` — the accepted set is written out in full, so an input with hundreds
 * of valid answers is skipped rather than recorded.
 */
function allTopologicalOrders(n, edges, limit = 8) {
  const adjacency = Array.from({ length: n }, () => []);
  const indegree = new Array(n).fill(0);
  for (const [from, to] of edges) {
    adjacency[from].push(to);
    indegree[to]++;
  }
  const results = [];
  const order = [];
  const used = new Array(n).fill(false);
  let overflowed = false;
  const walk = () => {
    if (overflowed) return;
    if (order.length === n) {
      results.push([...order]);
      if (results.length > limit) overflowed = true;
      return;
    }
    for (let node = 0; node < n; node++) {
      if (used[node] || indegree[node] > 0) continue;
      used[node] = true;
      order.push(node);
      for (const next of adjacency[node]) indegree[next]--;
      walk();
      for (const next of adjacency[node]) indegree[next]++;
      order.pop();
      used[node] = false;
    }
  };
  walk();
  return overflowed ? null : results;
}

/** The letter-order constraints an alien dictionary implies, or null if invalid. */
function alienConstraints(words) {
  const letters = new Set(words.flatMap((word) => [...word]));
  const edges = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    let matched = false;
    for (let j = 0; j < Math.min(a.length, b.length); j++) {
      if (a[j] !== b[j]) {
        edges.push([a[j], b[j]]);
        matched = true;
        break;
      }
    }
    // A longer word before its own prefix is contradictory.
    if (!matched && a.length > b.length) return null;
  }
  return { letters: [...letters].sort(), edges };
}

export const phase9 = {
  "number-of-islands": {
    solve: (grid) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      const seen = grid.map((row) => row.map(() => false));
      let islands = 0;
      const flood = (r, c) => {
        const stack = [[r, c]];
        while (stack.length) {
          const [row, col] = stack.pop();
          if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
          if (seen[row][col] || grid[row][col] !== "1") continue;
          seen[row][col] = true;
          stack.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]);
        }
      };
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] === "1" && !seen[r][c]) {
            islands++;
            flood(r, c);
          }
        }
      }
      return islands;
    },
    generate: () => [
      [[["0"]]],
      [[["1"]]],
      [[["1", "0", "1"]]],
      [[["1"], ["0"], ["1"]]],
      // Diagonal neighbours are not connected.
      [[["1", "0"], ["0", "1"]]],
      [[["1", "1"], ["1", "1"]]],
      [randomGrid(30, 30, 197, ["0", "1"])],
      [Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => "1"))]
    ]
  },

  "max-area-of-island": {
    solve: (grid) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      const seen = grid.map((row) => row.map(() => false));
      let best = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] !== 1 || seen[r][c]) continue;
          let area = 0;
          const stack = [[r, c]];
          while (stack.length) {
            const [row, col] = stack.pop();
            if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
            if (seen[row][col] || grid[row][col] !== 1) continue;
            seen[row][col] = true;
            area++;
            stack.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]);
          }
          best = Math.max(best, area);
        }
      }
      return best;
    },
    generate: () => [
      [[[0]]],
      [[[1]]],
      [[[1, 0, 1, 1]]],
      [[[1, 0], [0, 1]]],
      [[[1, 1], [1, 1]]],
      [randomGrid(30, 30, 199)],
      [Array.from({ length: 25 }, () => Array.from({ length: 25 }, () => 1))]
    ]
  },

  "surrounded-regions": {
    mode: "mutated-first-argument",
    solve: (board) => {
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      // Anything reachable from an edge survives; everything else flips.
      const safe = board.map((row) => row.map(() => false));
      const stack = [];
      for (let r = 0; r < rows; r++) {
        stack.push([r, 0], [r, cols - 1]);
      }
      for (let c = 0; c < cols; c++) {
        stack.push([0, c], [rows - 1, c]);
      }
      while (stack.length) {
        const [row, col] = stack.pop();
        if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
        if (safe[row][col] || board[row][col] !== "O") continue;
        safe[row][col] = true;
        stack.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]);
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c] === "O" && !safe[r][c]) board[r][c] = "X";
        }
      }
      return board;
    },
    generate: () => [
      [[["O"]]],
      [[["O", "O"], ["O", "O"]]],
      [[["X", "X", "X"], ["X", "O", "X"], ["X", "X", "X"]]],
      // Connected to the edge through a single cell, so it survives.
      [[["X", "O", "X"], ["X", "O", "X"], ["X", "X", "X"]]],
      [[["X", "X", "X", "X"], ["X", "O", "O", "X"], ["X", "O", "O", "X"], ["X", "X", "X", "X"]]],
      [randomGrid(20, 20, 211, ["X", "O"])]
    ]
  },

  "rotting-oranges": {
    solve: (grid) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      const state = grid.map((row) => [...row]);
      let fresh = 0;
      let frontier = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (state[r][c] === 1) fresh++;
          if (state[r][c] === 2) frontier.push([r, c]);
        }
      }
      let minutes = 0;
      while (frontier.length && fresh > 0) {
        const next = [];
        for (const [r, c] of frontier) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const row = r + dr;
            const col = c + dc;
            if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
            if (state[row][col] !== 1) continue;
            state[row][col] = 2;
            fresh--;
            next.push([row, col]);
          }
        }
        frontier = next;
        minutes++;
      }
      return fresh > 0 ? -1 : minutes;
    },
    generate: () => [
      [[[0]]],
      [[[1]]],
      [[[2]]],
      [[[2, 1]]],
      [[[1, 2, 1]]],
      // A fresh orange walled off from every rotten one.
      [[[2, 0, 1]]],
      [[[2, 1, 1], [1, 1, 1], [0, 1, 2]]],
      [randomGrid(20, 20, 223, [0, 1, 2])]
    ]
  },

  "pacific-atlantic-water-flow": {
    comparison: "unordered-nested",
    solve: (heights) => {
      const rows = heights.length;
      const cols = heights[0]?.length ?? 0;
      const reach = (starts) => {
        const seen = heights.map((row) => row.map(() => false));
        const stack = [...starts];
        while (stack.length) {
          const [r, c] = stack.pop();
          if (seen[r][c]) continue;
          seen[r][c] = true;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const row = r + dr;
            const col = c + dc;
            if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
            // Walking uphill from the ocean is the same as water flowing down.
            if (!seen[row][col] && heights[row][col] >= heights[r][c]) stack.push([row, col]);
          }
        }
        return seen;
      };
      if (rows === 0 || cols === 0) return [];
      const pacific = reach([
        ...Array.from({ length: rows }, (_, r) => [r, 0]),
        ...Array.from({ length: cols }, (_, c) => [0, c])
      ]);
      const atlantic = reach([
        ...Array.from({ length: rows }, (_, r) => [r, cols - 1]),
        ...Array.from({ length: cols }, (_, c) => [rows - 1, c])
      ]);
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) if (pacific[r][c] && atlantic[r][c]) out.push([r, c]);
      }
      return out;
    },
    generate: () => [
      [[[1, 1]]],
      [[[1], [1]]],
      [[[1, 2], [3, 4]]],
      // A flat plateau: every cell reaches both oceans.
      [Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 7))],
      [[[10, 1], [1, 10]]],
      [Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => r + c))]
    ]
  },

  "word-search": {
    solve: (board, word) => {
      const rows = board.length;
      const cols = board[0]?.length ?? 0;
      const walk = (r, c, index) => {
        if (index === word.length) return true;
        if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
        if (board[r][c] !== word[index]) return false;
        const kept = board[r][c];
        board[r][c] = "#";
        const found =
          walk(r + 1, c, index + 1) ||
          walk(r - 1, c, index + 1) ||
          walk(r, c + 1, index + 1) ||
          walk(r, c - 1, index + 1);
        board[r][c] = kept;
        return found;
      };
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) if (walk(r, c, 0)) return true;
      }
      return false;
    },
    generate: () => [
      [[["A"]], "A"],
      [[["A"]], "B"],
      [[["A", "B"]], "AB"],
      [[["A", "B"]], "BA"],
      // A cell cannot be reused, so this fails even though both letters exist.
      [[["A", "A"]], "AAA"],
      [[["A", "B"], ["C", "D"]], "ABDC"],
      [[["A", "B"], ["C", "D"]], "ABCD"],
      [Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => "A")), "AAAAAAAAAAAA"]
    ]
  },

  "number-of-connected-components-in-an-undirected-graph": {
    solve: (n, edges) => {
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      let components = n;
      for (const [a, b] of edges) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) {
          parent[rootA] = rootB;
          components--;
        }
      }
      return components;
    },
    generate: () => [
      [1, []],
      [2, []],
      [2, [[0, 1]]],
      // A duplicated edge must not merge twice.
      [3, [[0, 1], [0, 1]]],
      [4, [[0, 1], [2, 3]]],
      [6, [[0, 1], [1, 2], [3, 4]]],
      [100, Array.from({ length: 99 }, (_, i) => [i, i + 1])],
      [100, []]
    ]
  },

  "graph-valid-tree": {
    // A tree on n nodes has exactly n-1 edges and one component.
    solve: (n, edges) => {
      if (edges.length !== n - 1) return false;
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      for (const [a, b] of edges) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) return false;
        parent[rootA] = rootB;
      }
      return true;
    },
    generate: () => [
      [1, []],
      [2, []],
      [2, [[0, 1]]],
      [3, [[0, 1], [1, 2]]],
      // Right edge count, wrong shape: a cycle plus an isolated node.
      [4, [[0, 1], [1, 2], [2, 0]]],
      [4, [[0, 1], [1, 2], [2, 3], [3, 0]]],
      [50, Array.from({ length: 49 }, (_, i) => [i, i + 1])]
    ]
  },

  "redundant-connection": {
    // The answer is the last edge that closes a cycle.
    solve: (edges) => {
      const parent = Array.from({ length: edges.length + 1 }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      let answer = [];
      for (const [a, b] of edges) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) answer = [a, b];
        else parent[rootA] = rootB;
      }
      return answer;
    },
    generate: () => [
      [[[1, 2], [2, 1]]],
      [[[1, 2], [1, 3], [2, 3]]],
      [[[1, 2], [2, 3], [1, 3]]],
      [[[1, 2], [2, 3], [3, 4], [4, 1]]],
      [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]],
      [[...Array.from({ length: 50 }, (_, i) => [i + 1, i + 2]), [1, 51]]]
    ]
  },

  "accounts-merge": {
    // Emails inside a group are sorted, so only the group order is free.
    comparison: "unordered-nested",
    solve: (accounts) => {
      const owner = new Map();
      const parent = new Map();
      const find = (x) => {
        if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
        return parent.get(x);
      };
      for (const [name, ...emails] of accounts) {
        for (const email of emails) {
          if (!parent.has(email)) parent.set(email, email);
          owner.set(email, name);
          parent.set(find(email), find(emails[0]));
        }
      }
      const groups = new Map();
      for (const email of parent.keys()) {
        const root = find(email);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(email);
      }
      return [...groups.entries()].map(([root, emails]) => [owner.get(root), ...emails.sort()]);
    },
    generate: () => [
      [[["A", "a@x.com"]]],
      [[["A", "a@x.com"], ["A", "a@x.com"]]],
      // Same name, no shared email — these must stay separate.
      [[["A", "a@x.com"], ["A", "b@x.com"]]],
      // Accounts sharing an email are the same person, so they share a name;
      // differing names would make the merged group's name ambiguous.
      [[["A", "a@x.com", "b@x.com"], ["A", "b@x.com", "c@x.com"]]],
      [[["A", "z@x.com", "a@x.com"]]],
      [
        [
          ["A", "a1@x.com", "a2@x.com"],
          ["B", "b1@x.com"],
          ["A", "a2@x.com", "a3@x.com"],
          ["B", "c1@x.com", "b1@x.com"]
        ]
      ]
    ]
  },

  "course-schedule": {
    solve: (numCourses, prerequisites) => {
      const adjacency = Array.from({ length: numCourses }, () => []);
      const indegree = new Array(numCourses).fill(0);
      for (const [course, prerequisite] of prerequisites) {
        adjacency[prerequisite].push(course);
        indegree[course]++;
      }
      const queue = [];
      for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
      let taken = 0;
      while (queue.length) {
        const course = queue.shift();
        taken++;
        for (const next of adjacency[course]) if (--indegree[next] === 0) queue.push(next);
      }
      return taken === numCourses;
    },
    generate: () => [
      [1, []],
      [1, [[0, 0]]],
      [3, [[1, 0], [2, 1]]],
      [3, [[1, 0], [2, 1], [0, 2]]],
      // Two independent chains, and a cycle away from the entry point.
      [4, [[1, 0], [3, 2]]],
      [5, [[1, 0], [2, 1], [3, 2], [2, 3]]],
      [100, Array.from({ length: 99 }, (_, i) => [i + 1, i])]
    ]
  },

  "course-schedule-ii": {
    solve: (numCourses, prerequisites) => {
      const adjacency = Array.from({ length: numCourses }, () => []);
      const indegree = new Array(numCourses).fill(0);
      for (const [course, prerequisite] of prerequisites) {
        adjacency[prerequisite].push(course);
        indegree[course]++;
      }
      const queue = [];
      for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
      const order = [];
      while (queue.length) {
        const course = queue.shift();
        order.push(course);
        for (const next of adjacency[course]) if (--indegree[next] === 0) queue.push(next);
      }
      return order.length === numCourses ? order : [];
    },
    accepted: (numCourses, prerequisites) => {
      const edges = prerequisites.map(([course, prerequisite]) => [prerequisite, course]);
      const orders = allTopologicalOrders(numCourses, edges);
      // A cycle has no topological order; the answer is the empty list.
      return orders && orders.length ? orders : [[]];
    },
    // Inputs are chosen so the set of valid orders stays small enough to record.
    generate: () =>
      [
        [1, []],
        [2, [[1, 0]]],
        [3, [[1, 0], [2, 1]]],
        [3, [[1, 0], [2, 0]]],
        [3, [[1, 0], [2, 1], [0, 2]]],
        [4, [[1, 0], [2, 1], [3, 2]]],
        [5, [[1, 0], [2, 1], [3, 2], [4, 3]]]
      ].filter(([n, prerequisites]) =>
        Boolean(allTopologicalOrders(n, prerequisites.map(([c, p]) => [p, c])))
      )
  },

  "alien-dictionary": {
    solve: (words) => {
      const constraints = alienConstraints(words);
      if (!constraints) return "";
      const { letters, edges } = constraints;
      const index = new Map(letters.map((letter, i) => [letter, i]));
      const adjacency = letters.map(() => []);
      const indegree = new Array(letters.length).fill(0);
      const seen = new Set();
      for (const [from, to] of edges) {
        const key = `${from}${to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        adjacency[index.get(from)].push(index.get(to));
        indegree[index.get(to)]++;
      }
      const queue = [];
      for (let i = 0; i < letters.length; i++) if (indegree[i] === 0) queue.push(i);
      const order = [];
      while (queue.length) {
        const node = queue.shift();
        order.push(letters[node]);
        for (const next of adjacency[node]) if (--indegree[next] === 0) queue.push(next);
      }
      return order.length === letters.length ? order.join("") : "";
    },
    accepted: (words) => {
      const constraints = alienConstraints(words);
      if (!constraints) return [""];
      const { letters, edges } = constraints;
      const index = new Map(letters.map((letter, i) => [letter, i]));
      const orders = allTopologicalOrders(
        letters.length,
        edges.map(([from, to]) => [index.get(from), index.get(to)])
      );
      if (!orders || orders.length === 0) return [""];
      return orders.map((order) => order.map((node) => letters[node]).join(""));
    },
    generate: () =>
      [
        [["a"]],
        [["a", "b"]],
        [["ab", "aa"]],
        [["ab", "a"]],
        [["ba", "bc", "ac"]],
        [["wrt", "wrf", "er", "ett", "rftt", "te"]],
        [["z", "z"]],
        [["abc", "abd", "bca"]]
      ].filter(([words]) => {
        const constraints = alienConstraints(words);
        if (!constraints) return true;
        const index = new Map(constraints.letters.map((letter, i) => [letter, i]));
        return Boolean(
          allTopologicalOrders(
            constraints.letters.length,
            constraints.edges.map(([from, to]) => [index.get(from), index.get(to)])
          )
        );
      })
  },

  "minimum-height-trees": {
    comparison: "unordered",
    solve: (n, edges) => {
      if (n === 1) return [0];
      const adjacency = Array.from({ length: n }, () => new Set());
      for (const [a, b] of edges) {
        adjacency[a].add(b);
        adjacency[b].add(a);
      }
      // Peel leaves inward; the last one or two nodes standing are the centres.
      let remaining = n;
      let leaves = [];
      for (let i = 0; i < n; i++) if (adjacency[i].size === 1) leaves.push(i);
      while (remaining > 2) {
        remaining -= leaves.length;
        const next = [];
        for (const leaf of leaves) {
          for (const neighbour of adjacency[leaf]) {
            adjacency[neighbour].delete(leaf);
            if (adjacency[neighbour].size === 1) next.push(neighbour);
          }
          adjacency[leaf].clear();
        }
        leaves = next;
      }
      return leaves;
    },
    generate: () => [
      [1, []],
      [2, [[0, 1]]],
      [3, [[0, 1], [1, 2]]],
      // An even-length path has two centres, an odd-length path has one.
      [4, [[0, 1], [1, 2], [2, 3]]],
      [5, [[0, 1], [1, 2], [2, 3], [3, 4]]],
      [7, [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [3, 6]]],
      [50, Array.from({ length: 49 }, (_, i) => [i, i + 1])]
    ]
  },

  "word-ladder": {
    solve: (beginWord, endWord, wordList) => {
      const words = new Set(wordList);
      if (!words.has(endWord)) return 0;
      let frontier = [beginWord];
      let steps = 1;
      words.delete(beginWord);
      while (frontier.length) {
        const next = [];
        for (const word of frontier) {
          if (word === endWord) return steps;
          for (let i = 0; i < word.length; i++) {
            for (let code = 97; code < 123; code++) {
              const candidate = word.slice(0, i) + String.fromCharCode(code) + word.slice(i + 1);
              if (!words.has(candidate)) continue;
              words.delete(candidate);
              next.push(candidate);
            }
          }
        }
        frontier = next;
        steps++;
      }
      return 0;
    },
    generate: () => [
      ["a", "a", ["a"]],
      ["a", "b", ["b"]],
      ["a", "c", ["b", "c"]],
      // The end word is missing from the list, so there is no ladder.
      ["hot", "dog", ["hot", "dot"]],
      ["hot", "dog", ["hot", "dot", "dog"]],
      ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]],
      ["aaa", "bbb", ["aab", "abb", "bbb"]]
    ]
  },

  "network-delay-time": {
    solve: (times, n, k) => {
      const distance = new Array(n + 1).fill(Infinity);
      distance[k] = 0;
      // Bellman-Ford: simple, and correct without a priority queue.
      for (let round = 0; round < n; round++) {
        for (const [from, to, weight] of times) {
          if (distance[from] + weight < distance[to]) distance[to] = distance[from] + weight;
        }
      }
      const worst = Math.max(...distance.slice(1));
      return worst === Infinity ? -1 : worst;
    },
    generate: () => [
      [[], 1, 1],
      [[], 2, 1],
      [[[1, 2, 1]], 2, 1],
      [[[1, 2, 1]], 2, 2],
      // Two routes to the same node; the shorter one wins.
      [[[1, 2, 5], [1, 3, 1], [3, 2, 1]], 3, 1],
      [[[1, 2, 1], [2, 3, 2], [1, 3, 4]], 3, 1],
      [Array.from({ length: 49 }, (_, i) => [i + 1, i + 2, 1]), 50, 1]
    ]
  },

  "cheapest-flights-within-k-stops": {
    solve: (n, flights, src, dst, k) => {
      let cost = new Array(n).fill(Infinity);
      cost[src] = 0;
      // k stops means k+1 edges, and each round must read the previous round's
      // costs — relaxing in place would allow more hops than allowed.
      for (let round = 0; round <= k; round++) {
        const next = [...cost];
        for (const [from, to, price] of flights) {
          if (cost[from] + price < next[to]) next[to] = cost[from] + price;
        }
        cost = next;
      }
      return cost[dst] === Infinity ? -1 : cost[dst];
    },
    generate: () => [
      [1, [], 0, 0, 0],
      [2, [], 0, 1, 0],
      [2, [[0, 1, 5]], 0, 1, 0],
      [3, [[0, 1, 1], [1, 2, 1], [0, 2, 5]], 0, 2, 0],
      // One stop makes the two-hop route legal and cheaper.
      [3, [[0, 1, 1], [1, 2, 1], [0, 2, 5]], 0, 2, 1],
      [4, [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], 0, 3, 2],
      [30, Array.from({ length: 29 }, (_, i) => [i, i + 1, 1]), 0, 29, 28]
    ]
  },

  "evaluate-division": {
    /**
     * Every generated value is a power of two, so all ratios are dyadic and
     * compare exactly across the four runtimes. A ratio like 1/3 would not.
     */
    solve: (equations, values, queries) => {
      const graph = new Map();
      const link = (a, b, weight) => {
        if (!graph.has(a)) graph.set(a, new Map());
        graph.get(a).set(b, weight);
      };
      equations.forEach(([a, b], i) => {
        link(a, b, values[i]);
        link(b, a, 1 / values[i]);
      });
      const ratio = (from, to) => {
        if (!graph.has(from) || !graph.has(to)) return -1;
        const seen = new Set([from]);
        const stack = [[from, 1]];
        while (stack.length) {
          const [node, product] = stack.pop();
          if (node === to) return product;
          for (const [next, weight] of graph.get(node)) {
            if (seen.has(next)) continue;
            seen.add(next);
            stack.push([next, product * weight]);
          }
        }
        return -1;
      };
      return queries.map(([a, b]) => ratio(a, b));
    },
    generate: () => [
      [[["a", "b"]], [2], [["a", "b"]]],
      [[["a", "b"]], [2], [["b", "a"]]],
      [[["a", "b"]], [2], [["a", "a"]]],
      // Unknown symbols, and a symbol with no path to the other component.
      [[["a", "b"]], [2], [["a", "z"]]],
      [[["a", "b"], ["c", "d"]], [2, 4], [["a", "d"]]],
      [[["a", "b"], ["b", "c"], ["c", "d"]], [2, 4, 8], [["a", "d"], ["d", "a"]]],
      [[["a", "b"]], [0.5], [["a", "b"], ["b", "a"]]]
    ]
  },

  "reconstruct-itinerary": {
    // Hierholzer, always taking the lexicographically smallest next airport.
    solve: (tickets) => {
      const graph = new Map();
      for (const [from, to] of [...tickets].sort((a, b) => (a[1] < b[1] ? -1 : 1))) {
        if (!graph.has(from)) graph.set(from, []);
        graph.get(from).push(to);
      }
      const route = [];
      const stack = ["JFK"];
      while (stack.length) {
        const airport = stack[stack.length - 1];
        const next = graph.get(airport);
        if (next && next.length) stack.push(next.shift());
        else route.push(stack.pop());
      }
      return route.reverse();
    },
    generate: () => [
      [[["JFK", "A"]]],
      [[["JFK", "A"], ["A", "B"]]],
      [[["JFK", "A"], ["A", "JFK"], ["JFK", "B"]]],
      // Two ways out of JFK; the smaller airport code goes first.
      [[["JFK", "KUL"], ["JFK", "NRT"], ["NRT", "JFK"]]],
      [[["JFK", "SFO"], ["JFK", "ATL"], ["SFO", "ATL"], ["ATL", "JFK"], ["ATL", "SFO"]]],
      [[["JFK", "AAA"], ["AAA", "BBB"], ["BBB", "JFK"], ["JFK", "CCC"]]]
    ]
  }
};
