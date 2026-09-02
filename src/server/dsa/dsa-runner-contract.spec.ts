import vm from "node:vm";
import { dsaPhases, findQuestion } from "@/lib/dsa/dsa";
import {
  dsaFunctionName,
  dsaStarterCode,
  OPERATION_DSA_SLUGS,
  supportedDsaCodeLanguages
} from "@/lib/dsa/dsa-code-templates";
import {
  buildTestCases,
  buildTestHarness,
  builtInts,
  builtSequence,
  parseTestResults,
  resultMarker,
  type CodeTestCase
} from "./code-test-harness";

describe("DSA runner contracts", () => {
  it("generates valid parameter and return shapes for representative starters", () => {
    expect(starter("two-sum", "javascript")).toContain("function twoSum(nums, target)");
    expect(starter("two-sum", "python")).toContain("def twoSum(nums, target):");
    expect(starter("two-sum", "java")).toContain("static int[] twoSum(int[] nums, int target)");
    expect(starter("two-sum", "cpp")).toContain(
      "vector<int> twoSum(vector<int>& nums, int target)"
    );

    expect(starter("3sum", "javascript")).toContain("function threeSum(nums)");
    expect(starter("merge-two-sorted-lists", "java")).toContain(
      "static ListNode mergeTwoSortedLists(ListNode list1, ListNode list2)"
    );
    expect(starter("path-sum", "cpp")).toContain("bool pathSum(TreeNode* root, int targetSum)");
    expect(starter("binary-tree-level-order-traversal", "java")).toContain(
      "static int[][] binaryTreeLevelOrderTraversal(TreeNode root)"
    );
    expect(starter("move-zeroes", "cpp")).toContain("void moveZeroes(vector<int>& nums)");
  });

  it.each([
    [
      "two-sum",
      `function twoSum(nums, target) {
        const seen = new Map();
        for (let index = 0; index < nums.length; index += 1) {
          const other = seen.get(target - nums[index]);
          if (other !== undefined) return [other, index];
          seen.set(nums[index], index);
        }
        return [];
      }`
    ],
    [
      "reverse-linked-list",
      `function reverseLinkedList(head) {
        let previous = null;
        while (head) {
          const next = head.next;
          head.next = previous;
          previous = head;
          head = next;
        }
        return previous;
      }`
    ],
    [
      "maximum-depth-of-binary-tree",
      `function maximumDepthOfBinaryTree(root) {
        if (!root) return 0;
        return 1 + Math.max(maximumDepthOfBinaryTree(root.left), maximumDepthOfBinaryTree(root.right));
      }`
    ],
    [
      "move-zeroes",
      `function moveZeroes(nums) {
        let write = 0;
        for (const value of nums) if (value !== 0) nums[write++] = value;
        while (write < nums.length) nums[write++] = 0;
      }`
    ],
    [
      "min-stack",
      `class MinStack {
        constructor() { this.values = []; this.minimums = []; }
        push(value) { this.values.push(value); this.minimums.push(Math.min(value, this.minimums.at(-1) ?? Infinity)); }
        pop() { this.minimums.pop(); this.values.pop(); }
        top() { return this.values.at(-1); }
        getMin() { return this.minimums.at(-1); }
      }`
    ]
  ])("executes representative %s authored tests", (slug, solution) => {
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);
    const harness = buildTestHarness(solution, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];

    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });

    const results = parseTestResults(output.join("\n"), testCases);
    expect(results).toHaveLength(testCases.length);
    expect(results.every((result) => result.passed)).toBe(true);
  });
});

/**
 * The expanded questions, run against a solution written *differently* from the
 * reference that produced their expected values.
 *
 * Agreement between a reference and its own output proves nothing. These
 * solutions take a different route to the same answer, so a case that only the
 * reference's phrasing satisfies fails here — which is the failure the hidden
 * cases exist to avoid inflicting on a candidate.
 */
