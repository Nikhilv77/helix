/**
 * Reference solutions and input generators for Phase 2 — Strings.
 *
 * Same contract as Phase 1: a reference is replayed against the question's own
 * hand-authored cases first, and only a reference that reproduces every one of
 * them is trusted to produce expected values for the hidden cases.
 *
 * Strings raise one hazard arrays did not — **answer ambiguity**. "Longest
 * palindromic substring" and "minimum window substring" can have several
 * equally-correct answers for the same input, and a generated case that pins
 * one of them fails a correct solution that returned another. Both questions
 * below therefore filter their generated inputs down to the ones whose answer
 * is unique, checked by brute force at generation time rather than by eye.
 *
 * Sizing rule from Phase 1 still applies: inputs stay at or under 2,000
 * elements, because Java inlines a literal as roughly one bytecode instruction
 * per element against a 64KB method cap.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomString = (n, alphabet, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
};

const isPalindrome = (value) => {
  for (let lo = 0, hi = value.length - 1; lo < hi; lo++, hi--) {
    if (value[lo] !== value[hi]) return false;
  }
  return true;
};

/**
 * Every longest palindromic substring of `s`, deduplicated by content.
 *
 * Used to reject an input before it becomes a test case: if two *different*
 * strings tie for longest, pinning either one would fail a correct solution
 * that found the other. Repeats of the same string are not ambiguity — the
 * value compared is identical — so this collects a Set, not a count.
 */
function allLongestPalindromes(s) {
  let best = 0;
  let found = new Set();
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j <= s.length; j++) {
      const candidate = s.slice(i, j);
      if (candidate.length < best || !isPalindrome(candidate)) continue;
      if (candidate.length > best) {
        best = candidate.length;
        found = new Set();
      }
      found.add(candidate);
    }
  }
  return found;
}

/** Every minimum window of `s` covering `t`, deduplicated by content. */
function allMinimumWindows(s, t) {
  const need = new Map();
  for (const character of t) need.set(character, (need.get(character) ?? 0) + 1);
  let best = Infinity;
  let found = new Set();
  for (let i = 0; i < s.length; i++) {
    const have = new Map();
    for (let j = i; j < s.length; j++) {
      have.set(s[j], (have.get(s[j]) ?? 0) + 1);
      let covers = true;
      for (const [character, count] of need) {
        if ((have.get(character) ?? 0) < count) {
          covers = false;
          break;
        }
      }
      if (!covers) continue;
      const window = s.slice(i, j + 1);
      if (window.length < best) {
        best = window.length;
        found = new Set();
      }
      if (window.length === best) found.add(window);
      break;
    }
  }
  return found;
}

/**
 * Keeps only the inputs whose answer is unique, so a tie can never be pinned.
 *
 * Zero answers is also unambiguous — there is no window, or no palindrome, and
 * every correct solution returns the empty string. Only a *tie* between two
 * different strings is rejected.
 */
const unambiguous = (inputs, answers) => inputs.filter((args) => answers(...args).size <= 1);

