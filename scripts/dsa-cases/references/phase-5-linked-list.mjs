/**
 * Reference solutions and input generators for Phase 5 — Linked List.
 *
 * These questions never see a node here. The `linked-list` adapter builds a
 * chain from an array before the candidate's function runs and serializes the
 * returned chain back to an array afterwards, so the stored `arguments` and
 * `expectedValue` are both plain arrays — and a reference that produces the
 * right array is the right reference, whatever route it takes to get there.
 *
 * The three questions built on a structure an array cannot express —
 * `linked-list-cycle`, `linked-list-cycle-ii` and
 * `intersection-of-two-linked-lists` — now have their own adapters, which close
 * the cycle from `pos` or join two lists at `skipA`/`skipB` before the
 * candidate's function is called. Their references therefore work on the same
 * `(values, pos)` and `(valuesA, valuesB, skipA, skipB)` encoding the adapter
 * reads, and answer in the terms the adapter reports back: an index for the
 * cycle entry, the shared node's value for the intersection.
 *
 * **Three of the phase's twenty questions are still not here.**
 *
 * `copy-list-with-random-pointer` is covered now that the `linked-list-random`
 * adapter builds real nodes and the output check rejects a result that hands the
 * originals back. Its reference works on the same `[value, randomIndex]` pairs
 * the adapter reads, and answers in those terms — a correct deep copy has the
 * same shape as its input, which is exactly why the identity check had to exist
 * before this question could have hidden cases at all.
 *
 * `design-browser-history` and `lru-cache` are covered below. Their `arguments`
 * are the call sequence, so the Phase 6 pattern applies unchanged — the only
 * thing to match is the runner's bookkeeping, which differs for each.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

export const phase5 = {
  "reverse-linked-list": {
    solve: (head) => [...head].reverse(),
    generate: () => [
      [[1]],
      [[1, 1]],
      [[1, 2, 3]],
      [[-1, 0, 1]],
      [range(1_000)],
      [Array.from({ length: 2_000 }, () => 7)]
    ]
  },

  "merge-two-sorted-lists": {
    solve: (list1, list2) => {
      const out = [];
      let i = 0;
      let j = 0;
      while (i < list1.length && j < list2.length) {
        // `<=` keeps equal values in list1-before-list2 order, which is what a
        // node-splicing solution produces.
        out.push(list1[i] <= list2[j] ? list1[i++] : list2[j++]);
      }
      while (i < list1.length) out.push(list1[i++]);
      while (j < list2.length) out.push(list2[j++]);
      return out;
    },
    generate: () => [
      [[1], []],
      [[], [1]],
      [[1], [1]],
      [[1, 1, 1], [1, 1]],
      [[1, 2, 3], [4, 5, 6]],
      // Fully interleaved, and fully disjoint in the other direction.
      [[4, 5, 6], [1, 2, 3]],
      [[1, 3, 5], [2, 4, 6]],
      [range(1_000), range(1_000).map((value) => value + 1_000)]
    ]
  },

  "remove-nth-node-from-end-of-list": {
    solve: (head, n) => {
      const out = [...head];
      out.splice(head.length - n, 1);
      return out;
    },
    generate: () => [
      [[1, 2], 2],
      [[1, 2, 3], 1],
      [[1, 2, 3], 3],
      [[1, 2, 3, 4, 5], 5],
      // Removing the head and the tail of a long list.
      [range(1_000), 1],
      [range(1_000), 1_000],
      [range(1_000), 500]
    ]
  },

  "palindrome-linked-list": {
    solve: (head) => {
      for (let lo = 0, hi = head.length - 1; lo < hi; lo++, hi--) {
        if (head[lo] !== head[hi]) return false;
      }
      return true;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 1]],
      [[1, 2, 1]],
      [[1, 2, 3]],
      // Differs only at the very middle, and only at the very ends.
      [[1, 2, 3, 2, 1]],
      [[1, 2, 9, 2, 1]],
      [[2, 2, 3, 2, 1]],
      [Array.from({ length: 2_000 }, () => 4)]
    ]
  },

  "add-two-numbers": {
    // Digits are stored least-significant first, so this adds in list order.
    solve: (l1, l2) => {
      const out = [];
      let carry = 0;
      for (let i = 0; i < Math.max(l1.length, l2.length) || carry; i++) {
        const sum = (l1[i] ?? 0) + (l2[i] ?? 0) + carry;
        out.push(sum % 10);
        carry = Math.floor(sum / 10);
      }
      return out;
    },
    generate: () => [
      [[1], [9]],
      [[5], [5]],
      [[0], [1]],
      [[9, 9], [1]],
      [[1], [9, 9]],
      // A carry that propagates the whole way and adds a digit.
      [Array.from({ length: 500 }, () => 9), [1]],
      [Array.from({ length: 500 }, () => 9), Array.from({ length: 500 }, () => 9)],
      [randomInts(1_000, 0, 9, 113), randomInts(700, 0, 9, 127)]
    ]
  },

  "swap-nodes-in-pairs": {
    solve: (head) => {
      const out = [...head];
      for (let i = 0; i + 1 < out.length; i += 2) {
        [out[i], out[i + 1]] = [out[i + 1], out[i]];
      }
      return out;
    },
    generate: () => [
      [[1, 2]],
      [[1, 2, 3]],
      [[1, 2, 3, 4, 5]],
      [[1, 1, 2, 2]],
      // Odd length leaves the last node in place.
      [range(999)],
      [range(1_000)]
    ]
  },

  "odd-even-linked-list": {
    solve: (head) => [
      ...head.filter((_, index) => index % 2 === 0),
      ...head.filter((_, index) => index % 2 === 1)
    ],
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, 2, 3]],
      [[1, 2, 3, 4]],
      [range(999)],
      [range(1_000)]
    ]
  },

  "reverse-linked-list-ii": {
    // left and right are 1-indexed and inclusive.
    solve: (head, left, right) => {
      const out = [...head];
      const middle = out.slice(left - 1, right).reverse();
      out.splice(left - 1, right - left + 1, ...middle);
      return out;
    },
    generate: () => [
      [[1, 2], 1, 2],
      [[1, 2], 1, 1],
      [[1, 2], 2, 2],
      [[1, 2, 3, 4, 5], 1, 5],
      [[1, 2, 3, 4, 5], 3, 3],
      // A window that touches each end of a long list, and one in the middle.
      [range(1_000), 1, 500],
      [range(1_000), 500, 1_000],
      [range(1_000), 400, 600]
    ]
  },

  "rotate-list": {
    solve: (head, k) => {
      if (head.length === 0) return [];
      const shift = k % head.length;
      return [...head.slice(head.length - shift), ...head.slice(0, head.length - shift)];
    },
    generate: () => [
      [[], 3],
      [[1], 0],
      [[1], 99],
      [[1, 2], 1],
      // k equal to and a multiple of the length is a no-op.
      [[1, 2, 3], 3],
      [[1, 2, 3], 6],
      [range(1_000), 1],
      [range(1_000), 999],
      [range(1_000), 1_000_000]
    ]
  },

  "reorder-list": {
    // L0 -> Ln -> L1 -> Ln-1 -> ...
    solve: (head) => {
      const out = [];
      let lo = 0;
      let hi = head.length - 1;
      while (lo <= hi) {
        out.push(head[lo++]);
        if (lo <= hi) out.push(head[hi--]);
      }
      return out;
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 2]],
      [[1, 2, 3]],
      [[1, 1, 1, 1]],
      [range(999)],
      [range(1_000)]
    ]
  },

  "sort-list": {
    solve: (head) => [...head].sort((a, b) => a - b),
    generate: () => [
      [[1]],
      [[2, 1]],
      [[1, 1, 1]],
      [[3, 2, 1]],
      [[-5, -1, -3]],
      // Already sorted, reverse sorted, and heavily duplicated.
      [range(1_000)],
      [range(1_000).reverse()],
      [randomInts(2_000, -50, 50, 131)]
    ]
  },

  "merge-k-sorted-lists": {
    solve: (lists) => lists.flat().sort((a, b) => a - b),
    generate: () => [
      [[[1]]],
      [[[], []]],
      [[[], [1], []]],
      [[[1], [1], [1]]],
      [[[1, 2, 3]]],
      // Many short lists, and two long ones.
      [Array.from({ length: 50 }, (_, i) => [i, i + 50])],
      [[range(500), range(500).map((value) => value * 2)]],
      [[[-10, -5, 0], [-7, -3], [1, 2, 3]]]
    ]
  },

  "reverse-nodes-in-k-group": {
    // A trailing group shorter than k is left in its original order.
    solve: (head, k) => {
      const out = [];
      for (let i = 0; i < head.length; i += k) {
        const group = head.slice(i, i + k);
        out.push(...(group.length === k ? group.reverse() : group));
      }
      return out;
    },
    generate: () => [
      [[1], 1],
      [[1, 2], 1],
      [[1, 2], 2],
      [[1, 2, 3], 2],
      // k larger than the list leaves it untouched; k equal to it reverses all.
      [[1, 2, 3], 4],
      [[1, 2, 3], 3],
      [range(1_000), 3],
      [range(1_000), 1_000]
    ]
  },

  "linked-list-cycle": {
    // The adapter closes the cycle from `pos`, so the answer is simply whether
    // there is one — the candidate never sees `pos`.
    solve: (values, pos) => pos >= 0 && values.length > 0,
    generate: () => [
      [[1], 0],
      [[1, 2], -1],
      [[1, 2], 1],
      [[1, 2, 3], 2],
      [[1, 2, 3], 0],
      // A long list with the entry at each end, and no cycle at all.
      [range(1_000), -1],
      [range(1_000), 0],
      [range(1_000), 999]
    ]
  },

  "linked-list-cycle-ii": {
    // The adapter reports the returned node's index, which is `pos` by construction.
    solve: (values, pos) => (pos >= 0 && values.length > 0 ? pos : -1),
    generate: () => [
      [[1], 0],
      [[1, 2], -1],
      [[1, 2], 1],
      [[1, 2, 3], 1],
      [[7, 7, 7], 2],
      [range(1_000), -1],
      [range(1_000), 0],
      [range(1_000), 500]
    ]
  },

  "intersection-of-two-linked-lists": {
    /**
     * The adapter reports the shared node's value, but only for a node actually
     * in list A — so a solution matching on value alone does not pass.
     *
     * `skipA`/`skipB` at or past the end of their list means no intersection,
     * which is how the authored "No intersection" case is encoded.
     */
    solve: (valuesA, valuesB, skipA, skipB) =>
      skipA >= valuesA.length || skipB >= valuesB.length ? null : valuesA[skipA],
    generate: () => [
      [[1], [1], 0, 0],
      [[1], [2], 1, 1],
      [[1, 2], [3, 2], 1, 1],
      // The shared node is the whole of list B, and then the whole of list A.
      [[1, 2, 3], [3], 2, 0],
      [[3], [1, 2, 3], 0, 2],
      // Equal values that are not the shared node — a value match answers wrong.
      [[9, 9, 5], [9, 9, 9, 5], 2, 3],
      [range(1_000), range(500), 999, 499],
      [range(1_000), range(500), 1_000, 500]
    ]
  },

  "design-browser-history": {
    /**
     * The runner treats `arguments[0]` as the homepage followed by a run of
     * visits, reporting null for the constructor and for each visit, before the
     * remaining operations run. Four nulls for a homepage plus three visits.
     */
    solve: (pages, ...operations) => {
      const history = [pages[0]];
      let index = 0;
      const results = [null];
      for (const page of pages.slice(1)) {
        history.length = index + 1;
        history.push(page);
        index++;
        results.push(null);
      }
      for (const [name, steps] of operations) {
        index =
          name === "back"
            ? Math.max(0, index - steps)
            : Math.min(history.length - 1, index + steps);
        results.push(history[index]);
      }
      return results;
    },
    generate: () => [
      [["a.com"], ["back", 1]],
      [["a.com"], ["forward", 1]],
      [["a.com", "b.com"], ["back", 5]],
      [["a.com", "b.com", "c.com"], ["back", 2], ["forward", 10]],
      // Visiting after going back discards everything ahead of the cursor.
      [["a.com", "b.com", "c.com"], ["back", 1], ["forward", 1], ["back", 1]],
      [
        ["home", ...Array.from({ length: 50 }, (_, i) => `p${i}`)],
        ["back", 25],
        ["forward", 10],
        ["back", 100]
      ]
    ]
  },

  "lru-cache": {
    // `arguments[0]` is the constructor arguments; `put` reports null.
    solve: (constructorArguments, ...operations) => {
      const capacity = constructorArguments[0];
      const entries = new Map();
      return operations.map(([name, key, value]) => {
        if (name === "put") {
          if (entries.has(key)) entries.delete(key);
          entries.set(key, value);
          if (entries.size > capacity) entries.delete(entries.keys().next().value);
          return null;
        }
        if (!entries.has(key)) return -1;
        const held = entries.get(key);
        // A read counts as a use, so the key moves to the most-recent end.
        entries.delete(key);
        entries.set(key, held);
        return held;
      });
    },
    generate: () => [
      [[1], ["get", 1]],
      [[1], ["put", 1, 1], ["get", 1]],
      [[1], ["put", 1, 1], ["put", 1, 2], ["get", 1]],
      // Reading key 1 saves it from eviction when key 3 arrives.
      [[2], ["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["get", 1]],
      [[2], ["put", 1, 1], ["put", 2, 2], ["put", 3, 3], ["get", 1], ["get", 2], ["get", 3]],
      [[3], ["put", 1, 1], ["put", 2, 2], ["put", 3, 3], ["put", 1, 9], ["get", 1], ["get", 2]],
      [
        [10],
        ...Array.from({ length: 20 }, (_, i) => ["put", i, i * 2]),
        ["get", 0],
        ["get", 10],
        ["get", 19]
      ]
    ]
  },

  "copy-list-with-random-pointer": {
    /**
     * A correct copy serialises back to the input, so `solve` is the identity on
     * the pair list. That looks circular and is not: the adapter rejects a
     * result built from the original nodes before it ever reaches this
     * comparison, so passing means the candidate really did allocate new ones.
     */
    solve: (pairs) => pairs.map(([value, random]) => [value, random]),
    generate: () => [
      [[[1, null]]],
      [[[1, 0]]],
      [[[1, null], [2, null]]],
      // Every node pointing at the head, and at the tail.
      [[[1, 0], [2, 0], [3, 0]]],
      [[[1, 2], [2, 2], [3, 2]]],
      [[[-1, 1], [0, null], [7, 0]]],
      [Array.from({ length: 200 }, (_, i) => [i, (i * 7) % 200])],
      [Array.from({ length: 200 }, (_, i) => [i, null])]
    ]
  },

  "clone-graph": {
    /**
     * Same shape as the copy question: the adjacency list round-trips, and the
     * adapter's identity check is what makes the round trip mean something.
     *
     * Node labels are 1-based and `adjacency[i]` lists the neighbours of node
     * `i + 1`, so every input here is a valid undirected graph — each edge
     * appears in both endpoints' lists.
     */
    solve: (adjacency) => adjacency.map((neighbours) => [...neighbours]),
    generate: () => [
      [[[]]],
      [[[2], [1]]],
      [[[2, 3], [1], [1]]],
      // A triangle, a star, and a long path.
      [[[2, 3], [1, 3], [1, 2]]],
      [[[2, 3, 4], [1], [1], [1]]],
      [Array.from({ length: 50 }, (_, i) => [i, i + 2].filter((label) => label >= 1 && label <= 50))],
      [Array.from({ length: 20 }, (_, i) => Array.from({ length: 20 }, (_, j) => j + 1).filter((label) => label !== i + 1))]
    ]
  },

  "partition-list": {
    // Stability is the point: each part keeps its original relative order, so
    // filtering twice is exactly what a two-list solution produces.
    solve: (head, x) => [...head.filter((v) => v < x), ...head.filter((v) => v >= x)],
    generate: () => [
      [[1], 1],
      [[1], 2],
      [[1, 2], 0],
      [[1, 2], 5],
      // Every value equal to x lands on the second side.
      [[3, 3, 3], 3],
      [[5, 1, 5, 1, 5], 3],
      [[-3, 0, 3, -3, 0, 3], 0],
      [range(200).map((v) => (v % 2 === 0 ? v : -v)), 0]
    ]
  }
};