describe("expanded DSA questions accept an independent solution", () => {
  it.each([
    [
      // Groups in hash order, words in input order — the shape every candidate
      // writes, and the one `unordered-nested` used to reject.
      "group-anagrams",
      `function groupAnagrams(strs) {
        const groups = new Map();
        for (const word of strs) {
          const key = [...word].sort().join("");
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(word);
        }
        return [...groups.values()];
      }`
    ],
    [
      // Set-based window rather than the reference's last-seen index map.
      "longest-substring-without-repeating-characters",
      `function longestSubstringWithoutRepeatingCharacters(s) {
        const window = new Set();
        let start = 0;
        let best = 0;
        for (let end = 0; end < s.length; end++) {
          while (window.has(s[end])) { window.delete(s[start]); start++; }
          window.add(s[end]);
          best = Math.max(best, window.size);
        }
        return best;
      }`
    ],
    [
      "minimum-window-substring",
      `function minimumWindowSubstring(s, t) {
        if (!t.length || s.length < t.length) return "";
        const need = new Map();
        for (const character of t) need.set(character, (need.get(character) ?? 0) + 1);
        let remaining = t.length;
        let start = 0;
        let bestStart = -1;
        let bestLength = Infinity;
        for (let end = 0; end < s.length; end++) {
          if (need.get(s[end]) > 0) remaining--;
          need.set(s[end], (need.get(s[end]) ?? 0) - 1);
          while (remaining === 0) {
            if (end - start + 1 < bestLength) { bestLength = end - start + 1; bestStart = start; }
            need.set(s[start], (need.get(s[start]) ?? 0) + 1);
            if (need.get(s[start]) > 0) remaining++;
            start++;
          }
        }
        return bestStart === -1 ? "" : s.slice(bestStart, bestStart + bestLength);
      }`
    ],
    [
      // Dynamic programming rather than the reference's expand-around-centre.
      "longest-palindromic-substring",
      `function longestPalindromicSubstring(s) {
        const n = s.length;
        if (n === 0) return "";
        const table = Array.from({ length: n }, () => new Array(n).fill(false));
        let start = 0;
        let best = 1;
        for (let i = 0; i < n; i++) table[i][i] = true;
        for (let length = 2; length <= n; length++) {
          for (let i = 0; i + length - 1 < n; i++) {
            const j = i + length - 1;
            if (s[i] !== s[j]) continue;
            if (length === 2 || table[i + 1][j - 1]) {
              table[i][j] = true;
              if (length > best) { best = length; start = i; }
            }
          }
        }
        return s.slice(start, start + best);
      }`
    ],
    [
      "decode-string",
      `function decodeString(s) {
        let index = 0;
        function parse() {
          let out = "";
          while (index < s.length && s[index] !== "]") {
            if (s[index] >= "0" && s[index] <= "9") {
              let count = 0;
              while (s[index] >= "0" && s[index] <= "9") count = count * 10 + Number(s[index++]);
              index++;
              const inner = parse();
              index++;
              out += inner.repeat(count);
            } else {
              out += s[index++];
            }
          }
          return out;
        }
        return parse();
      }`
    ],
    [
      "text-justification",
      `function textJustification(words, maxWidth) {
        const out = [];
        let index = 0;
        while (index < words.length) {
          let end = index;
          let width = 0;
          while (end < words.length && width + words[end].length + (end - index) <= maxWidth) {
            width += words[end].length;
            end++;
          }
          const count = end - index;
          let line = "";
          if (end === words.length || count === 1) {
            line = words.slice(index, end).join(" ");
            line += " ".repeat(maxWidth - line.length);
          } else {
            const spaces = maxWidth - width;
            const base = Math.floor(spaces / (count - 1));
            const extra = spaces % (count - 1);
            for (let i = index; i < end; i++) {
              line += words[i];
              if (i < end - 1) line += " ".repeat(base + (i - index < extra ? 1 : 0));
            }
          }
          out.push(line);
          index = end;
        }
        return out;
      }`
    ],
    [
      // Truncates with splice; the reference assigns to length.
      "string-compression",
      `function stringCompression(chars) {
        let write = 0;
        for (let read = 0; read < chars.length; ) {
          const character = chars[read];
          let run = 0;
          while (read < chars.length && chars[read] === character) { read++; run++; }
          chars[write++] = character;
          if (run > 1) for (const digit of String(run)) chars[write++] = digit;
        }
        chars.splice(write);
      }`
    ],
    [
      "maximum-average-subarray-i",
      `function maximumAverageSubarrayI(nums, k) {
        let sum = 0;
        for (let i = 0; i < k; i++) sum += nums[i];
        let best = sum;
        for (let i = k; i < nums.length; i++) {
          sum = sum - nums[i - k] + nums[i];
          if (sum > best) best = sum;
        }
        return best / k;
      }`
    ],
    [
      // Returns the FIRST peak; the reference's binary search lands on a
      // different one for several of these inputs. Both are correct, and this
      // is what the `accepted` hook exists to allow.
      "find-peak-element",
      `function findPeakElement(nums) {
        for (let i = 0; i < nums.length; i++) {
          const left = i === 0 ? -Infinity : nums[i - 1];
          const right = i === nums.length - 1 ? -Infinity : nums[i + 1];
          if (nums[i] > left && nums[i] > right) return i;
        }
        return -1;
      }`
    ],
    [
      // Brute force per window instead of the reference's monotonic deque.
      "sliding-window-maximum",
      `function slidingWindowMaximum(nums, k) {
        const out = [];
        for (let i = 0; i + k <= nums.length; i++) {
          let best = nums[i];
          for (let j = i + 1; j < i + k; j++) if (nums[j] > best) best = nums[j];
          out.push(best);
        }
        return out;
      }`
    ],
    [
      // The partition binary search; the reference merges and sorts.
      "median-of-two-sorted-arrays",
      `function medianOfTwoSortedArrays(nums1, nums2) {
        if (nums1.length > nums2.length) return medianOfTwoSortedArrays(nums2, nums1);
        const m = nums1.length;
        const n = nums2.length;
        let lo = 0;
        let hi = m;
        while (lo <= hi) {
          const i = Math.floor((lo + hi) / 2);
          const j = Math.floor((m + n + 1) / 2) - i;
          const left1 = i === 0 ? -Infinity : nums1[i - 1];
          const right1 = i === m ? Infinity : nums1[i];
          const left2 = j === 0 ? -Infinity : nums2[j - 1];
          const right2 = j === n ? Infinity : nums2[j];
          if (left1 <= right2 && left2 <= right1) {
            if ((m + n) % 2 === 1) return Math.max(left1, left2);
            return (Math.max(left1, left2) + Math.min(right1, right2)) / 2;
          }
          if (left1 > right2) hi = i - 1;
          else lo = i + 1;
        }
        return 0;
      }`
    ],
    [
      // Finds the pivot first, then searches one half; the reference decides
      // which half is sorted inside a single loop.
      "search-in-rotated-sorted-array",
      `function searchInRotatedSortedArray(nums, target) {
        const n = nums.length;
        if (n === 0) return -1;
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (nums[mid] > nums[hi]) lo = mid + 1;
          else hi = mid;
        }
        const pivot = lo;
        const search = (left, right) => {
          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (nums[mid] === target) return mid;
            if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
          }
          return -1;
        };
        const found = search(0, pivot - 1);
        return found !== -1 ? found : search(pivot, n - 1);
      }`
    ],
    [
      // Two lower-bound calls rather than the reference's two tracked scans.
      "find-first-and-last-position-of-element-in-sorted-array",
      `function findFirstAndLastPositionOfElementInSortedArray(nums, target) {
        const lower = (value) => {
          let lo = 0;
          let hi = nums.length;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (nums[mid] < value) lo = mid + 1;
            else hi = mid;
          }
          return lo;
        };
        const first = lower(target);
        if (first === nums.length || nums[first] !== target) return [-1, -1];
        return [first, lower(target + 1) - 1];
      }`
    ],
    [
      // Sorts by distance instead of sliding a window of width k.
      "find-k-closest-elements",
      `function findKClosestElements(arr, k, x) {
        return arr
          .slice()
          .sort((a, b) => Math.abs(a - x) - Math.abs(b - x) || a - b)
          .slice(0, k)
          .sort((a, b) => a - b);
      }`
    ],
    [
      // Real node work: the adapter hands over a chain, so this walks pointers
      // where the reference sliced an array.
      "reverse-nodes-in-k-group",
      `function reverseNodesInKGroup(head, k) {
        let count = 0;
        let probe = head;
        while (probe && count < k) { probe = probe.next; count++; }
        if (count < k) return head;
        let previous = reverseNodesInKGroup(probe, k);
        let node = head;
        for (let i = 0; i < k; i++) {
          const next = node.next;
          node.next = previous;
          previous = node;
          node = next;
        }
        return previous;
      }`
    ],
    [
      "reorder-list",
      `function reorderList(head) {
        if (!head || !head.next) return;
        let slow = head;
        let fast = head;
        while (fast.next && fast.next.next) { slow = slow.next; fast = fast.next.next; }
        let second = slow.next;
        slow.next = null;
        let previous = null;
        while (second) { const next = second.next; second.next = previous; previous = second; second = next; }
        let first = head;
        while (previous) {
          const firstNext = first.next;
          const previousNext = previous.next;
          first.next = previous;
          previous.next = firstNext;
          first = firstNext;
          previous = previousNext;
        }
      }`
    ],
    [
      "merge-two-sorted-lists",
      `function mergeTwoSortedLists(list1, list2) {
        const dummy = { val: 0, next: null };
        let tail = dummy;
        while (list1 && list2) {
          if (list1.val <= list2.val) { tail.next = list1; list1 = list1.next; }
          else { tail.next = list2; list2 = list2.next; }
          tail = tail.next;
        }
        tail.next = list1 || list2;
        return dummy.next;
      }`
    ],
    [
      "rotate-list",
      `function rotateList(head, k) {
        if (!head || !head.next) return head;
        let length = 1;
        let tail = head;
        while (tail.next) { tail = tail.next; length++; }
        const shift = k % length;
        if (shift === 0) return head;
        tail.next = head;
        let newTail = head;
        for (let i = 0; i < length - shift - 1; i++) newTail = newTail.next;
        const newHead = newTail.next;
        newTail.next = null;
        return newHead;
      }`
    ],
    [
      // No adapter on this one, so the argument really is an array.
      "add-two-numbers",
      `function addTwoNumbers(l1, l2) {
        const out = [];
        let carry = 0;
        let i = 0;
        while (i < l1.length || i < l2.length || carry > 0) {
          const sum = (i < l1.length ? l1[i] : 0) + (i < l2.length ? l2[i] : 0) + carry;
          out.push(sum - Math.floor(sum / 10) * 10);
          carry = Math.floor(sum / 10);
          i++;
        }
        return out;
      }`
    ],
    [
      // Its inputs contain "]" and "(", which is what broke the case writer:
      // the writer counted brackets without skipping string literals and
      // truncated the file mid-array. These cases existing at all is the guard.
      "valid-parentheses",
      `function validParentheses(s) {
        const open = { ")": "(", "]": "[", "}": "{" };
        const stack = [];
        for (const character of s) {
          if (character === "(" || character === "[" || character === "{") stack.push(character);
          else if (stack.pop() !== open[character]) return false;
        }
        return stack.length === 0;
      }`
    ],
    [
      // Divide and conquer on the minimum bar, rather than a monotonic stack.
      "largest-rectangle-in-histogram",
      `function largestRectangleInHistogram(heights) {
        function best(lo, hi) {
          if (lo > hi) return 0;
          let minimum = lo;
          for (let i = lo; i <= hi; i++) if (heights[i] < heights[minimum]) minimum = i;
          const across = heights[minimum] * (hi - lo + 1);
          return Math.max(across, best(lo, minimum - 1), best(minimum + 1, hi));
        }
        return best(0, heights.length - 1);
      }`
    ],
    [
      // Recursive descent instead of the reference's sign stack.
      "basic-calculator",
      `function basicCalculator(s) {
        let index = 0;
        function expression() {
          let total = 0;
          let sign = 1;
          while (index < s.length && s[index] !== ")") {
            const character = s[index];
            if (character === " ") { index++; continue; }
            if (character === "+") { sign = 1; index++; continue; }
            if (character === "-") { sign = -1; index++; continue; }
            if (character === "(") { index++; total += sign * expression(); index++; continue; }
            let number = 0;
            while (index < s.length && s[index] >= "0" && s[index] <= "9") number = number * 10 + Number(s[index++]);
            total += sign * number;
          }
          return total;
        }
        return expression();
      }`
    ],
    [
      "asteroid-collision",
      `function asteroidCollision(asteroids) {
        const stack = [];
        for (const asteroid of asteroids) {
          let current = asteroid;
          while (current !== 0 && current < 0 && stack.length > 0 && stack[stack.length - 1] > 0) {
            const top = stack[stack.length - 1];
            if (top + current < 0) stack.pop();
            else if (top + current === 0) { stack.pop(); current = 0; }
            else current = 0;
          }
          if (current !== 0) stack.push(current);
        }
        return stack;
      }`
    ],
    [
      // Iterative BFS rather than the reference's recursion.
      "maximum-depth-of-binary-tree",
      `function maximumDepthOfBinaryTree(root) {
        if (!root) return 0;
        let level = [root];
        let depth = 0;
        while (level.length) {
          depth++;
          level = level.flatMap((node) => [node.left, node.right].filter(Boolean));
        }
        return depth;
      }`
    ],
    [
      // Bounds passed down, versus checking the in-order sequence is ascending.
      "validate-binary-search-tree",
      `function validateBinarySearchTree(root) {
        const order = [];
        (function walk(node) {
          if (!node) return;
          walk(node.left);
          order.push(node.val);
          walk(node.right);
        })(root);
        for (let i = 1; i < order.length; i++) if (order[i - 1] >= order[i]) return false;
        return true;
      }`
    ],
    [
      // The Morris-style right-spine flatten, not a preorder collect.
      "flatten-binary-tree-to-linked-list",
      `function flattenBinaryTreeToLinkedList(root) {
        let node = root;
        while (node) {
          if (node.left) {
            let rightmost = node.left;
            while (rightmost.right) rightmost = rightmost.right;
            rightmost.right = node.right;
            node.right = node.left;
            node.left = null;
          }
          node = node.right;
        }
      }`
    ],
    [
      // Builds the tree, which the tree-result adapter serializes. Without that
      // adapter the starter returned int[] and Java could not express the nulls.
      "convert-sorted-array-to-binary-search-tree",
      `function convertSortedArrayToBinarySearchTree(nums) {
        function build(lo, hi) {
          if (lo > hi) return null;
          // Takes the upper middle; the reference takes the lower one.
          const mid = Math.ceil((lo + hi) / 2);
          const node = new TreeNode(nums[mid]);
          node.left = build(lo, mid - 1);
          node.right = build(mid + 1, hi);
          return node;
        }
        return build(0, nums.length - 1);
      }`
    ],
    [
      "construct-binary-tree-from-preorder-and-inorder-traversal",
      `function constructBinaryTreeFromPreorderAndInorderTraversal(preorder, inorder) {
        function build(pre, ino) {
          if (!pre.length) return null;
          const node = new TreeNode(pre[0]);
          const cut = ino.indexOf(pre[0]);
          node.left = build(pre.slice(1, cut + 1), ino.slice(0, cut));
          node.right = build(pre.slice(cut + 1), ino.slice(cut + 1));
          return node;
        }
        return build(preorder, inorder);
      }`
    ],
    [
      "lowest-common-ancestor-of-a-binary-tree",
      `function lowestCommonAncestorOfABinaryTree(root, p, q) {
        const path = (node, target, trail) => {
          if (!node) return null;
          trail.push(node);
          if (node === target) return trail;
          if (path(node.left, target, trail) || path(node.right, target, trail)) return trail;
          trail.pop();
          return null;
        };
        const first = path(root, p, []) || [];
        const second = new Set(path(root, q, []) || []);
        for (let i = first.length - 1; i >= 0; i--) if (second.has(first[i])) return first[i];
        return null;
      }`
    ],
    [
      "vertical-order-traversal-of-a-binary-tree",
      `function verticalOrderTraversalOfABinaryTree(root) {
        const byColumn = new Map();
        const queue = root ? [[root, 0, 0]] : [];
        while (queue.length) {
          const [node, row, column] = queue.shift();
          if (!byColumn.has(column)) byColumn.set(column, []);
          byColumn.get(column).push([row, node.val]);
          if (node.left) queue.push([node.left, row + 1, column - 1]);
          if (node.right) queue.push([node.right, row + 1, column + 1]);
        }
        return [...byColumn.keys()]
          .sort((a, b) => a - b)
          .map((column) =>
            byColumn.get(column).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((entry) => entry[1])
          );
      }`
    ],
    [
      // Quickselect rather than a full sort.
      "kth-largest-element-in-an-array",
      `function kthLargestElementInAnArray(nums, k) {
        const values = nums.slice();
        let target = values.length - k;
        let lo = 0;
        let hi = values.length - 1;
        while (lo < hi) {
          const pivot = values[hi];
          let split = lo;
          for (let i = lo; i < hi; i++) {
            if (values[i] < pivot) {
              const swap = values[i];
              values[i] = values[split];
              values[split] = swap;
              split++;
            }
          }
          values[hi] = values[split];
          values[split] = pivot;
          if (split === target) return values[split];
          if (split < target) lo = split + 1;
          else hi = split - 1;
        }
        return values[lo];
      }`
    ],
    [
      // Bucket by frequency instead of sorting the counts.
      "top-k-frequent-elements",
      `function topKFrequentElements(nums, k) {
        const counts = new Map();
        for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);
        const buckets = [];
        for (const [value, count] of counts) (buckets[count] ??= []).push(value);
        const out = [];
        for (let count = buckets.length - 1; count >= 0 && out.length < k; count--) {
          for (const value of buckets[count] ?? []) if (out.length < k) out.push(value);
        }
        return out;
      }`
    ],
    [
      // A real max-heap, versus the reference's repeated sort.
      "last-stone-weight",
      `function lastStoneWeight(stones) {
        const heap = [];
        const up = (index) => {
          while (index > 0) {
            const parent = (index - 1) >> 1;
            if (heap[parent] >= heap[index]) break;
            const swap = heap[parent]; heap[parent] = heap[index]; heap[index] = swap;
            index = parent;
          }
        };
        const down = () => {
          let index = 0;
          for (;;) {
            let largest = index;
            for (const child of [index * 2 + 1, index * 2 + 2]) {
              if (child < heap.length && heap[child] > heap[largest]) largest = child;
            }
            if (largest === index) return;
            const swap = heap[largest]; heap[largest] = heap[index]; heap[index] = swap;
            index = largest;
          }
        };
        const push = (value) => { heap.push(value); up(heap.length - 1); };
        const pop = () => {
          const top = heap[0];
          const last = heap.pop();
          if (heap.length) { heap[0] = last; down(); }
          return top;
        };
        for (const stone of stones) push(stone);
        while (heap.length > 1) {
          const first = pop();
          const second = pop();
          if (first !== second) push(first - second);
        }
        return heap.length ? heap[0] : 0;
      }`
    ],
    [
      // Greedy placement, not the counting formula the reference uses.
      "task-scheduler",
      `function taskScheduler(tasks, n) {
        const counts = new Map();
        for (const task of tasks) counts.set(task, (counts.get(task) ?? 0) + 1);
        let remaining = [...counts.values()];
        let time = 0;
        while (remaining.length) {
          remaining.sort((a, b) => b - a);
          const taken = remaining.slice(0, n + 1);
          for (let i = 0; i < taken.length; i++) remaining[i] = taken[i] - 1;
          remaining = remaining.filter((count) => count > 0);
          time += remaining.length ? n + 1 : taken.length;
        }
        return time;
      }`
    ],
    [
      "find-median-from-data-stream",
      `class MedianFinder {
        constructor() { this.values = []; }
        addNum(value) {
          let lo = 0;
          let hi = this.values.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.values[mid] < value) lo = mid + 1;
            else hi = mid;
          }
          this.values.splice(lo, 0, value);
        }
        findMedian() {
          const middle = this.values.length >> 1;
          return this.values.length % 2 === 1
            ? this.values[middle]
            : (this.values[middle - 1] + this.values[middle]) / 2;
        }
      }`
    ],
    [
      // Union-find over the grid, not the reference's flood fill.
      "number-of-islands",
      `function numberOfIslands(grid) {
        const rows = grid.length;
        const cols = rows ? grid[0].length : 0;
        const parent = new Map();
        const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) if (grid[r][c] === "1") parent.set(r * cols + c, r * cols + c);
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c] !== "1") continue;
            for (const [dr, dc] of [[1, 0], [0, 1]]) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= rows || nc >= cols || grid[nr][nc] !== "1") continue;
              const a = find(r * cols + c);
              const b = find(nr * cols + nc);
              if (a !== b) parent.set(a, b);
            }
          }
        }
        let roots = 0;
        for (const key of parent.keys()) if (find(key) === key) roots++;
        return roots;
      }`
    ],
    [
      // Depth-first with an explicit cycle check, versus Kahn's algorithm.
      "course-schedule",
      `function courseSchedule(numCourses, prerequisites) {
        const adjacency = Array.from({ length: numCourses }, () => []);
        for (const [course, prerequisite] of prerequisites) adjacency[prerequisite].push(course);
        const state = new Array(numCourses).fill(0);
        const walk = (node) => {
          if (state[node] === 1) return false;
          if (state[node] === 2) return true;
          state[node] = 1;
          for (const next of adjacency[node]) if (!walk(next)) return false;
          state[node] = 2;
          return true;
        };
        for (let i = 0; i < numCourses; i++) if (!walk(i)) return false;
        return true;
      }`
    ],
    [
      // Depth-first post-order reversed — a different order than Kahn's, which
      // is exactly why this question needs its accepted set.
      "course-schedule-ii",
      `function courseScheduleIi(numCourses, prerequisites) {
        const adjacency = Array.from({ length: numCourses }, () => []);
        for (const [course, prerequisite] of prerequisites) adjacency[prerequisite].push(course);
        const state = new Array(numCourses).fill(0);
        const order = [];
        const walk = (node) => {
          if (state[node] === 1) return false;
          if (state[node] === 2) return true;
          state[node] = 1;
          for (const next of adjacency[node]) if (!walk(next)) return false;
          state[node] = 2;
          order.push(node);
          return true;
        };
        for (let i = numCourses - 1; i >= 0; i--) if (!walk(i)) return [];
        return order.reverse();
      }`
    ],
    [
      // Dijkstra rather than the reference's Bellman-Ford.
      "network-delay-time",
      `function networkDelayTime(times, n, k) {
        const graph = new Map();
        for (const [from, to, weight] of times) {
          if (!graph.has(from)) graph.set(from, []);
          graph.get(from).push([to, weight]);
        }
        const best = new Map([[k, 0]]);
        const queue = [[0, k]];
        while (queue.length) {
          queue.sort((a, b) => a[0] - b[0]);
          const [cost, node] = queue.shift();
          if (cost > (best.get(node) ?? Infinity)) continue;
          for (const [next, weight] of graph.get(node) ?? []) {
            if (cost + weight < (best.get(next) ?? Infinity)) {
              best.set(next, cost + weight);
              queue.push([cost + weight, next]);
            }
          }
        }
        if (best.size !== n) return -1;
        return Math.max(...best.values());
      }`
    ],
    [
      "evaluate-division",
      `function evaluateDivision(equations, values, queries) {
        // Floyd-Warshall over the ratio graph, versus the reference's search.
        const ratio = new Map();
        const set = (a, b, value) => {
          if (!ratio.has(a)) ratio.set(a, new Map());
          ratio.get(a).set(b, value);
        };
        for (let i = 0; i < equations.length; i++) {
          const [a, b] = equations[i];
          set(a, a, 1);
          set(b, b, 1);
          set(a, b, values[i]);
          set(b, a, 1 / values[i]);
        }
        for (const mid of ratio.keys()) {
          for (const from of ratio.keys()) {
            for (const to of ratio.keys()) {
              const left = ratio.get(from).get(mid);
              const right = ratio.get(mid).get(to);
              if (left !== undefined && right !== undefined) set(from, to, left * right);
            }
          }
        }
        return queries.map(([a, b]) => ratio.get(a)?.get(b) ?? -1);
      }`
    ],
    [
      // Memoised recursion, not the reference's bottom-up table.
      "coin-change",
      `function coinChange(coins, amount) {
        const memo = new Map();
        const best = (remaining) => {
          if (remaining === 0) return 0;
          if (remaining < 0) return Infinity;
          if (memo.has(remaining)) return memo.get(remaining);
          let answer = Infinity;
          for (const coin of coins) answer = Math.min(answer, best(remaining - coin) + 1);
          memo.set(remaining, answer);
          return answer;
        };
        const answer = best(amount);
        return answer === Infinity ? -1 : answer;
      }`
    ],
    [
      // Full two-dimensional table where the reference rolls a single row.
      "edit-distance",
      `function editDistance(word1, word2) {
        const rows = word1.length;
        const cols = word2.length;
        const table = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
        for (let i = 0; i <= rows; i++) table[i][0] = i;
        for (let j = 0; j <= cols; j++) table[0][j] = j;
        for (let i = 1; i <= rows; i++) {
          for (let j = 1; j <= cols; j++) {
            table[i][j] =
              word1[i - 1] === word2[j - 1]
                ? table[i - 1][j - 1]
                : 1 + Math.min(table[i - 1][j - 1], table[i - 1][j], table[i][j - 1]);
          }
        }
        return table[rows][cols];
      }`
    ],
    [
      /**
       * Coordinate compression plus a Fenwick tree of prefix maxima, where the
       * reference uses patience-sorting tails. Genuinely different, and still
       * O(n log n) — this used to be the textbook quadratic table, which now
       * runs out of time against the scale case, exactly as intended.
       */
      "longest-increasing-subsequence",
      `function longestIncreasingSubsequence(nums) {
        if (nums.length === 0) return 0;
        const ranks = new Map();
        [...new Set(nums)].sort((a, b) => a - b).forEach((value, index) => ranks.set(value, index + 1));
        const size = ranks.size;
        const tree = new Array(size + 1).fill(0);
        const query = (index) => {
          let best = 0;
          for (let i = index; i > 0; i -= i & -i) best = Math.max(best, tree[i]);
          return best;
        };
        const update = (index, value) => {
          for (let i = index; i <= size; i += i & -i) tree[i] = Math.max(tree[i], value);
        };
        let answer = 0;
        for (const value of nums) {
          const rank = ranks.get(value);
          const best = query(rank - 1) + 1;
          update(rank, best);
          answer = Math.max(answer, best);
        }
        return answer;
      }`
    ],
    [
      // Recursive with memo, where the reference fills intervals bottom-up.
      "burst-balloons",
      `function burstBalloons(nums) {
        const padded = [1, ...nums, 1];
        const memo = new Map();
        const best = (left, right) => {
          if (left + 1 >= right) return 0;
          const key = left * 1000 + right;
          if (memo.has(key)) return memo.get(key);
          let answer = 0;
          for (let last = left + 1; last < right; last++) {
            answer = Math.max(
              answer,
              best(left, last) + padded[left] * padded[last] * padded[right] + best(last, right)
            );
          }
          memo.set(key, answer);
          return answer;
        };
        return best(0, padded.length - 1);
      }`
    ],
    [
      // Top-down recursion over the pattern instead of a table.
      "regular-expression-matching",
      `function regularExpressionMatching(s, p) {
        const memo = new Map();
        const match = (i, j) => {
          const key = i * 1000 + j;
          if (memo.has(key)) return memo.get(key);
          let answer;
          if (j === p.length) answer = i === s.length;
          else {
            const first = i < s.length && (p[j] === s[i] || p[j] === ".");
            if (j + 1 < p.length && p[j + 1] === "*") {
              answer = match(i, j + 2) || (first && match(i + 1, j));
            } else {
              answer = first && match(i + 1, j + 1);
            }
          }
          memo.set(key, answer);
          return answer;
        };
        return match(0, 0);
      }`
    ],
    [
      // Bitmask enumeration, not the reference's include/exclude recursion.
      "subsets",
      `function subsets(nums) {
        const out = [];
        for (let mask = 0; mask < (1 << nums.length); mask++) {
          const subset = [];
          for (let i = 0; i < nums.length; i++) if (mask & (1 << i)) subset.push(nums[i]);
          out.push(subset);
        }
        return out;
      }`
    ],
    [
      // Swap-in-place permutation generation rather than a used[] array.
      "permutations",
      `function permutations(nums) {
        const out = [];
        const values = nums.slice();
        const walk = (start) => {
          if (start === values.length) { out.push(values.slice()); return; }
          for (let i = start; i < values.length; i++) {
            [values[start], values[i]] = [values[i], values[start]];
            walk(start + 1);
            [values[start], values[i]] = [values[i], values[start]];
          }
        };
        walk(0);
        return out;
      }`
    ],
    [
      "n-queens",
      `function nQueens(n) {
        const out = [];
        const placement = [];
        const safe = (row, column) =>
          placement.every(
            (taken, r) =>
              taken !== column && Math.abs(taken - column) !== row - r
          );
        const walk = (row) => {
          if (row === n) {
            out.push(placement.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
            return;
          }
          for (let column = 0; column < n; column++) {
            if (!safe(row, column)) continue;
            placement.push(column);
            walk(row + 1);
            placement.pop();
          }
        };
        walk(0);
        return out;
      }`
    ],
    [
      // A real trie node object rather than the reference's nested Maps.
      "implement-trie-prefix-tree",
      `class Trie {
        constructor() { this.children = {}; this.terminal = false; }
        node(word) {
          let current = this;
          for (const character of word) {
            if (!current.children[character]) return null;
            current = current.children[character];
          }
          return current;
        }
        insert(word) {
          let current = this;
          for (const character of word) {
            if (!current.children[character]) current.children[character] = new Trie();
            current = current.children[character];
          }
          current.terminal = true;
        }
        search(word) { const found = this.node(word); return found !== null && found.terminal; }
        startsWith(prefix) { return this.node(prefix) !== null; }
      }`
    ],
    [
      "design-add-and-search-words-data-structure",
      `class WordDictionary {
        constructor() { this.children = {}; this.terminal = false; }
        addWord(word) {
          let current = this;
          for (const character of word) {
            if (!current.children[character]) current.children[character] = new WordDictionary();
            current = current.children[character];
          }
          current.terminal = true;
        }
        search(word) {
          const walk = (node, index) => {
            if (index === word.length) return node.terminal;
            const character = word[index];
            if (character === ".") {
              for (const key of Object.keys(node.children)) {
                if (walk(node.children[key], index + 1)) return true;
              }
              return false;
            }
            const next = node.children[character];
            return next ? walk(next, index + 1) : false;
          };
          return walk(this, 0);
        }
      }`
    ],
    [
      // Replaced flatten-a-multilevel-doubly-linked-list, which had no adapter
      // and tested parsing LeetCode's serialization format rather than an
      // algorithm. Two dummy heads, which is what the question is actually for.
      "partition-list",
      `function partitionList(head, x) {
        const lower = { val: 0, next: null };
        const upper = { val: 0, next: null };
        let lowerTail = lower;
        let upperTail = upper;
        let node = head;
        while (node) {
          if (node.val < x) { lowerTail.next = node; lowerTail = node; }
          else { upperTail.next = node; upperTail = node; }
          node = node.next;
        }
        // Terminating the second list is what stops the result being circular.
        upperTail.next = null;
        lowerTail.next = upper.next;
        return lower.next;
      }`
    ],
    [
      // Replaced serialize-and-deserialize-binary-tree, whose string round trip
      // the single-function runner cannot express. Depth-first with recorded
      // level bounds, where the reference walks breadth-first.
      "maximum-width-of-binary-tree",
      `function maximumWidthOfBinaryTree(root) {
        const first = new Map();
        let best = 0;
        const walk = (node, depth, index) => {
          if (!node) return;
          if (!first.has(depth)) first.set(depth, index);
          best = Math.max(best, index - first.get(depth) + 1);
          walk(node.left, depth + 1, (index - first.get(depth)) * 2);
          walk(node.right, depth + 1, (index - first.get(depth)) * 2 + 1);
        };
        walk(root, 0, 0);
        return best;
      }`
    ],
    [
      "repeated-dna-sequences",
      `function repeatedDnaSequences(s) {
        const counts = new Map();
        for (let i = 0; i + 10 <= s.length; i++) {
          const window = s.slice(i, i + 10);
          counts.set(window, (counts.get(window) ?? 0) + 1);
        }
        const out = [];
        for (const [window, count] of counts) if (count > 1) out.push(window);
        return out;
      }`
    ]
  ])("passes every visible and hidden case for %s", (slug, solution) => {
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);
    // The point of the expansion: there is more here than the problem shows.
    expect(testCases.filter((testCase) => !testCase.visible).length).toBeGreaterThan(0);

    const harness = buildTestHarness(solution, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];
    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });

    const results = parseTestResults(output.join("\n"), testCases);
    const failed = results.filter((result) => !result.passed);
    expect(failed.map((result, index) => `${index}: ${result.actualOutput}`)).toEqual([]);
    expect(results).toHaveLength(testCases.length);
  });
});

