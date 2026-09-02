/**
 * Reference solutions and input generators for Phase 6 — Stack & Queue.
 *
 * The whole phase is covered, including the five class-operation questions.
 * Those needed no change to the generator: their `arguments` already are the
 * call sequence, so `solve(...operations)` simulates the structure and returns
 * the results array the runner compares against. What each reference has to
 * match exactly is the runner's own bookkeeping, which differs per question:
 *
 *   min-stack     `push` and `pop` report null even though pop returns a value
 *   queue/stack   a void operation reports null; `pop` reports what it removed
 *   circular      `arguments[0]` is the constructor arguments, not an operation
 *   stock-span    `arguments[0]` is the whole price series, one result each
 *
 * Getting one of those wrong is caught immediately: the reference is replayed
 * against the question's authored cases before it may generate anything.
 *
 * Integer division is the other trap here. `evaluate-reverse-polish-notation`
 * and both calculators truncate **toward zero**, so -7/2 is -3 and not -4 —
 * `Math.trunc`, never `Math.floor`.
 */

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const randomInts = (n, lo, hi, seed = 7) => {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
};

export const phase6 = {
  "valid-parentheses": {
    solve: (s) => {
      const pairs = { ")": "(", "]": "[", "}": "{" };
      const stack = [];
      for (const character of s) {
        if (character in pairs) {
          if (stack.pop() !== pairs[character]) return false;
        } else stack.push(character);
      }
      return stack.length === 0;
    },
    generate: () => [
      [""],
      ["("],
      [")"],
      ["(("],
      ["))"],
      ["([)]"],
      ["{[]}"],
      // Closing before anything opened, and a deep balanced nest.
      ["]"],
      ["(".repeat(1_000) + ")".repeat(1_000)],
      ["()".repeat(1_000)]
    ]
  },

  "evaluate-reverse-polish-notation": {
    solve: (tokens) => {
      const stack = [];
      for (const token of tokens) {
        if (token === "+" || token === "-" || token === "*" || token === "/") {
          const right = stack.pop();
          const left = stack.pop();
          if (token === "+") stack.push(left + right);
          else if (token === "-") stack.push(left - right);
          else if (token === "*") stack.push(left * right);
          // Truncation toward zero, not floor: -7 / 2 is -3.
          else stack.push(Math.trunc(left / right));
        } else stack.push(Number(token));
      }
      return stack[0];
    },
    generate: () => [
      [["1"]],
      [["-1"]],
      [["1", "2", "+"]],
      [["1", "2", "-"]],
      // Negative division in both directions — the truncation cases.
      [["-7", "2", "/"]],
      [["7", "-2", "/"]],
      [["-7", "-2", "/"]],
      [["3", "-4", "*"]],
      [["100", "200", "+", "2", "/"]]
    ]
  },

  "simplify-path": {
    solve: (path) => {
      const stack = [];
      for (const part of path.split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") stack.pop();
        else stack.push(part);
      }
      return `/${stack.join("/")}`;
    },
    generate: () => [
      ["/"],
      ["/a"],
      ["/a/"],
      ["/a/./b"],
      ["/a/../"],
      // More ".." than there is path to climb, and names that merely start with dots.
      ["/../../../"],
      ["/a/../../b"],
      ["/..."],
      ["/a/..b/c"],
      ["/a//////b"],
      [`/${"a/".repeat(500)}`]
    ]
  },

  "asteroid-collision": {
    solve: (asteroids) => {
      const stack = [];
      for (const asteroid of asteroids) {
        let alive = true;
        // Only a right-mover meeting a left-mover collides.
        while (alive && asteroid < 0 && stack.length > 0 && stack[stack.length - 1] > 0) {
          const top = stack[stack.length - 1];
          if (top < -asteroid) stack.pop();
          else if (top === -asteroid) {
            stack.pop();
            alive = false;
          } else alive = false;
        }
        if (alive) stack.push(asteroid);
      }
      return stack;
    },
    generate: () => [
      [[]],
      [[1]],
      [[-1]],
      [[-2, -1, 1, 2]],
      [[1, -1]],
      [[1, -2]],
      // One large left-mover clears a run of right-movers.
      [[5, 5, 5, -10]],
      [[-2, 1, 2, -5]],
      [[10, -5, -5, -5]],
      [randomInts(500, -10, 10, 137).filter((value) => value !== 0)]
    ]
  },

  "daily-temperatures": {
    solve: (temperatures) => {
      const answer = new Array(temperatures.length).fill(0);
      const stack = [];
      for (let i = 0; i < temperatures.length; i++) {
        while (stack.length && temperatures[stack[stack.length - 1]] < temperatures[i]) {
          const previous = stack.pop();
          answer[previous] = i - previous;
        }
        stack.push(i);
      }
      return answer;
    },
    generate: () => [
      [[1]],
      [[2, 1]],
      [[1, 2]],
      [[5, 5, 5]],
      // Strictly decreasing means every answer is zero.
      [Array.from({ length: 500 }, (_, i) => 500 - i)],
      [Array.from({ length: 500 }, (_, i) => i)],
      [randomInts(1_000, 30, 100, 139)]
    ]
  },

  "next-greater-element-i": {
    solve: (nums1, nums2) => {
      const nextGreater = new Map();
      const stack = [];
      for (const value of nums2) {
        while (stack.length && stack[stack.length - 1] < value) nextGreater.set(stack.pop(), value);
        stack.push(value);
      }
      return nums1.map((value) => nextGreater.get(value) ?? -1);
    },
    generate: () => [
      [[1], [1]],
      [[1], [1, 2]],
      [[2], [1, 2]],
      [[1, 2], [2, 1]],
      [[3, 1, 2], [3, 2, 1]],
      // nums1 is the whole of nums2, in reverse.
      [[4, 3, 2, 1], [1, 2, 3, 4]],
      [Array.from({ length: 500 }, (_, i) => i), Array.from({ length: 500 }, (_, i) => i)]
    ]
  },

  "next-greater-element-ii": {
    solve: (nums) => {
      const n = nums.length;
      const answer = new Array(n).fill(-1);
      const stack = [];
      // Two passes: the wrap-around means an element can be answered by one
      // that came before it.
      for (let i = 0; i < 2 * n; i++) {
        const value = nums[i % n];
        while (stack.length && nums[stack[stack.length - 1]] < value) answer[stack.pop()] = value;
        if (i < n) stack.push(i);
      }
      return answer;
    },
    generate: () => [
      [[1]],
      [[1, 2]],
      [[2, 1]],
      [[1, 1, 1]],
      [[5, 4, 3, 2, 1]],
      [[1, 2, 3, 4, 5]],
      [randomInts(500, -20, 20, 149)]
    ]
  },

  "remove-k-digits": {
    solve: (num, k) => {
      const stack = [];
      let remaining = k;
      for (const digit of num) {
        while (remaining > 0 && stack.length && stack[stack.length - 1] > digit) {
          stack.pop();
          remaining--;
        }
        stack.push(digit);
      }
      // A non-decreasing run leaves nothing to drop, so trim from the end.
      const kept = stack.slice(0, stack.length - remaining).join("").replace(/^0+/, "");
      return kept === "" ? "0" : kept;
    },
    generate: () => [
      ["1", 1],
      ["1", 0],
      ["12", 1],
      ["21", 1],
      ["112", 1],
      ["100", 1],
      // Removing everything, and removing nothing from a descending number.
      ["9876543210", 10],
      ["9876543210", 9],
      ["10001", 4],
      ["1234567890", 5]
    ]
  },

  "car-fleet": {
    solve: (target, position, speed) => {
      const cars = position
        .map((start, index) => [start, (target - start) / speed[index]])
        .sort((a, b) => b[0] - a[0]);
      let fleets = 0;
      let slowest = 0;
      for (const [, time] of cars) {
        // A car that needs longer than the one ahead starts a new fleet.
        if (time > slowest) {
          fleets++;
          slowest = time;
        }
      }
      return fleets;
    },
    generate: () => [
      [10, [], []],
      [10, [0], [1]],
      [10, [0, 5], [1, 1]],
      [10, [5, 0], [1, 1]],
      // Everyone arrives together, and everyone arrives separately.
      [12, [0, 2, 4], [3, 2, 1]],
      [10, [0, 1, 2], [1, 1, 1]],
      [100, [0, 10, 20, 30], [4, 3, 2, 1]],
      [1_000, randomInts(200, 0, 999, 151), randomInts(200, 1, 10, 157)]
    ]
  },

  "basic-calculator-ii": {
    solve: (s) => {
      const stack = [];
      let number = 0;
      let operator = "+";
      for (let i = 0; i < s.length; i++) {
        const character = s[i];
        if (character >= "0" && character <= "9") number = number * 10 + Number(character);
        if ((character !== " " && !(character >= "0" && character <= "9")) || i === s.length - 1) {
          if (operator === "+") stack.push(number);
          else if (operator === "-") stack.push(-number);
          else if (operator === "*") stack.push(stack.pop() * number);
          else stack.push(Math.trunc(stack.pop() / number));
          operator = character;
          number = 0;
        }
      }
      return stack.reduce((total, value) => total + value, 0);
    },
    generate: () => [
      ["1"],
      ["1+1"],
      ["2*3"],
      ["7/2"],
      // Truncation toward zero, and precedence across a long chain.
      ["0-7/2"],
      ["1-1*2"],
      ["2*3+4*5"],
      ["100/3/3"],
      ["  42  "],
      [Array.from({ length: 300 }, (_, i) => (i % 2 === 0 ? "2" : "+")).join("") + "2"]
    ]
  },

  "basic-calculator": {
    solve: (s) => {
      let total = 0;
      let number = 0;
      let sign = 1;
      const stack = [];
      for (const character of s) {
        if (character >= "0" && character <= "9") number = number * 10 + Number(character);
        else if (character === "+" || character === "-") {
          total += sign * number;
          number = 0;
          sign = character === "+" ? 1 : -1;
        } else if (character === "(") {
          // Park the running total and sign; the bracket starts fresh.
          stack.push(total, sign);
          total = 0;
          sign = 1;
        } else if (character === ")") {
          total += sign * number;
          number = 0;
          const previousSign = stack.pop();
          total = stack.pop() + previousSign * total;
          sign = 1;
        }
      }
      return total + sign * number;
    },
    generate: () => [
      ["1"],
      ["-1"],
      ["(1)"],
      ["-(1)"],
      ["1-(2)"],
      // A negated bracket, and nesting several deep.
      ["2-(5-6)"],
      ["-(2+3)"],
      ["((((1))))"],
      ["1-(2-(3-(4-5)))"],
      ["  30 - ( 4 + 5 ) "]
    ]
  },

  "largest-rectangle-in-histogram": {
    solve: (heights) => {
      const stack = [];
      let best = 0;
      for (let i = 0; i <= heights.length; i++) {
        const height = i === heights.length ? 0 : heights[i];
        while (stack.length && heights[stack[stack.length - 1]] >= height) {
          const top = heights[stack.pop()];
          const left = stack.length ? stack[stack.length - 1] + 1 : 0;
          best = Math.max(best, top * (i - left));
        }
        stack.push(i);
      }
      return best;
    },
    generate: () => [
      [[]],
      [[1]],
      [[0]],
      [[1, 1]],
      [[2, 2, 2]],
      [[5, 4, 3, 2, 1]],
      [[1, 2, 3, 4, 5]],
      // A flat plateau, and one tall spike among short bars.
      [Array.from({ length: 1_000 }, () => 7)],
      [[1, 1, 1, 1_000, 1, 1, 1]],
      [randomInts(1_000, 0, 100, 163)]
    ]
  },

  "min-stack": {
    /**
     * The runner reports null for `push` and `pop` here even though a real
     * `pop` returns the value it removed — that is the contract the authored
     * cases were written against.
     */
    solve: (...operations) => {
      const values = [];
      const minimums = [];
      return operations.map(([name, argument]) => {
        if (name === "push") {
          values.push(argument);
          minimums.push(Math.min(argument, minimums.length ? minimums[minimums.length - 1] : Infinity));
          return null;
        }
        if (name === "pop") {
          values.pop();
          minimums.pop();
          return null;
        }
        if (name === "top") return values[values.length - 1];
        return minimums[minimums.length - 1];
      });
    },
    generate: () => [
      [["push", 1], ["top"], ["getMin"]],
      [["push", 1], ["push", 1], ["pop"], ["getMin"]],
      // The minimum leaves and has to come back.
      [["push", 5], ["push", 1], ["getMin"], ["pop"], ["getMin"]],
      [["push", -1], ["push", -2], ["push", -3], ["getMin"], ["pop"], ["getMin"]],
      [["push", 0], ["push", 0], ["getMin"], ["pop"], ["top"], ["getMin"]],
      [
        ...Array.from({ length: 200 }, (_, i) => ["push", 200 - i]),
        ["getMin"],
        ...Array.from({ length: 100 }, () => ["pop"]),
        ["getMin"],
        ["top"]
      ]
    ]
  },

  "implement-queue-using-stacks": {
    // Unlike min-stack, `pop` reports the value it removed; only void operations
    // report null.
    solve: (...operations) => {
      const items = [];
      return operations.map(([name, argument]) => {
        if (name === "push") {
          items.push(argument);
          return null;
        }
        if (name === "pop") return items.shift();
        if (name === "peek") return items[0];
        return items.length === 0;
      });
    },
    generate: () => [
      [["empty"]],
      [["push", 1], ["peek"]],
      [["push", 1], ["pop"], ["empty"]],
      [["push", 1], ["push", 2], ["pop"], ["peek"], ["empty"]],
      // Interleaved pushes and pops — FIFO order is the whole question.
      [["push", 1], ["pop"], ["push", 2], ["pop"], ["empty"]],
      [
        ...Array.from({ length: 200 }, (_, i) => ["push", i]),
        ...Array.from({ length: 200 }, () => ["pop"]),
        ["empty"]
      ]
    ]
  },

  "implement-stack-using-queues": {
    solve: (...operations) => {
      const items = [];
      return operations.map(([name, argument]) => {
        if (name === "push") {
          items.push(argument);
          return null;
        }
        if (name === "pop") return items.pop();
        if (name === "top") return items[items.length - 1];
        return items.length === 0;
      });
    },
    generate: () => [
      [["empty"]],
      [["push", 1], ["top"]],
      [["push", 1], ["pop"], ["empty"]],
      [["push", 1], ["push", 2], ["push", 3], ["pop"], ["top"], ["empty"]],
      [["push", 1], ["pop"], ["push", 2], ["top"], ["empty"]],
      [
        ...Array.from({ length: 200 }, (_, i) => ["push", i]),
        ...Array.from({ length: 200 }, () => ["pop"]),
        ["empty"]
      ]
    ]
  },

  "design-circular-queue": {
    // `arguments[0]` is the constructor's arguments, not an operation.
    solve: (constructorArguments, ...operations) => {
      const capacity = constructorArguments[0];
      const items = [];
      return operations.map(([name, argument]) => {
        if (name === "enQueue") {
          if (items.length === capacity) return false;
          items.push(argument);
          return true;
        }
        if (name === "deQueue") {
          if (items.length === 0) return false;
          items.shift();
          return true;
        }
        if (name === "Front") return items.length ? items[0] : -1;
        if (name === "Rear") return items.length ? items[items.length - 1] : -1;
        if (name === "isEmpty") return items.length === 0;
        return items.length === capacity;
      });
    },
    generate: () => [
      [[1], ["isEmpty"]],
      [[1], ["Front"], ["Rear"]],
      [[1], ["deQueue"]],
      [[1], ["enQueue", 1], ["enQueue", 2], ["isFull"]],
      // Wrapping around: fill, drain, fill again.
      [[2], ["enQueue", 1], ["enQueue", 2], ["deQueue"], ["enQueue", 3], ["Front"], ["Rear"]],
      [[3], ["enQueue", 1], ["deQueue"], ["deQueue"], ["isEmpty"], ["Front"]],
      [
        [100],
        ...Array.from({ length: 100 }, (_, i) => ["enQueue", i]),
        ["isFull"],
        ["Front"],
        ["Rear"],
        ...Array.from({ length: 100 }, () => ["deQueue"]),
        ["isEmpty"]
      ]
    ]
  },

  "online-stock-span": {
    // `arguments[0]` is the whole price series; each price yields one span.
    solve: (prices) => {
      const stack = [];
      return prices.map((price) => {
        let span = 1;
        while (stack.length && stack[stack.length - 1][0] <= price) span += stack.pop()[1];
        stack.push([price, span]);
        return span;
      });
    },
    generate: () => [
      [[]],
      [[1]],
      [[1, 1]],
      [[2, 1]],
      [[1, 2]],
      // Equal prices count toward the span; strictly decreasing never does.
      [[5, 5, 5, 5]],
      [Array.from({ length: 500 }, (_, i) => 500 - i)],
      [Array.from({ length: 500 }, (_, i) => i)],
      [randomInts(500, 1, 50, 167)]
    ]
  }
};
