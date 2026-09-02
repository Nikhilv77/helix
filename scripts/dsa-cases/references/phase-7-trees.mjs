/**
 * Reference solutions and input generators for Phase 7 — Trees.
 *
 * Cases store trees as LeetCode level-order arrays; the adapter builds the nodes
 * before the candidate's function runs and serializes any returned tree back.
 * So these references build the tree themselves, run the real algorithm on
 * nodes, and serialize with **the harness's own routines, reimplemented here
 * exactly**. `buildTree` and `treeToArray` below are line-for-line ports of
 * `trailgradBuildTree` and `trailgradTreeToArray` in `code-test-harness.ts`.
 * If they ever drift, every expected value in this phase drifts with them —
 * which is why the replay against each question's authored cases matters more
 * here than anywhere else.
 *
 * The whole phase is covered.
 */

class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

/** Port of `trailgradBuildTree`. Nulls are placeholders; children advance only for real nodes. */
function buildTree(values) {
  if (!values.length || values[0] === null) return null;
  const nodes = values.map((value) => (value === null ? null : new TreeNode(value)));
  let child = 1;
  for (const node of nodes) {
    if (!node) continue;
    node.left = nodes[child++] ?? null;
    node.right = nodes[child++] ?? null;
  }
  return nodes[0];
}

/** Port of `trailgradTreeToArray`. Level order with nulls, trailing nulls trimmed. */
function treeToArray(root) {
  if (!root) return [];
  const values = [];
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) {
      values.push(null);
      continue;
    }
    values.push(node.val);
    queue.push(node.left, node.right);
  }
  while (values[values.length - 1] === null) values.pop();
  return values;
}

/** Port of `trailgradTreeToRightChain`, used by the flatten question. */
function treeRightChain(root) {
  const values = [];
  const seen = new Set();
  let node = root;
  while (node && !seen.has(node)) {
    seen.add(node);
    values.push(node.val);
    if (node.right) values.push(null);
    node = node.right;
  }
  return values;
}

/**
 * A chain of right children, 1 -> 2 -> ... -> n.
 *
 * In the compact format a node's children are the next two free slots, so a
 * right chain needs an explicit null standing in for each missing left child.
 */
const rightSkew = (n) => {
  const out = n ? [1] : [];
  for (let i = 2; i <= n; i++) out.push(null, i);
  return out;
};

/** The mirror: a chain of left children, with the null after each value. */
const leftSkew = (n) => {
  const out = n ? [1] : [];
  for (let i = 2; i <= n; i++) out.push(i, null);
  return out;
};

/** [1..n] in level order — a complete tree, and perfect when n is 2^k - 1. */
const complete = (n) => Array.from({ length: n }, (_, i) => i + 1);

/** A perfect BST over `size` = 2^k - 1 consecutive values, in level order. */
function perfectBst(size) {
  const sorted = Array.from({ length: size }, (_, i) => i + 1);
  const levels = [];
  const fill = (lo, hi, depth) => {
    if (lo > hi) return;
    const mid = (lo + hi) >> 1;
    (levels[depth] ??= []).push(sorted[mid]);
    fill(lo, mid - 1, depth + 1);
    fill(mid + 1, hi, depth + 1);
  };
  fill(0, sorted.length - 1, 0);
  return levels.flat();
}