/**
 * The class-operation questions, driven through the operation runner with a
 * real implementation of the structure rather than the array shortcut the
 * references use — two stacks behind the queue, one queue behind the stack, a
 * ring buffer behind the circular queue.
 *
 * What this checks is the runner's own bookkeeping, which differs per question:
 * `min-stack` reports null for `pop` even though a real `pop` returns a value,
 * while the queue reports what it removed.
 */
describe("class-operation questions run a real structure", () => {
  it.each([
    [
      "min-stack",
      `class MinStack {
        constructor() { this.values = []; this.minimums = []; }
        push(value) {
          this.values.push(value);
          this.minimums.push(Math.min(value, this.minimums.length ? this.minimums[this.minimums.length - 1] : Infinity));
        }
        pop() { this.minimums.pop(); return this.values.pop(); }
        top() { return this.values[this.values.length - 1]; }
        getMin() { return this.minimums[this.minimums.length - 1]; }
      }`
    ],
    [
      "implement-queue-using-stacks",
      `class MyQueue {
        constructor() { this.inbox = []; this.outbox = []; }
        push(x) { this.inbox.push(x); }
        carry() { if (!this.outbox.length) while (this.inbox.length) this.outbox.push(this.inbox.pop()); }
        pop() { this.carry(); return this.outbox.pop(); }
        peek() { this.carry(); return this.outbox[this.outbox.length - 1]; }
        empty() { return this.inbox.length === 0 && this.outbox.length === 0; }
      }`
    ],
    [
      "implement-stack-using-queues",
      `class MyStack {
        constructor() { this.queue = []; }
        push(x) {
          this.queue.push(x);
          for (let i = 0; i < this.queue.length - 1; i++) this.queue.push(this.queue.shift());
        }
        pop() { return this.queue.shift(); }
        top() { return this.queue[0]; }
        empty() { return this.queue.length === 0; }
      }`
    ],
    [
      "design-circular-queue",
      `class MyCircularQueue {
        constructor(k) { this.buffer = new Array(k); this.capacity = k; this.head = 0; this.count = 0; }
        enQueue(value) {
          if (this.count === this.capacity) return false;
          this.buffer[(this.head + this.count) % this.capacity] = value;
          this.count++;
          return true;
        }
        deQueue() {
          if (this.count === 0) return false;
          this.head = (this.head + 1) % this.capacity;
          this.count--;
          return true;
        }
        Front() { return this.count === 0 ? -1 : this.buffer[this.head]; }
        Rear() { return this.count === 0 ? -1 : this.buffer[(this.head + this.count - 1) % this.capacity]; }
        isEmpty() { return this.count === 0; }
        isFull() { return this.count === this.capacity; }
      }`
    ],
    [
      // The example output for this question was missing a null: a correct
      // implementation returns one per void call, constructor and visit alike,
      // and the bank expected three values where four are produced.
      "design-browser-history",
      `class BrowserHistory {
        constructor(homepage) { this.pages = [homepage]; this.index = 0; }
        visit(url) {
          this.pages.length = this.index + 1;
          this.pages.push(url);
          this.index++;
        }
        back(steps) { this.index = Math.max(0, this.index - steps); return this.pages[this.index]; }
        forward(steps) {
          this.index = Math.min(this.pages.length - 1, this.index + steps);
          return this.pages[this.index];
        }
      }`
    ],
    [
      // A Map preserves insertion order, so re-inserting on read is enough to
      // track recency — the reference does the same, but a real solution would
      // usually reach for a doubly-linked list.
      "lru-cache",
      `class LRUCache {
        constructor(capacity) { this.capacity = capacity; this.entries = new Map(); }
        get(key) {
          if (!this.entries.has(key)) return -1;
          const value = this.entries.get(key);
          this.entries.delete(key);
          this.entries.set(key, value);
          return value;
        }
        put(key, value) {
          if (this.entries.has(key)) this.entries.delete(key);
          this.entries.set(key, value);
          if (this.entries.size > this.capacity) {
            this.entries.delete(this.entries.keys().next().value);
          }
        }
      }`
    ],
    [
      // Linear scan back through the timestamps rather than the reference's
      // binary search.
      "time-based-key-value-store",
      `class TimeMap {
        constructor() { this.store = new Map(); }
        set(key, value, timestamp) {
          if (!this.store.has(key)) this.store.set(key, []);
          this.store.get(key).push([timestamp, value]);
        }
        get(key, timestamp) {
          const entries = this.store.get(key) || [];
          for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i][0] <= timestamp) return entries[i][1];
          }
          return "";
        }
      }`
    ],
    [
      "online-stock-span",
      `class StockSpanner {
        constructor() { this.stack = []; }
        next(price) {
          let span = 1;
          while (this.stack.length && this.stack[this.stack.length - 1][0] <= price) span += this.stack.pop()[1];
          this.stack.push([price, span]);
          return span;
        }
      }`
    ]
  ])("%s passes every visible and hidden case", (slug, implementation) => {
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);
    expect(testCases.some((testCase) => !testCase.visible)).toBe(true);

    const harness = buildTestHarness(implementation, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];
    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });
    const results = parseTestResults(output.join("\n"), testCases);
    expect(results.filter((result) => !result.passed).map((result) => result.index)).toEqual([]);
  });
});

