export type DsaQuestionSlot = "dsa-lookup" | "dsa-binary-search" | "dsa-tree-bfs" | "dsa-adaptive";
export type DsaBankQuestion = { title: string; prompt: string; options: Array<{ id: string; label: string }>; correctOptionId: string };
export type DsaQuestionKind = "leetcode" | "reasoning";
export type DsaQuestionDifficulty = "foundation" | "intermediate";

const q = (title: string, prompt: string, correct: string, ...wrong: string[]): DsaBankQuestion => {
  const choices = [{ id: "correct", label: correct }, ...wrong.map((label, index) => ({ id: `wrong-${index + 1}`, label }))];
  let hash = 0;
  for (const character of prompt) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const offset = hash % choices.length;
  return { title, prompt, options: [...choices.slice(offset), ...choices.slice(0, offset)], correctOptionId: "correct" };
};

/** Fifty compact interview decisions: familiar problems plus original reasoning scenarios. */
export const DSA_QUESTION_BANK: Record<DsaQuestionSlot, DsaBankQuestion[]> = {
  "dsa-lookup": [
    q("Two Sum", "Given an unsorted integer array and a target, return two indices whose values add to the target in one pass. What should you keep while scanning?", "A HashMap from value to its index", "A sorted linked list", "A queue of prior values", "A recursion stack"),
    q("Duplicate Events", "In the shown event loop, why must the code check seen.has(event.id) before it calls seen.add(event.id)?", "It detects a duplicate against earlier events before recording the current one", "It sorts events by ID", "It guarantees events arrive in order", "It frees old event IDs automatically"),
    q("Valid Anagram", "Two lowercase strings may be anagrams. You need to compare character frequencies rather than their order. What is the best representation?", "A frequency map or fixed character-count array", "A stack for each word", "Binary search on the original strings", "A queue of characters"),
    q("Equivalent Configurations", "The shown code groups configuration strings with a signature. Why use a sorted-character signature instead of the original configuration string as the map key?", "Configurations with the same characters in different orders get the same key", "It makes the original string shorter", "It preserves the original arrival order", "It removes all duplicate configurations"),
    q("First Repeated Value", "Scan an integer array and return the first value that appears for a second time. What supports a fast membership test at each step?", "A HashSet", "A min-heap", "A queue", "A binary-search tree built without keys"),
    q("Missing Sequence", "The code begins a run only when value - 1 is not in the set. Why does that avoid unnecessary work?", "Each consecutive run is expanded once, from its true starting value", "It sorts the batch numbers first", "It removes missing values from the set", "It checks only the largest batch number"),
    q("Isomorphic Strings", "Two strings are isomorphic only if each source character consistently maps to one target character. What state do you need?", "Mappings that track both source-to-target and target-to-source", "A single running counter", "A stack of source characters", "A binary-search boundary"),
    q("Subarray Sum Equals K", "Count subarrays whose sum equals k, even when numbers can be negative. As you scan prefix sums, what should a map store?", "How often each prefix sum has appeared", "Only the largest prefix sum", "The last two values", "A queue of target values"),
    q("Ransom Note", "Can a ransom note be built from letters in a magazine? What is the natural O(n) bookkeeping approach?", "Count available characters, then decrement for the note", "Sort with a heap only", "Traverse with BFS", "Use two pointers without counts"),
    q("Happy Number", "Repeatedly replace a number with the sum of squares of its digits. How do you detect that the process is looping?", "Keep previously seen values in a HashSet", "Use binary search", "Use a queue ordered by digits", "Always recurse without memory"),
    q("Word Pattern", "A pattern like abba must map one-to-one to words in a sentence. Which state validates that constraint?", "Two directional HashMap mappings", "A stack of word lengths", "A min-heap of words", "A sliding-window pointer only"),
    q("Top K Frequent", "Before finding the k most frequent elements, what information should you first build from the input?", "A frequency HashMap", "A linked list sorted by arrival", "A queue of duplicates", "A binary tree level order"),
    q("Find the Difference", "One string is a shuffled version of another with one extra character. Which approach cleanly tracks what is missing?", "A character-frequency map or count array", "A graph traversal", "A monotonic binary search", "A recursion stack")
  ],
  "dsa-binary-search": [
    q("Search Insert Position", "In the binary-search loop shown, nums[mid] is smaller than target. Which update keeps the possible insert position in the remaining search range?", "Set low to mid + 1", "Set high to mid - 1", "Keep both boundaries unchanged", "Return mid immediately"),
    q("First Failing Rollout", "A feature flag percentage is safe up to one point and fails for every larger percentage. You need the first unsafe percentage while running as few checks as possible. What method fits?", "Binary search on the safe/unsafe boundary", "Depth-first search", "A frequency map", "A stack"),
    q("Integer Square Root", "The loop is searching for floor(sqrt(x)). Which condition means mid is still a valid candidate and the search can continue to the right?", "mid * mid is less than or equal to x", "mid is greater than x", "mid is an even number", "high is greater than low"),
    q("Minimum Worker Capacity", "Find the minimum worker capacity that completes queued jobs before a deadline. If a capacity works, every larger capacity works. What is the key pattern?", "Binary search on a monotonic feasible capacity", "BFS through jobs", "Two pointers over workers", "A HashSet of capacities"),
    q("Ship Packages", "The code sets the lower capacity bound to the heaviest package. Why is that necessary before binary-searching a feasible capacity?", "No ship can carry that package if capacity is any smaller", "It guarantees delivery in one day", "It sorts the package weights", "It makes every capacity feasible"),
    q("Shifted Schedule", "A sorted schedule of unique times was circularly shifted after a daylight-savings change. You still need to locate a requested time in O(log n). What technique should you adapt?", "Binary search while identifying the sorted half", "BFS", "Dynamic programming", "Linked-list reversal"),
    q("Rotated Minimum", "A sorted distinct array was rotated. You need its minimum in O(log n). What signal can guide the search?", "Compare the middle value with the right boundary", "Count every value in a map", "Traverse level by level", "Use a fixed-size window"),
    q("Peak Element", "An array has no equal adjacent values. Find any peak in O(log n). Which observation supports the intended method?", "The local slope tells which half can contain a peak", "All values need a frequency map", "The array must be traversed with BFS", "Only a queue can preserve peaks"),
    q("First and Last Position", "In a sorted array with duplicates, return the first and last index of a target. What is needed?", "Two boundary binary searches", "One BFS and one DFS", "A sliding window only", "A stack and queue"),
    q("Monotonic Predicate", "A yes/no predicate is false through some value and true from then on. What does that shape tell you?", "Search for the transition with binary search", "Use a HashSet for all answers", "Use postorder traversal", "Use a linked list"),
    q("Minimum Days", "You need the minimum day on which m bouquets of k adjacent flowers can be made. If a day works, later days work. What pattern applies?", "Binary search on the answer with a feasibility check", "A graph traversal of flowers", "A HashMap of days only", "A recursion stack"),
    q("Time Map", "For a key, values are stored with increasing timestamps. To get the value at or before a timestamp, what should you use within that key’s history?", "Binary search over its sorted timestamps", "BFS over all keys", "A sliding window", "A queue of every request"),
    q("Split Array", "Split an array into m pieces while minimizing the largest piece sum. If a maximum allowed sum is feasible, larger ones are feasible. What should you use?", "Binary search over the allowed maximum with a greedy check", "DFS over every split only", "A HashSet of sums", "Tree level order")
  ],
  "dsa-tree-bfs": [
    q("Level Order", "Given a binary tree, return its values one level at a time from left to right. Which traversal fits naturally?", "Breadth-first search with a queue", "Depth-first search with one running total", "Binary search by node value", "Two pointers from the root"),
    q("Nearest Escalation", "Teams form a reporting tree. You need the closest on-call responder to the root by number of handoffs. Which approach finds the shortest route?", "Breadth-first search", "A depth-first traversal that stops at any responder", "Binary search over team IDs", "A sliding window over handoffs"),
    q("Right Side View", "For a binary tree, you need the node visible from the right at every depth. What information should a level-order traversal keep?", "The final node visited at each level", "The numerically largest value in the tree", "Only the root and leaves", "The first node in every subtree"),
    q("Team-Level Summary", "A reporting tree stores each team’s weekly workload. You need one average workload for each depth. Which traversal makes those groups direct?", "Breadth-first search by level", "Binary search over workload values", "A sliding window over the root path", "A HashSet of team names"),
    q("Nearest Exit", "From one open cell in a grid, find the fewest moves to any exit. Every move costs one. Which approach gives the correct first answer?", "Breadth-first search with visited cells", "Depth-first search that returns at the first exit", "Binary search on the grid coordinates", "A stack without visited tracking"),
    q("Spreading Alert", "Several servers receive an alert at the same time. It spreads to adjacent servers once per minute. What models the elapsed time correctly?", "Multi-source breadth-first search", "A binary search over server IDs", "One server notifying every other server directly", "A stack that reverses alerts"),
    q("Course Schedule", "Courses have prerequisite edges and you need an order that respects them. Which graph pattern is relevant?", "Topological BFS using in-degrees", "Binary search on course IDs", "Sliding window over prerequisites", "A HashSet with no edges"),
    q("Binary Matrix Path", "Move through eight directions in a grid and return the fewest cells from start to end. What is the right first technique?", "BFS because every move has equal cost", "DFS because it always finds shortest paths", "Binary search", "A monotonic stack"),
    q("Connect Next Pointers", "Populate each tree node’s next pointer to its neighbor on the same depth. Which traversal makes the neighbor relation direct?", "BFS by level", "Binary search", "Two pointers over values", "Dynamic programming"),
    q("Word Ladder", "Transform one word to another by changing one letter at a time, using only valid dictionary words. What finds the fewest transformations?", "BFS over valid one-letter transformations", "A sliding window", "Binary search over words", "A stack without visited tracking"),
    q("Distance K", "Given a binary tree, a target node, and k, return all nodes exactly k edges away. Once parent links are known, how should you expand?", "BFS outward from the target by distance", "Binary search by value", "A fixed-size substring window", "Only inorder traversal"),
    q("Walls and Gates", "For each empty room in a grid, fill its distance to the nearest gate. What avoids repeatedly searching from every room?", "Multi-source BFS starting from all gates", "DFS from each room", "Binary search on coordinates", "A stack of walls")
  ],
  "dsa-adaptive": [
    q("No Repeating Characters", "Find the longest substring with no repeated characters. As the right pointer advances, what should you maintain?", "A sliding window with character positions or counts", "Binary search on the string", "BFS over characters", "A heap of letters"),
    q("Best Monitoring Window", "A service stores one error count per minute. You need the highest average error rate across exactly k consecutive minutes without recalculating every interval. What helps?", "A fixed-size sliding window", "Depth-first search", "Binary search", "Union Find"),
    q("Character Replacement", "You may replace at most k characters. Find the longest substring that can be made all one character. What pattern fits?", "A sliding window tracking character frequencies", "BFS", "Binary search", "A linked list"),
    q("Required Event Mix", "A fixed-length request window is valid only when it contains exactly the same event-type counts as a required template. What comparison should move across the stream?", "A fixed-size sliding window of event-type counts", "A binary search over the stream", "A BFS through event types", "A stack of windows"),
    q("Minimum Size Sum", "All numbers are positive. Find the shortest contiguous subarray whose sum is at least target. When the sum is large enough, what can you do?", "Shrink a variable-size sliding window from the left", "Binary search individual values", "Traverse with BFS", "Use a HashSet only"),
    q("SLO Breach Window", "A request stream marks each minute healthy or unhealthy. You can tolerate at most k unhealthy minutes and want the longest acceptable continuous period. What should the window track?", "How many unhealthy minutes are inside the sliding window", "The stream’s median", "A tree depth", "A HashMap of all prefixes only"),
    q("Minimum Window", "Find the smallest substring of s containing every character of t with required counts. What pattern is standard?", "A sliding window with a frequency requirement map", "Binary search on character code", "BFS through all substrings", "A stack of target characters"),
    q("Product Less Than K", "All numbers are positive. Count contiguous subarrays whose product is less than k. What lets you update efficiently?", "A sliding window that expands and shrinks by product", "Binary search every product", "DFS all subarrays", "A heap of products"),
    q("Fruit Into Baskets", "Return the longest contiguous subarray containing at most two distinct values. What is the useful state?", "A sliding window plus a frequency map", "A binary-search boundary", "A BFS queue of arrays", "A recursion stack"),
    q("Max Consecutive Answers", "You may change at most k answers in a T/F answer key. Find the longest uniform run possible. What is the right approach?", "A sliding window tracking counts of T and F", "A tree traversal", "Binary search on indices only", "A HashSet of positions"),
    q("Take Characters", "Remove characters only from the left or right so that you take at least k of each of a, b, and c. What reframing helps?", "Find the longest middle sliding window you can keep", "BFS through all removals", "Binary search the alphabet", "A stack for each character"),
    q("Grumpy Bookstore", "A bookstore owner can suppress grumpiness for exactly k consecutive minutes. What calculates the best extra satisfied customers?", "A fixed-size sliding window over recoverable customers", "Binary search customer IDs", "DFS over minutes", "A HashSet of receipts")
  ]
};

export function dsaBankQuestion(slot: DsaQuestionSlot, index: number): DsaBankQuestion | null {
  return DSA_QUESTION_BANK[slot][index] ?? null;
}

/** Metadata is used by the selector so every short baseline is intentionally mixed. */
export function dsaQuestionMeta(slot: DsaQuestionSlot, index: number): { kind: DsaQuestionKind; difficulty: DsaQuestionDifficulty } {
  const kind: DsaQuestionKind = index === 1 || index === 3 || index === 5 ? "reasoning" : "leetcode";
  const difficulty: DsaQuestionDifficulty = slot === "dsa-adaptive" || index >= 6 ? "intermediate" : "foundation";
  return { kind, difficulty };
}

export function dsaQuestionIndexes(slot: DsaQuestionSlot, kind: DsaQuestionKind, difficulty: DsaQuestionDifficulty): number[] {
  return DSA_QUESTION_BANK[slot].flatMap((_, index) => {
    const meta = dsaQuestionMeta(slot, index);
    return meta.kind === kind && meta.difficulty === difficulty ? [index] : [];
  });
}