/** The same tree with two of its values exchanged — the recover-BST setup. */
function swapped(values, a, b) {
  const copy = [...values];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

export const phase7 = {
  "maximum-depth-of-binary-tree": {
    solve: (values) => {
      const depth = (node) => (node ? 1 + Math.max(depth(node.left), depth(node.right)) : 0);
      return depth(buildTree(values));
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, null, 2]],
      [complete(15)],
      [rightSkew(100)],
      [leftSkew(100)]
    ]
  },

  "minimum-depth-of-binary-tree": {
    solve: (values) => {
      const depth = (node) => {
        if (!node) return 0;
        // A node with one child is not a leaf — the empty side must not count.
        if (!node.left) return 1 + depth(node.right);
        if (!node.right) return 1 + depth(node.left);
        return 1 + Math.min(depth(node.left), depth(node.right));
      };
      return depth(buildTree(values));
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3, 4, 5]],
      [complete(15)],
      [rightSkew(50)]
    ]
  },

  "same-tree": {
    solve: (p, q) => {
      const same = (a, b) => {
        if (!a || !b) return a === b;
        return a.val === b.val && same(a.left, b.left) && same(a.right, b.right);
      };
      return same(buildTree(p), buildTree(q));
    },
    generate: () => [
      [[], []],
      [[1], []],
      [[1], [1]],
      [[1], [2]],
      [[1, 2], [1, 2]],
      // Same values, mirrored shape.
      [[1, null, 2], [1, 2]],
      [complete(15), complete(15)],
      [complete(15), swapped(complete(15), 7, 8)]
    ]
  },

  "symmetric-tree": {
    solve: (values) => {
      const mirror = (a, b) => {
        if (!a || !b) return a === b;
        return a.val === b.val && mirror(a.left, b.right) && mirror(a.right, b.left);
      };
      const root = buildTree(values);
      return !root || mirror(root.left, root.right);
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, 2, 2]],
      // Symmetric in shape but not in value, and the reverse.
      [[1, 2, 3]],
      [[1, 2, 2, null, 3, 3]],
      [[1, 2, 2, 3, null, null, 3]],
      [[1, 2, 2, 3, 4, 4, 3, 5, 6, 7, 8, 8, 7, 6, 5]]
    ]
  },

  "invert-binary-tree": {
    solve: (values) => {
      const invert = (node) => {
        if (!node) return null;
        const left = invert(node.left);
        node.left = invert(node.right);
        node.right = left;
        return node;
      };
      return treeToArray(invert(buildTree(values)));
    },
    generate: () => [
      [[1]],
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3, 4]],
      [complete(15)],
      [rightSkew(50)]
    ]
  },

  "subtree-of-another-tree": {
    solve: (rootValues, subValues) => {
      const same = (a, b) => {
        if (!a || !b) return a === b;
        return a.val === b.val && same(a.left, b.left) && same(a.right, b.right);
      };
      const contains = (node, target) => {
        if (!node) return target === null;
        return same(node, target) || contains(node.left, target) || contains(node.right, target);
      };
      return contains(buildTree(rootValues), buildTree(subValues));
    },
    generate: () => [
      [[1], [1]],
      [[1], [2]],
      [[1, 2], [2]],
      // Present as a value but not as a whole subtree.
      [[1, 2, 3], [2, 4]],
      [[3, 4, 5, 1, 2], [3, 4, 5, 1, 2]],
      [complete(15), [7, 14, 15]],
      [complete(15), [7, 14]]
    ]
  },

  "balanced-binary-tree": {
    solve: (values) => {
      let balanced = true;
      const height = (node) => {
        if (!node) return 0;
        const left = height(node.left);
        const right = height(node.right);
        if (Math.abs(left - right) > 1) balanced = false;
        return 1 + Math.max(left, right);
      };
      height(buildTree(values));
      return balanced;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, 2, 3, 4]],
      // Off by exactly one is still balanced; by two is not.
      [[1, 2, 3, 4, null, null, null, 5]],
      [complete(15)],
      [rightSkew(20)]
    ]
  },

  "diameter-of-binary-tree": {
    solve: (values) => {
      let best = 0;
      const depth = (node) => {
        if (!node) return 0;
        const left = depth(node.left);
        const right = depth(node.right);
        best = Math.max(best, left + right);
        return 1 + Math.max(left, right);
      };
      depth(buildTree(values));
      return best;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2, 3]],
      // The longest path does not pass through the root.
      [[1, 2, null, 3, 4, null, null, 5, 6]],
      [complete(15)],
      [rightSkew(50)]
    ]
  },

  "path-sum": {
    solve: (values, targetSum) => {
      const has = (node, remaining) => {
        if (!node) return false;
        if (!node.left && !node.right) return remaining === node.val;
        return has(node.left, remaining - node.val) || has(node.right, remaining - node.val);
      };
      return has(buildTree(values), targetSum);
    },
    generate: () => [
      [[], 0],
      [[1], 1],
      [[1], 0],
      // The sum is reached at an internal node, not a leaf — must not count.
      [[1, 2], 1],
      [[1, 2], 3],
      [[-2, null, -3], -5],
      [complete(15), 1 + 2 + 4 + 8],
      [complete(15), 999]
    ]
  },

  "sum-root-to-leaf-numbers": {
    solve: (values) => {
      const walk = (node, running) => {
        if (!node) return 0;
        const next = running * 10 + node.val;
        if (!node.left && !node.right) return next;
        return walk(node.left, next) + walk(node.right, next);
      };
      return walk(buildTree(values), 0);
    },
    generate: () => [
      [[]],
      [[0]],
      [[9]],
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3, 4, 5, 6, 7]],
      [rightSkew(9)]
    ]
  },

  "path-sum-ii": {
    comparison: "unordered-nested",
    solve: (values, targetSum) => {
      const out = [];
      const walk = (node, remaining, path) => {
        if (!node) return;
        path.push(node.val);
        if (!node.left && !node.right && remaining === node.val) out.push([...path]);
        walk(node.left, remaining - node.val, path);
        walk(node.right, remaining - node.val, path);
        path.pop();
      };
      walk(buildTree(values), targetSum, []);
      return out;
    },
    generate: () => [
      [[], 0],
      [[1], 1],
      [[1], 2],
      [[1, 2, 2], 3],
      [[0, 0, 0], 0],
      [complete(15), 15],
      [complete(15), 1 + 3 + 7]
    ]
  },

  "binary-tree-level-order-traversal": {
    solve: (values) => {
      const out = [];
      let level = buildTree(values) ? [buildTree(values)] : [];
      while (level.length) {
        out.push(level.map((node) => node.val));
        level = level.flatMap((node) => [node.left, node.right].filter(Boolean));
      }
      return out;
    },
    generate: () => [
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3, 4, 5, 6, 7]],
      [[1, 2, 3, null, null, 4, 5]],
      [complete(15)],
      [rightSkew(30)]
    ]
  },

  "binary-tree-zigzag-level-order-traversal": {
    solve: (values) => {
      const out = [];
      const root = buildTree(values);
      let level = root ? [root] : [];
      let leftToRight = true;
      while (level.length) {
        const row = level.map((node) => node.val);
        out.push(leftToRight ? row : row.reverse());
        leftToRight = !leftToRight;
        level = level.flatMap((node) => [node.left, node.right].filter(Boolean));
      }
      return out;
    },
    generate: () => [
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3, 4, 5, 6, 7]],
      [[1, 2, 3, null, null, 4, 5]],
      [complete(15)],
      [rightSkew(30)]
    ]
  },

  "binary-tree-right-side-view": {
    solve: (values) => {
      const out = [];
      const root = buildTree(values);
      let level = root ? [root] : [];
      while (level.length) {
        out.push(level[level.length - 1].val);
        level = level.flatMap((node) => [node.left, node.right].filter(Boolean));
      }
      return out;
    },
    generate: () => [
      [[1, 2]],
      [[1, null, 2]],
      // The rightmost node of a level can sit under a left child.
      [[1, 2, 3, 4]],
      [[1, 2, 3, null, 5, null, 4]],
      [complete(15)],
      [leftSkew(30)]
    ]
  },

  "populating-next-right-pointers-in-each-node": {
    // The expected shape is level order with "#" closing each level, which is
    // how the authored cases record the next pointers.
    solve: (values) => {
      const out = [];
      const root = buildTree(values);
      let level = root ? [root] : [];
      while (level.length) {
        for (const node of level) out.push(node.val);
        out.push("#");
        level = level.flatMap((node) => [node.left, node.right].filter(Boolean));
      }
      return out;
    },
    generate: () => [
      [[1]],
      [[1, 2, 3]],
      [complete(15)],
      [complete(31)]
    ]
  },

  "validate-binary-search-tree": {
    solve: (values) => {
      const valid = (node, low, high) => {
        if (!node) return true;
        if ((low !== null && node.val <= low) || (high !== null && node.val >= high)) return false;
        return valid(node.left, low, node.val) && valid(node.right, node.val, high);
      };
      return valid(buildTree(values), null, null);
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 1]],
      [[2, 1, 3]],
      // Locally fine, globally wrong: 4 is in the left subtree of 5 but larger
      // than 3, which a parent-only check misses.
      [[5, 1, 4, null, null, 3, 6]],
      [[10, 5, 15, null, null, 6, 20]],
      [perfectBst(15)],
      [swapped(perfectBst(15), 3, 4)]
    ]
  },

  "kth-smallest-element-in-a-bst": {
    solve: (values, k) => {
      const order = [];
      const walk = (node) => {
        if (!node) return;
        walk(node.left);
        order.push(node.val);
        walk(node.right);
      };
      walk(buildTree(values));
      return order[k - 1];
    },
    generate: () => [
      [[1], 1],
      [[2, 1], 1],
      [[2, 1], 2],
      [perfectBst(7), 1],
      [perfectBst(7), 4],
      [perfectBst(7), 7],
      [perfectBst(31), 16]
    ]
  },

  "convert-sorted-array-to-binary-search-tree": {
    solve: (nums) => {
      const build = (lo, hi) => {
        if (lo > hi) return null;
        const mid = Math.floor((lo + hi) / 2);
        const node = new TreeNode(nums[mid]);
        node.left = build(lo, mid - 1);
        node.right = build(mid + 1, hi);
        return node;
      };
      return treeToArray(build(0, nums.length - 1));
    },
    /**
     * Every tree reachable by taking either middle at each step.
     *
     * Not literally every height-balanced BST — a root slightly off-centre can
     * still balance for some sizes — but it covers every implementation anyone
     * writes, and it is a wider net than the two the authored cases allowed.
     */
    accepted: (nums) => {
      const build = (lo, hi) => {
        if (lo > hi) return [null];
        const mids = new Set([Math.floor((lo + hi) / 2), Math.ceil((lo + hi) / 2)]);
        const trees = [];
        for (const mid of mids) {
          for (const left of build(lo, mid - 1)) {
            for (const right of build(mid + 1, hi)) {
              const node = new TreeNode(nums[mid]);
              node.left = left;
              node.right = right;
              trees.push(node);
            }
          }
        }
        return trees;
      };
      const seen = new Set();
      const out = [];
      for (const tree of build(0, nums.length - 1)) {
        const key = JSON.stringify(treeToArray(tree));
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(JSON.parse(key));
      }
      return out;
    },
    // Sizes stay small: the accepted set is written out in full, and it grows
    // multiplicatively with the number of even-length subarrays.
    generate: () => [
      [[]],
      [[1]],
      [[1, 2, 3]],
      [[-5, 0, 5]],
      [[1, 2, 3, 4, 5, 6, 7]],
      [[0, 1, 2, 3, 4, 5, 6, 7, 8]]
    ]
  },

  "recover-binary-search-tree": {
    solve: (values) => {
      const root = buildTree(values);
      const order = [];
      const walk = (node) => {
        if (!node) return;
        walk(node.left);
        order.push(node);
        walk(node.right);
      };
      walk(root);
      // The two out-of-place nodes are the first larger-than-next and the last
      // smaller-than-previous; adjacent swaps make those the same pair.
      let first = null;
      let second = null;
      for (let i = 0; i + 1 < order.length; i++) {
        if (order[i].val > order[i + 1].val) {
          if (!first) first = order[i];
          second = order[i + 1];
        }
      }
      if (first && second) {
        const value = first.val;
        first.val = second.val;
        second.val = value;
      }
      return treeToArray(root);
    },
    generate: () => [
      [[2, 1]],
      [[1, null, 2]],
      [swapped(perfectBst(7), 0, 1)],
      [swapped(perfectBst(7), 3, 6)],
      // Two nodes that are adjacent in order, and two that are far apart.
      [swapped(perfectBst(15), 0, 14)],
      [swapped(perfectBst(15), 7, 8)],
      [perfectBst(15)]
    ]
  },

  "flatten-binary-tree-to-linked-list": {
    solve: (values) => {
      const root = buildTree(values);
      const order = [];
      const walk = (node) => {
        if (!node) return;
        order.push(node);
        walk(node.left);
        walk(node.right);
      };
      walk(root);
      for (let i = 0; i < order.length; i++) {
        order[i].left = null;
        order[i].right = order[i + 1] ?? null;
      }
      return treeRightChain(root);
    },
    generate: () => [
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3]],
      [complete(7)],
      [complete(15)],
      [leftSkew(20)]
    ]
  },

  "construct-binary-tree-from-preorder-and-inorder-traversal": {
    solve: (preorder, inorder) => {
      const index = new Map(inorder.map((value, i) => [value, i]));
      let position = 0;
      const build = (lo, hi) => {
        if (lo > hi) return null;
        const value = preorder[position++];
        const node = new TreeNode(value);
        const mid = index.get(value);
        node.left = build(lo, mid - 1);
        node.right = build(mid + 1, hi);
        return node;
      };
      return treeToArray(build(0, inorder.length - 1));
    },
    generate: () => [
      [[], []],
      [[1], [1]],
      [[1, 2], [2, 1]],
      [[1, 2], [1, 2]],
      // A perfect tree, and both fully skewed shapes.
      [[4, 2, 1, 3, 6, 5, 7], [1, 2, 3, 4, 5, 6, 7]],
      [[1, 2, 3, 4, 5], [5, 4, 3, 2, 1]],
      [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]]
    ]
  },

  "lowest-common-ancestor-of-a-binary-tree": {
    // The adapter turns the two values into nodes and reports the answer's value.
    solve: (values, p, q) => {
      const root = buildTree(values);
      const lca = (node) => {
        if (!node || node.val === p || node.val === q) return node;
        const left = lca(node.left);
        const right = lca(node.right);
        if (left && right) return node;
        return left ?? right;
      };
      return lca(root)?.val ?? null;
    },
    generate: () => [
      [[1], 1, 1],
      [[1, 2], 1, 2],
      [[1, 2], 2, 2],
      // One node is the ancestor of the other.
      [complete(15), 2, 5],
      [complete(15), 8, 15],
      [complete(15), 4, 4],
      [complete(31), 16, 31]
    ]
  },

  "all-nodes-distance-k-in-binary-tree": {
    comparison: "unordered",
    solve: (values, target, k) => {
      const root = buildTree(values);
      const parents = new Map();
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        for (const child of [node.left, node.right]) {
          if (!child) continue;
          parents.set(child, node);
          stack.push(child);
        }
      }
      let start = null;
      const find = (node) => {
        if (!node) return;
        if (node.val === target) start = node;
        find(node.left);
        find(node.right);
      };
      find(root);
      // Breadth-first over the tree treated as an undirected graph.
      const seen = new Set([start]);
      let frontier = [start];
      for (let step = 0; step < k; step++) {
        frontier = frontier
          .flatMap((node) => [node.left, node.right, parents.get(node)])
          .filter((node) => node && !seen.has(node));
        for (const node of frontier) seen.add(node);
      }
      return frontier.map((node) => node.val);
    },
    generate: () => [
      [[1], 1, 0],
      [[1, 2], 1, 1],
      [[1, 2], 2, 1],
      [[1, 2, 3], 2, 2],
      [complete(15), 1, 1],
      [complete(15), 8, 3],
      [complete(15), 15, 99]
    ]
  },

  "path-sum-iii": {
    solve: (values, targetSum) => {
      // Prefix sums: a path ending here whose running total minus the target has
      // been seen above is a match.
      const counts = new Map([[0, 1]]);
      let total = 0;
      const walk = (node, running) => {
        if (!node) return;
        const next = running + node.val;
        total += counts.get(next - targetSum) ?? 0;
        counts.set(next, (counts.get(next) ?? 0) + 1);
        walk(node.left, next);
        walk(node.right, next);
        counts.set(next, counts.get(next) - 1);
      };
      walk(buildTree(values), 0);
      return total;
    },
    generate: () => [
      [[], 0],
      [[1], 1],
      [[1], 0],
      [[0, 0, 0], 0],
      [[1, -1, 1], 0],
      [complete(15), 3],
      [complete(15), 100]
    ]
  },

  "house-robber-iii": {
    solve: (values) => {
      const best = (node) => {
        if (!node) return [0, 0];
        const left = best(node.left);
        const right = best(node.right);
        // [robbed here, skipped here]
        return [
          node.val + left[1] + right[1],
          Math.max(...left) + Math.max(...right)
        ];
      };
      return Math.max(...best(buildTree(values)));
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[2, 1, 1]],
      [[1, 2, 3]],
      [complete(15)],
      [rightSkew(20)]
    ]
  },

  "binary-tree-maximum-path-sum": {
    solve: (values) => {
      let best = -Infinity;
      const gain = (node) => {
        if (!node) return 0;
        // A negative branch is worth skipping entirely.
        const left = Math.max(gain(node.left), 0);
        const right = Math.max(gain(node.right), 0);
        best = Math.max(best, node.val + left + right);
        return node.val + Math.max(left, right);
      };
      gain(buildTree(values));
      return best;
    },
    generate: () => [
      [[1]],
      [[-1]],
      [[-3, -2, -1]],
      [[2, -1, -2]],
      [[1, -2, 3]],
      [complete(15)],
      [[-10, 9, 20, null, null, 15, 7, 1, 2]]
    ]
  },

  "binary-tree-cameras": {
    solve: (values) => {
      let cameras = 0;
      // 0 = needs cover, 1 = covered, 2 = holds a camera.
      const state = (node) => {
        if (!node) return 1;
        const left = state(node.left);
        const right = state(node.right);
        if (left === 0 || right === 0) {
          cameras++;
          return 2;
        }
        return left === 2 || right === 2 ? 1 : 0;
      };
      if (state(buildTree(values)) === 0) cameras++;
      return cameras;
    },
    generate: () => [
      [[0]],
      [[0, 0]],
      [[0, 0, 0]],
      [[0, 0, null, 0, 0]],
      [complete(7)],
      [complete(15)],
      [rightSkew(12)]
    ]
  },

  "count-complete-tree-nodes": {
    solve: (values) => {
      const count = (node) => (node ? 1 + count(node.left) + count(node.right) : 0);
      return count(buildTree(values));
    },
    // A complete tree by construction — [1..n] in level order.
    generate: () => [
      [[1]],
      [complete(2)],
      [complete(3)],
      [complete(7)],
      [complete(8)],
      [complete(15)],
      [complete(100)],
      [complete(1_000)]
    ]
  },

  "vertical-order-traversal-of-a-binary-tree": {
    solve: (values) => {
      const entries = [];
      const walk = (node, row, column) => {
        if (!node) return;
        entries.push([column, row, node.val]);
        walk(node.left, row + 1, column - 1);
        walk(node.right, row + 1, column + 1);
      };
      walk(buildTree(values), 0, 0);
      // Column, then row, then value — the last tiebreak is what separates this
      // from a plain column grouping.
      entries.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      const out = [];
      let current = null;
      for (const [column, , value] of entries) {
        if (column !== current) {
          current = column;
          out.push([]);
        }
        out[out.length - 1].push(value);
      }
      return out;
    },
    generate: () => [
      [[1]],
      [[1, 2]],
      [[1, null, 2]],
      // Two nodes in the same row and column: the smaller value comes first.
      [[1, 2, 3, 4, 6, 5, 7]],
      [[3, 9, 20, null, null, 15, 7, 1, 2]],
      [complete(15)],
      [rightSkew(20)]
    ]
  },

  "maximum-width-of-binary-tree": {
    /**
     * Width counts the gaps, so it is the distance between the first and last
     * occupied index on a level rather than the number of nodes on it.
     *
     * Subtracting each level's first index before descending is what keeps the
     * numbers small — without it a deep skewed tree overflows, which is the
     * trap the question is really about.
     */
    solve: (values) => {
      const root = buildTree(values);
      if (!root) return 0;
      let best = 0;
      let level = [[root, 0]];
      while (level.length) {
        const base = level[0][1];
        best = Math.max(best, level[level.length - 1][1] - base + 1);
        const next = [];
        for (const [node, index] of level) {
          const offset = index - base;
          if (node.left) next.push([node.left, offset * 2]);
          if (node.right) next.push([node.right, offset * 2 + 1]);
        }
        level = next;
      }
      return best;
    },
    generate: () => [
      [[1]],
      [[1, 2]],
      [[1, null, 2]],
      [[1, 2, 3]],
      // A perfect tree is widest at the bottom; a skewed one is width one
      // everywhere, and is where unnormalised indices would blow up.
      [complete(15)],
      [rightSkew(60)],
      [leftSkew(60)],
      [[1, 3, 2, 5, null, null, 9, 6, null, null, null, null, null, 7]]
    ]
  }
};