/**
 * These three used to hand the candidate the answer as an argument — the list
 * was a plain array and `pos` / `skipA` came with it, so `return pos !== -1`
 * passed every case. The `linked-list-cycle`, `linked-list-cycle-entry` and
 * `linked-list-intersection` adapters now build the structure and pass only the
 * heads, so the old cheats cannot even see the value they used to echo.
 *
 * Both directions are asserted: a real traversal passes every case, and each
 * former cheat now fails at least one. Testing only the first would let the
 * adapters regress into passing anything.
 */
describe("cycle and intersection questions require real traversal", () => {
  const solutions: Array<[string, string, string]> = [
    [
      "linked-list-cycle",
      `function linkedListCycle(head) {
        const seen = new Set();
        let node = head;
        while (node) { if (seen.has(node)) return true; seen.add(node); node = node.next; }
        return false;
      }`,
      "function linkedListCycle(head, pos) { return pos !== -1; }"
    ],
    [
      "linked-list-cycle-ii",
      `function linkedListCycleIi(head) {
        const seen = new Set();
        let node = head;
        while (node) { if (seen.has(node)) return node; seen.add(node); node = node.next; }
        return null;
      }`,
      "function linkedListCycleIi(head, pos) { return pos; }"
    ],
    [
      "intersection-of-two-linked-lists",
      `function intersectionOfTwoLinkedLists(headA, headB) {
        const seen = new Set();
        for (let node = headA; node; node = node.next) seen.add(node);
        for (let node = headB; node; node = node.next) if (seen.has(node)) return node;
        return null;
      }`,
      // Matching on value rather than identity: the shared node is found by
      // what it holds, not by being the same node.
      `function intersectionOfTwoLinkedLists(headA, headB) {
        const values = new Set();
        for (let node = headA; node; node = node.next) values.add(node.val);
        for (let node = headB; node; node = node.next) if (values.has(node.val)) return node;
        return null;
      }`
    ]
  ];

  it.each(solutions)("%s passes a real traversal over every case", (slug, solution) => {
    const testCases = casesFor(slug);
    expect(testCases.some((testCase) => !testCase.visible)).toBe(true);
    expect(failuresFor(slug, solution, testCases)).toEqual([]);
  });

  it.each(solutions)("%s rejects the shortcut that used to pass", (slug, _solution, cheat) => {
    const testCases = casesFor(slug);
    expect(failuresFor(slug, cheat, testCases).length).toBeGreaterThan(0);
  });

  function casesFor(slug: string) {
    return buildTestCases(requiredQuestion(slug).examples ?? [], slug);
  }

  function failuresFor(slug: string, solution: string, testCases: CodeTestCase[]) {
    const harness = buildTestHarness(solution, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];
    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });
    return parseTestResults(output.join("\n"), testCases)
      .map((result, index) => (result.passed ? null : index))
      .filter((index) => index !== null);
  }
});

