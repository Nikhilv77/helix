"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { Reveal, useRotator, useViewportPresence } from "./visuals/reveal";

interface PracticePair {
  question: string;
  explanation: string;
}

/**
 * Three classic problems, three questions each. The questions are about the
 * code on the left, so the two halves have to stay in the same order — group
 * `n` of the pairs belongs to scene `n`.
 */
const practicePairs: readonly PracticePair[] = [
  {
    question: "Why a hash map instead of two loops?",
    explanation:
      "The nested version checks every pair, which is O(n²). Storing what you have already seen turns the lookup into one hash probe, so the whole scan is O(n)."
  },
  {
    question: "What is `need` actually holding?",
    explanation:
      "The complement — the number that would complete the pair. Rather than search for it, you ask the map whether you have passed it already."
  },
  {
    question: "Why store the value after the check?",
    explanation:
      "Checking first means an element can never match itself. Store before the check and `[3, 3]` with a target of 6 returns the same index twice."
  },
  {
    question: "Why move `left` instead of starting over?",
    explanation:
      "Restarting at the repeat re-scans characters you have already cleared. Sliding the window forward keeps every character visited exactly once."
  },
  {
    question: "Why check `>= left` before jumping?",
    explanation:
      "The map remembers every character, including ones already behind the window. Without that guard an old index would drag `left` backwards."
  },
  {
    question: "What does the map hold here?",
    explanation:
      "The most recent index of each character. That is enough to jump the window straight past a repeat instead of stepping one position at a time."
  },
  {
    question: "Why sort before merging?",
    explanation:
      "Sorting by start means any interval that overlaps the current one must be the very next one. Without it you would need to compare against everything."
  },
  {
    question: "When do two intervals overlap?",
    explanation:
      "When the next start is less than or equal to the current end. Because the list is sorted, that single comparison is the whole test."
  },
  {
    question: "Why take the max of the two ends?",
    explanation:
      "The next interval can finish before the current one does. Taking the larger end keeps a fully contained interval from shrinking the merge."
  }
] as const;

const codeScenes = [
  {
    file: "two-sum.js",
    lines: [
      "// Two Sum — one pass, O(n)",
      "function twoSum(nums, target) {",
      "  const seen = new Map();",
      "",
      "  for (let i = 0; i < nums.length; i++) {",
      "    const need = target - nums[i];",
      "",
      "    if (seen.has(need)) {",
      "      return [seen.get(need), i];",
      "    }",
      "    seen.set(nums[i], i);",
      "  }",
      "  return [];",
      "}"
    ]
  },
  {
    file: "longest-substring.js",
    lines: [
      "// Longest substring, no repeats",
      "function lengthOfLongest(s) {",
      "  const last = new Map();",
      "  let left = 0;",
      "  let best = 0;",
      "",
      "  for (let right = 0; right < s.length; right++) {",
      "    const ch = s[right];",
      "",
      "    if (last.has(ch) && last.get(ch) >= left) {",
      "      left = last.get(ch) + 1;",
      "    }",
      "    last.set(ch, right);",
      "    best = Math.max(best, right - left + 1);",
      "  }",
      "  return best;",
      "}"
    ]
  },
  {
    file: "merge-intervals.js",
    lines: [
      "// Merge overlapping intervals",
      "function merge(intervals) {",
      "  intervals.sort((a, b) => a[0] - b[0]);",
      "  const out = [];",
      "",
      "  for (const [start, end] of intervals) {",
      "    const last = out[out.length - 1];",
      "",
      "    if (last && start <= last[1]) {",
      "      last[1] = Math.max(last[1], end);",
      "    } else {",
      "      out.push([start, end]);",
      "    }",
      "  }",
      "  return out;",
      "}"
    ]
  }
] as const;

const GROUP_HOLD_MS = 5200;
const GROUP_EXIT_MS = 700;

/**
 * A small tokeniser so the editor uses the whole palette in globals.css rather
 * than the two colours it started with. Order is the point: comments and
 * strings have to win before anything inside them gets matched as a keyword.
 */
const TOKEN_PATTERN = new RegExp(
  [
    "(\\/\\/.*)",
    "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')",
    "(\\b\\d+(?:\\.\\d+)?\\b)",
    "(\\b(?:async|await|function|const|let|var|return|if|else|for|while|of|in|new|class|null|true|false)\\b)",
    "([A-Za-z_$][\\w$]*)(?=\\s*\\()",
    "([A-Z][\\w$]*)",
    "([^\\sA-Za-z0-9_$]+)"
  ].join("|"),
  "g"
);