export const phase2 = {
  "valid-anagram": {
    solve: (s, t) => {
      if (s.length !== t.length) return false;
      const counts = new Map();
      for (const character of s) counts.set(character, (counts.get(character) ?? 0) + 1);
      for (const character of t) {
        const remaining = counts.get(character);
        if (!remaining) return false;
        counts.set(character, remaining - 1);
      }
      return true;
    },
    generate: () => [
      ["", ""],
      ["a", ""],
      ["a", "a"],
      ["a", "b"],
      ["ab", "ba"],
      // Same letters, different multiplicities — the length check passes and a
      // set-based solution wrongly says true.
      ["aacc", "ccac"],
      ["aabbcc", "abcabc"],
      [randomString(2_000, "abcdefghij", 13), randomString(2_000, "abcdefghij", 13)],
      [randomString(1_500, "ab", 17), [...randomString(1_500, "ab", 17)].reverse().join("")]
    ]
  },

  "group-anagrams": {
    // Groups come back in an arbitrary order and so do the words inside them;
    // both levels have to be canonicalised before comparing.
    comparison: "unordered-deep",
    solve: (strs) => {
      const groups = new Map();
      for (const word of strs) {
        const key = [...word].sort().join("");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(word);
      }
      return [...groups.values()].map((group) => [...group].sort());
    },
    generate: () => [
      [[]],
      [["a", "a"]],
      [["ab", "ba", "abc"]],
      [["", "", ""]],
      [["abc", "bca", "cab", "xyz", "zyx", "q"]],
      // Anagram groups of different letters that share a sorted prefix.
      [["aab", "aba", "baa", "aabb", "abab", "bbaa"]],
      [Array.from({ length: 500 }, (_, i) => (i % 2 === 0 ? "listen" : "silent"))]
    ]
  },

  "valid-palindrome": {
    solve: (s) => {
      const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, "");
      return isPalindrome(cleaned);
    },
    generate: () => [
      [""],
      ["a"],
      [".,"],
      ["0P"],
      ["ab"],
      ["aa"],
      ["Was it a car or a cat I saw?"],
      ["12321"],
      ["12345"],
      // Digits are alphanumeric; a letters-only filter drops them and flips this.
      ["a1b2b1a"],
      [`${"ab".repeat(1_000)}${"ba".repeat(1_000)}`]
    ]
  },

  "longest-common-prefix": {
    solve: (strs) => {
      if (strs.length === 0) return "";
      let prefix = strs[0];
      for (const word of strs.slice(1)) {
        while (!word.startsWith(prefix)) {
          prefix = prefix.slice(0, -1);
          if (prefix === "") return "";
        }
      }
      return prefix;
    },
    generate: () => [
      [[""]],
      [["a"]],
      [["", "a"]],
      [["a", "a"]],
      [["ab", "abc"]],
      // The shortest string is the whole answer — a scan that indexes past it
      // reads undefined.
      [["abc", "ab"]],
      [["c", "acc", "ccc"]],
      [[..."x".repeat(50).split(""), "y"]],
      // All identical: the prefix is the whole string and the scan never shortens
      // it. Kept small — 500 x 200 chars made a 110KB Java source per run.
      [Array.from({ length: 100 }, () => "a".repeat(100))]
    ]
  },

  "reverse-words-in-a-string": {
    solve: (s) => s.trim().split(/\s+/).reverse().join(" "),
    generate: () => [
      ["a"],
      ["  a  "],
      ["a b"],
      ["   "],
      ["one"],
      ["  many   spaces   between  "],
      ["word ".repeat(400).trim()]
    ]
  },

  "string-compression": {
    mode: "mutated-first-argument",
    /**
     * The graded contract is the mutated array, so the reference truncates it
     * to the compressed length rather than returning that length. See the note
     * in the generator's report about what that costs Java.
     */
    solve: (chars) => {
      let write = 0;
      let read = 0;
      while (read < chars.length) {
        const character = chars[read];
        let run = 0;
        while (read < chars.length && chars[read] === character) {
          read++;
          run++;
        }
        chars[write++] = character;
        if (run > 1) for (const digit of String(run)) chars[write++] = digit;
      }
      chars.length = write;
      return chars;
    },
    generate: () => [
      [["a", "b"]],
      [["a", "a"]],
      [["a", "a", "a", "a", "a", "a", "a", "a", "a", "a"]],
      // A run of exactly 100 writes three digits, one more than the run of 12
      // in the authored examples.
      [Array.from({ length: 100 }, () => "z")],
      [["1", "1", "2"]],
      [Array.from({ length: 1_000 }, (_, i) => (i % 2 === 0 ? "a" : "b"))],
      [Array.from({ length: 2_000 }, () => "q")]
    ]
  },

  "longest-substring-without-repeating-characters": {
    solve: (s) => {
      const lastSeen = new Map();
      let start = 0;
      let best = 0;
      for (let i = 0; i < s.length; i++) {
        const previous = lastSeen.get(s[i]);
        // Only move the window forward; a stale index behind `start` must not
        // drag it back.
        if (previous !== undefined && previous >= start) start = previous + 1;
        lastSeen.set(s[i], i);
        best = Math.max(best, i - start + 1);
      }
      return best;
    },
    generate: () => [
      [""],
      ["a"],
      ["au"],
      ["aab"],
      ["dvdf"],
      ["abba"],
      ["tmmzuxt"],
      ["abcdefghij"],
      [randomString(2_000, "abcde", 29)]
    ]
  },

  "find-all-anagrams-in-a-string": {
    solve: (s, p) => {
      if (p.length > s.length) return [];
      const need = new Array(26).fill(0);
      const window = new Array(26).fill(0);
      const index = (character) => character.charCodeAt(0) - 97;
      for (const character of p) need[index(character)]++;
      const out = [];
      for (let i = 0; i < s.length; i++) {
        window[index(s[i])]++;
        if (i >= p.length) window[index(s[i - p.length])]--;
        if (i >= p.length - 1 && need.every((count, letter) => count === window[letter])) {
          out.push(i - p.length + 1);
        }
      }
      return out;
    },
    generate: () => [
      ["a", "a"],
      ["a", "b"],
      ["a", "ab"],
      ["aaaa", "aa"],
      ["baa", "aa"],
      ["abcdefg", "gfedcba"],
      ["zzzzz", "zz"],
      [randomString(2_000, "abc", 41), "abc"]
    ]
  },

  "permutation-in-string": {
    solve: (s1, s2) => {
      if (s1.length > s2.length) return false;
      const need = new Array(26).fill(0);
      const window = new Array(26).fill(0);
      const index = (character) => character.charCodeAt(0) - 97;
      for (const character of s1) need[index(character)]++;
      for (let i = 0; i < s2.length; i++) {
        window[index(s2[i])]++;
        if (i >= s1.length) window[index(s2[i - s1.length])]--;
        if (i >= s1.length - 1 && need.every((count, letter) => count === window[letter])) {
          return true;
        }
      }
      return false;
    },
    generate: () => [
      ["a", "a"],
      ["a", "b"],
      ["ab", "a"],
      ["adc", "dcda"],
      ["hello", "ooolleoooleh"],
      ["abc", "ccccbbbbaaaa"],
      ["aa", `${"b".repeat(1_998)}aa`]
    ]
  },

  "minimum-window-substring": {
    solve: (s, t) => {
      if (t.length === 0 || s.length < t.length) return "";
      const need = new Map();
      for (const character of t) need.set(character, (need.get(character) ?? 0) + 1);
      let missing = need.size;
      const have = new Map();
      let best = "";
      let start = 0;
      for (let end = 0; end < s.length; end++) {
        const character = s[end];
        if (need.has(character)) {
          have.set(character, (have.get(character) ?? 0) + 1);
          if (have.get(character) === need.get(character)) missing--;
        }
        while (missing === 0) {
          if (best === "" || end - start + 1 < best.length) best = s.slice(start, end + 1);
          const leaving = s[start];
          if (need.has(leaving)) {
            have.set(leaving, have.get(leaving) - 1);
            if (have.get(leaving) < need.get(leaving)) missing++;
          }
          start++;
        }
      }
      return best;
    },
    generate: () =>
      unambiguous(
        [
          ["a", "b"],
          ["ab", "b"],
          ["ab", "ab"],
          ["bba", "ab"],
          ["cabwefgewcwaefgcf", "cae"],
          ["aaflslflsldkalskaaa", "aaa"],
          ["ADOBECODEBANC", "ABCA"],
          ["abcabcabcabc", "aabbcc"]
        ],
        (s, t) => allMinimumWindows(s, t)
      )
  },

  "longest-palindromic-substring": {
    solve: (s) => {
      let best = "";
      const expand = (lo, hi) => {
        while (lo >= 0 && hi < s.length && s[lo] === s[hi]) {
          lo--;
          hi++;
        }
        return s.slice(lo + 1, hi);
      };
      for (let i = 0; i < s.length; i++) {
        for (const candidate of [expand(i, i), expand(i, i + 1)]) {
          if (candidate.length > best.length) best = candidate;
        }
      }
      return best;
    },
    // Every input here has exactly one longest palindrome; the filter is what
    // guarantees it, so adding a new input needs no manual reasoning about ties.
    generate: () =>
      unambiguous(
        [
          ["a"],
          ["aa"],
          ["aaaa"],
          ["ac"],
          ["abcda"],
          ["racecar"],
          ["forgeeksskeegfor"],
          ["abacdfgdcaba"],
          ["bananas"],
          ["aaaabaaa"],
          ["a".repeat(1_000)]
        ],
        (s) => allLongestPalindromes(s)
      )
  },

  "roman-to-integer": {
    solve: (s) => {
      const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      let total = 0;
      for (let i = 0; i < s.length; i++) {
        // A smaller numeral before a larger one subtracts.
        if (values[s[i]] < values[s[i + 1]]) total -= values[s[i]];
        else total += values[s[i]];
      }
      return total;
    },
    generate: () => [
      ["I"],
      ["IV"],
      ["IX"],
      ["XL"],
      ["XC"],
      ["CD"],
      ["CM"],
      ["MMMCMXCIX"],
      ["MMMDCCCLXXXVIII"],
      ["IIII"]
    ]
  },

  "integer-to-roman": {
    solve: (num) => {
      const table = [
        [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
        [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
        [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
      ];
      let remaining = num;
      let out = "";
      for (const [value, numeral] of table) {
        while (remaining >= value) {
          out += numeral;
          remaining -= value;
        }
      }
      return out;
    },
    generate: () => [
      [1],
      [4],
      [9],
      [14],
      [40],
      [90],
      [400],
      [900],
      [1000],
      [3999],
      [2024]
    ]
  },

  "compare-version-numbers": {
    solve: (version1, version2) => {
      const left = version1.split(".");
      const right = version2.split(".");
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        // A missing revision is zero, which is what makes "1.0" equal "1.0.0".
        const a = Number(left[i] ?? 0);
        const b = Number(right[i] ?? 0);
        if (a !== b) return a < b ? -1 : 1;
      }
      return 0;
    },
    generate: () => [
      ["1", "1"],
      ["1", "1.0"],
      ["1.0.0.0", "1"],
      ["1.2", "1.10"],
      ["1.10", "1.2"],
      ["0", "0.0.0"],
      ["7.5.2.4", "7.5.3"],
      ["1.0.1", "1"],
      // Leading zeros are not significant; a lexicographic compare gets this wrong.
      ["1.000001", "1.1"],
      ["01", "1"]
    ]
  },

  "count-and-say": {
    solve: (n) => {
      let current = "1";
      for (let step = 1; step < n; step++) {
        let next = "";
        let i = 0;
        while (i < current.length) {
          let run = 0;
          const digit = current[i];
          while (i < current.length && current[i] === digit) {
            i++;
            run++;
          }
          next += `${run}${digit}`;
        }
        current = next;
      }
      return current;
    },
    // n is capped at 20 — the term lengths grow about 1.3x per step and n = 30
    // would put a 5,800-character literal in the bank for no extra signal.
    generate: () => [[2], [3], [6], [7], [8], [12], [20]]
  },

  "zigzag-conversion": {
    solve: (s, numRows) => {
      if (numRows === 1) return s;
      const rows = Array.from({ length: numRows }, () => "");
      let row = 0;
      let step = 1;
      for (const character of s) {
        rows[row] += character;
        if (row === 0) step = 1;
        else if (row === numRows - 1) step = -1;
        row += step;
      }
      return rows.join("");
    },
    generate: () => [
      ["A", 2],
      ["AB", 1],
      ["AB", 2],
      ["AB", 5],
      ["ABC", 2],
      ["ABCD", 3],
      // More rows than characters — the lower rows stay empty.
      ["ABCDE", 10],
      [randomString(1_000, "ABCDEFGH", 53), 7]
    ]
  },

  "decode-string": {
    solve: (s) => {
      const counts = [];
      const parts = [];
      let current = "";
      let count = 0;
      for (const character of s) {
        if (character >= "0" && character <= "9") {
          // Multi-digit repeat counts accumulate across characters.
          count = count * 10 + Number(character);
        } else if (character === "[") {
          counts.push(count);
          parts.push(current);
          count = 0;
          current = "";
        } else if (character === "]") {
          current = parts.pop() + current.repeat(counts.pop());
        } else {
          current += character;
        }
      }
      return current;
    },
    generate: () => [
      ["abc"],
      ["1[a]"],
      ["0[a]"],
      ["10[a]"],
      ["2[2[2[a]]]"],
      ["a2[b]c"],
      ["3[a]b2[c]"],
      ["2[ab3[cd]]ef"],
      ["100[leetcode]"]
    ]
  },

  "multiply-strings": {
    // BigInt is the reference precisely because it cannot make the carry
    // mistakes the question is about; the candidate still has to do it by hand.
    solve: (num1, num2) => (BigInt(num1) * BigInt(num2)).toString(),
    generate: () => [
      ["0", "0"],
      ["0", "123"],
      ["9", "9"],
      ["99", "99"],
      ["999", "999"],
      ["1", "999999999"],
      ["123456789", "987654321"],
      ["9".repeat(50), "9".repeat(50)],
      ["1".repeat(100), "1"]
    ]
  },

  "find-the-index-of-the-first-occurrence-in-a-string": {
    solve: (haystack, needle) => haystack.indexOf(needle),
    generate: () => [
      ["", ""],
      ["a", ""],
      ["", "a"],
      ["a", "aa"],
      ["aaa", "aaa"],
      ["mississippi", "issip"],
      // The naive scan matches "aaab" only at the very end.
      [`${"aaa".repeat(500)}aaab`, "aaab"],
      ["abcabcabcd", "abcd"]
    ]
  },

  "text-justification": {
    solve: (words, maxWidth) => {
      const lines = [];
      let line = [];
      let letters = 0;
      const flush = (isLast) => {
        if (isLast || line.length === 1) {
          const text = line.join(" ");
          lines.push(text + " ".repeat(maxWidth - text.length));
          return;
        }
        const gaps = line.length - 1;
        const spaces = maxWidth - letters;
        const base = Math.floor(spaces / gaps);
        // Extra spaces go to the leftmost gaps first.
        const extra = spaces % gaps;
        let text = "";
        for (let i = 0; i < line.length; i++) {
          text += line[i];
          if (i < gaps) text += " ".repeat(base + (i < extra ? 1 : 0));
        }
        lines.push(text);
      };
      for (const word of words) {
        if (line.length && letters + line.length + word.length > maxWidth) {
          flush(false);
          line = [];
          letters = 0;
        }
        line.push(word);
        letters += word.length;
      }
      if (line.length) flush(true);
      return lines;
    },
    generate: () => [
      [["a"], 1],
      [["a"], 5],
      [["a", "b"], 3],
      [["a", "b", "c", "d", "e"], 3],
      // A word exactly as long as the line gets a line of its own.
      [["abcdef", "gh"], 6],
      [["Science", "is", "what", "we", "understand", "well", "enough", "to", "explain", "to", "a", "computer."], 20],
      [Array.from({ length: 200 }, () => "word"), 20]
    ]
  }
};