/**
 * Deep-copy questions, graded on whether the copy is actually a copy.
 *
 * Both used to be handed their own input as an array and hand it straight back:
 * `return head` and `return adjList` passed every case. The `linked-list-random`
 * and `graph-clone` adapters build real nodes, and the output check walks the
 * result rejecting any node that came from the input — so the answer having the
 * same shape as the question is no longer enough.
 *
 * Both directions are asserted, and the real solutions here take a different
 * route from the references: the O(1)-space interleaving trick rather than a
 * hash map, and breadth-first rather than depth-first.
 */
describe("deep-copy questions require an actual copy", () => {
  const solutions: Array<[string, string, string]> = [
    [
      "copy-list-with-random-pointer",
      `function copyListWithRandomPointer(head) {
        if (!head) return null;
        // Weave copies into the original list, wire the random pointers off
        // that adjacency, then unweave.
        let node = head;
        while (node) {
          const copy = { val: node.val, next: node.next, random: null };
          node.next = copy;
          node = copy.next;
        }
        node = head;
        while (node) {
          node.next.random = node.random ? node.random.next : null;
          node = node.next.next;
        }
        const copyHead = head.next;
        node = head;
        while (node) {
          const copy = node.next;
          node.next = copy.next;
          copy.next = copy.next ? copy.next.next : null;
          node = node.next;
        }
        return copyHead;
      }`,
      "function copyListWithRandomPointer(head) { return head; }"
    ],
    [
      "clone-graph",
      `function cloneGraph(node) {
        if (!node) return null;
        const copies = new Map([[node, { val: node.val, neighbors: [] }]]);
        const queue = [node];
        while (queue.length) {
          const current = queue.shift();
          for (const neighbor of current.neighbors) {
            if (!copies.has(neighbor)) {
              copies.set(neighbor, { val: neighbor.val, neighbors: [] });
              queue.push(neighbor);
            }
            copies.get(current).neighbors.push(copies.get(neighbor));
          }
        }
        return copies.get(node);
      }`,
      "function cloneGraph(node) { return node; }"
    ]
  ];

  it.each(solutions)("%s passes a real copy over every case", (slug, solution) => {
    const testCases = buildTestCases(requiredQuestion(slug).examples ?? [], slug);
    expect(testCases.some((testCase) => !testCase.visible)).toBe(true);
    expect(failuresFor(slug, solution, testCases)).toEqual([]);
  });

  it.each(solutions)("%s rejects returning the original nodes", (slug, _solution, cheat) => {
    const testCases = buildTestCases(requiredQuestion(slug).examples ?? [], slug);
    // The empty case has no nodes to alias, so it legitimately still passes.
    expect(failuresFor(slug, cheat, testCases).length).toBeGreaterThan(0);
  });

  function failuresFor(slug: string, solution: string, testCases: CodeTestCase[]) {
    const harness = buildTestHarness(solution, "javascript", dsaFunctionName(slug), testCases);
    const output: string[] = [];
    vm.runInNewContext(harness, {
      console: { log: (line: unknown) => output.push(String(line)) },
      Map,
      Math,
      Set
    });
    return parseTestResults(output.join("\n"), testCases)
      .map((result, index) => (result.passed ? null : index))
      .filter((index) => index !== null);
  }
});