/** Index of the capture group → the class it should paint. */
const TOKEN_CLASS = [undefined, "c-c", "c-g", "c-p", "c-o", "c-y", "c-r", "c-c"] as const;

function renderCode(line: string) {
  const out: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const at = match.index ?? 0;
    if (at > cursor) out.push(line.slice(cursor, at));

    const groupIndex = TOKEN_CLASS.findIndex((_, group) => group > 0 && match[group] !== undefined);
    out.push(
      <span key={`${at}-${match[0]}`} className={TOKEN_CLASS[groupIndex]}>
        {match[0]}
      </span>
    );
    cursor = at + match[0].length;
  }

  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}

function LiveEditor({
  scene,
  phase,
  active
}: {
  scene: (typeof codeScenes)[number];
  phase: "in" | "out";
  active: boolean;
}) {
  return (
    <div className="marketing-animation-scope flex h-full flex-col" data-running={active}>
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-7 py-4 sm:px-9">
        <span className="h-2 w-2 rounded-full bg-[color:var(--dm-accent)]/70" />
        <span className="font-mono text-[11px] tracking-wide text-cream/40">{scene.file}</span>
      </div>

      <div className="code-content grid flex-1 grid-cols-[1.75rem_1fr] gap-4 px-7 py-7 sm:px-9">
        <div className="select-none text-right font-mono text-[11px] leading-[24px] text-cream/20">
          {scene.lines.map((_, index) => (
            <span key={index} className="block">
              {String(index + 1).padStart(2, "0")}
            </span>
          ))}
        </div>
        <pre className="min-w-0 whitespace-pre-wrap font-mono text-[12.5px] leading-[24px] sm:text-[13px]">
          {scene.lines.map((line, index) => (
            <code
              key={`${scene.file}-${index}`}
              className="stagger-fade block break-words"
              data-phase={active ? phase : undefined}
              style={{ "--base": `${index * 45}ms`, "--n": 0 } as CSSProperties}
            >
              {line ? renderCode(line) : "\u00a0"}
              {index === scene.lines.length - 1 ? <span className="practice-editor-caret" /> : null}
            </code>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function Practice() {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useViewportPresence(stageRef);
  const { index: groupIndex, phase } = useRotator({
    length: 3,
    holdMs: GROUP_HOLD_MS,
    exitMs: GROUP_EXIT_MS,
    enabled: inView
  });

  const group = practicePairs.slice(groupIndex * 3, groupIndex * 3 + 3);
  const scene = codeScenes[groupIndex] ?? codeScenes[0];
  const animate = inView;

  return (
    <section
      id="practice"
      className="marketing-deferred-section marketing-theme-section relative z-10 overflow-hidden px-5 py-20 sm:px-10 sm:py-28"
    >
      <div className="relative mx-auto flex w-full max-w-[72rem] flex-col items-center">
        <Reveal>
          <h2 className="marketing-section-title display-heading practice-heading max-w-3xl text-center text-cream">
            Always know what to practise next.
          </h2>
        </Reveal>

        <Reveal delay={90}>
          <p className="marketing-lede mx-auto mt-5 max-w-xl text-center text-cream/68 sm:mt-6">
            Short coding questions, clear explanations, and a little more confidence each time you
            practise.
          </p>
        </Reveal>

        <Reveal delay={230} className="w-full">
          <div ref={stageRef} className="mx-auto mt-11 w-full max-w-[58rem] sm:mt-14">
            <div className="public-glass min-h-[48rem] overflow-hidden rounded-[1.5rem] sm:min-h-[27rem]">
              <div className="grid content-start items-start md:grid-cols-[1fr_1fr]">
                <div className="min-w-0">
                  <LiveEditor scene={scene} phase={phase} active={animate} />
                </div>

                <div className="practice-zone self-start border-t border-white/[0.07] px-7 py-7 md:border-l md:border-t-0 sm:px-9">
                  <div>
                    {group.map((pair, pairIndex) => (
                      <div
                        key={`${pair.question}-explanation`}
                        className="stagger-fade border-t border-white/[0.07] py-5 first:border-t-0"
                        data-phase={animate ? phase : undefined}
                        style={{ "--base": `${pairIndex * 150 + 80}ms`, "--n": 0 } as CSSProperties}
                      >
                        <p className="text-xs font-medium uppercase tracking-[0.1em] text-cream/42">
                          {pair.question}
                        </p>
                        <p className="mt-2 text-base leading-[1.7] text-cream/68">
                          {pair.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