describe("class-operation questions build a harness in every language", () => {
  it.each([...OPERATION_DSA_SLUGS])("%s generates all four languages", (slug) => {
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);
    expect(supportedDsaCodeLanguages(slug)).toEqual(["javascript", "python", "cpp", "java"]);

    // jest's expect takes no message argument, so the language is carried in the
    // collected result rather than a per-iteration label.
    const built = (["javascript", "python", "java", "cpp"] as const).map((language) => {
      const harness = buildTestHarness(
        dsaStarterCode(question, language),
        language,
        dsaFunctionName(slug),
        testCases
      );
      return `${language}:${harness.includes(resultMarker()) && harness.length > 0}`;
    });
    expect(built).toEqual(["javascript:true", "python:true", "java:true", "cpp:true"]);
  });

  it("declares the constructor the harness actually calls", () => {
    // The old shell had a no-argument constructor for every class, so
    // `new BrowserHistory("home")` did not compile.
    const browser = requiredQuestion("design-browser-history");
    expect(dsaStarterCode(browser, "java")).toContain("BrowserHistory(String homepage)");
    expect(dsaStarterCode(browser, "cpp")).toContain("BrowserHistory(string homepage)");

    const cache = requiredQuestion("lru-cache");
    expect(dsaStarterCode(cache, "java")).toContain("LRUCache(int capacity)");
    expect(dsaStarterCode(cache, "cpp")).toContain("LRUCache(int capacity)");
  });
});

/**
 * Large inputs the generated program builds for itself.
 *
 * Every case used to be inlined, and Java compiles a literal into roughly one
 * bytecode instruction per element against a 64KB method cap — so inputs were
 * capped near 2,000, and at 2,000 a quadratic solution finishes in
 * milliseconds. Wrong complexity passed everywhere: an O(n^2) `two-sum` was
 * told it was correct.
 *
 * A built input carries no literal, so a case can be large enough that the
 * five-second limit means something. Measured on the committed cases: a correct
 * solution finishes in about 20ms, while the quadratic versions take 10s
 * (`contains-duplicate`) and 28s (`best-time-to-buy-and-sell-stock`).
 */
describe("scale cases make wrong complexity run out of time", () => {
  const SCALED = [
    "contains-duplicate",
    "two-sum",
    "best-time-to-buy-and-sell-stock",
    "maximum-subarray",
    "container-with-most-water",
    "trapping-rain-water",
    "minimum-size-subarray-sum",
    "max-consecutive-ones-iii",
    "fruit-into-baskets",
    "kth-largest-element-in-an-array",
    "longest-increasing-subsequence"
  ];

  it.each(SCALED)("%s has a case too large for a quadratic solution", (slug) => {
    const testCases = buildTestCases(requiredQuestion(slug).examples ?? [], slug);
    const scaled = testCases.filter((testCase) => testCase.build);
    expect(scaled.length).toBeGreaterThan(0);

    for (const testCase of scaled) {
      const sizes = (testCase.build ?? []).map((spec) =>
        spec === null || spec === undefined ? 0 : "ints" in spec ? spec.ints.n : spec.sequence.n
      );
      // 100k squared is 10^10 operations — far past a five-second budget.
      expect(Math.max(...sizes)).toBeGreaterThanOrEqual(100_000);
      // A scale case is always hidden; its input must never reach the candidate.
      expect(testCase.visible).toBe(false);
      // And its answer is written into the bank, so it has to stay small.
      expect(JSON.stringify(testCase.expectedValue).length).toBeLessThan(200);
    }
  });

  it("emits a builder call rather than a literal, in every language", () => {
    const slug = "contains-duplicate";
    const question = requiredQuestion(slug);
    const testCases = buildTestCases(question.examples ?? [], slug);

    for (const language of ["javascript", "python", "java", "cpp"] as const) {
      const harness = buildTestHarness(
        dsaStarterCode(question, language),
        language,
        dsaFunctionName(slug),
        testCases
      );
      const builder = language === "python" ? "trailgrad_built_sequence" : "trailgradBuiltSequence";
      expect(harness.includes(`${builder}(200000`)).toBe(true);
      // The whole point: 200,000 elements, and the source stays small.
      expect(harness.length).toBeLessThan(80_000);
    }
  });

  it("generates the same values the reference scored against", () => {
    // The four runtimes share one generator, chosen so its intermediate product
    // stays under 2^53 and a JavaScript double holds it exactly. Verified
    // against real Java, C++ and Python runs; this pins the TypeScript side.
    const values = builtInts(200_000, -1_000, 1_000, 7);
    expect(values).toHaveLength(200_000);
    expect(values.slice(0, 5)).toEqual([729, 758, -188, 636, -69]);
    expect(values.reduce((total, value) => total + value, 0)).toBe(-406_894);
    expect(builtSequence(5, 10, -2)).toEqual([10, 8, 6, 4, 2]);
  });
});

describe("no expected value overflows a 32-bit int", () => {
  it("holds for every numeric case in the bank", () => {
    const INT32_MAX = 2_147_483_647;
    const INT32_MIN = -2_147_483_648;
    const offenders: string[] = [];

    for (const phase of dsaPhases()) {
      for (const question of phase.questions) {
        if (!supportedDsaCodeLanguages(question.slug).includes("java")) continue;
        for (const testCase of buildTestCases(question.examples ?? [], question.slug)) {
          const numbers = collectNumbers(testCase.expectedValue);
          for (const value of numbers) {
            if (!Number.isInteger(value)) continue;
            if (value > INT32_MAX || value < INT32_MIN) {
              offenders.push(`${question.slug}: ${value}`);
            }
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  function collectNumbers(value: unknown): number[] {
    if (typeof value === "number") return [value];
    if (Array.isArray(value)) return value.flatMap(collectNumbers);
    return [];
  }
});

describe("questions graded on a shrinking argument do not advertise Java", () => {
  // A `static void f(int[] nums)` cannot hand back a shorter array, so these
  // would fail every length-changing case no matter what the candidate wrote.
  it.each(["string-compression", "remove-duplicates-from-sorted-array"])(
    "%s offers only the resizable-container languages",
    (slug) => {
      expect(supportedDsaCodeLanguages(slug)).toEqual(["javascript", "python", "cpp"]);
    }
  );

  it("leaves same-length mutation questions on all four languages", () => {
    expect(supportedDsaCodeLanguages("move-zeroes")).toContain("java");
    expect(supportedDsaCodeLanguages("sort-colors")).toContain("java");
  });
});

function starter(slug: string, language: "javascript" | "python" | "java" | "cpp"): string {
  return dsaStarterCode(requiredQuestion(slug), language);
}

function requiredQuestion(slug: string) {
  const question = findQuestion(slug)?.question;
  if (!question) throw new Error(`Missing DSA fixture: ${slug}`);
  return question;
}
