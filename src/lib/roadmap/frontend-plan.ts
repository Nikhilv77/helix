/**
 * The preparation plan shown on Home.
 *
 * Six sessions make up the path. Session ids are the same strings Practice uses
 * as its session keys, so a roadmap template row and a Practice session are the
 * same identity rather than two names joined by a lookup table.
 *
 * The DSA session is a curated slice of the 200-question bank, grouped into
 * pattern chapters rather than shown end to end.
 */

export type PrepSessionStatus = "active" | "planned";

export interface PrepSession {
  id: string;
  order: number;
  title: string;
  /** One line on why this session exists. */
  purpose: string;
  /** What the session covers on the roadmap cards. */
  covers: string[];
  status: PrepSessionStatus;
}

export const PREP_SESSIONS: PrepSession[] = [
  {
    id: "dsa",
    order: 1,
    title: "DSA",
    purpose:
      "The data-structure patterns that actually come up in interview loops, in the order they build on each other.",
    covers: [
      "Pattern-by-pattern practice, warmups first",
      "Maya introduces each pattern and how to recognize it",
      "Hidden test cases, so a solution has to be right rather than lucky"
    ],
    status: "active"
  },
  {
    id: "core-technical",
    order: 2,
    title: "Core Technical",
    purpose:
      "What the language itself does — the behaviour behind bugs that look impossible until you can trace the runtime.",
    covers: [
      "Predict what code prints, then watch it run",
      "Event loop, microtask ordering and async suspension",
      "Closures, captured bindings, references and retained memory"
    ],
    status: "planned"
  },
  {
    id: "applied-engineering",
    order: 3,
    title: "Applied Engineering",
    purpose:
      "What the system around your code does — the layer where the bug is real, expensive and invisible in a unit test.",
    covers: [
      "Find the planted defect in code that looks correct",
      "Diagnose a query plan, a waterfall or a metric series",
      "N+1 queries, races, retries, caching and unbounded work"
    ],
    status: "planned"
  },
  {
    id: "architecture-system-design",
    order: 4,
    title: "Architecture & System Design",
    purpose:
      "Low-level design first — the round most interviews actually run before they ask you to draw a load balancer.",
    covers: [
      "Rate limiters, caches and the objects interviews ask you to build",
      "Interfaces, teardown and thread safety",
      "Data modelling: constraints, invariants and referential integrity"
    ],
    status: "planned"
  },
  {
    id: "resume-behavioral-defense",
    order: 5,
    title: "Resume and Behavioral Defense",
    purpose: "Defending the work already on your resume, with evidence.",
    covers: [
      "Feature deep-dives on what you actually shipped",
      "Ownership, tradeoffs and incident stories",
      "Maya pushing back on vague or unsupported claims"
    ],
    status: "planned"
  },
  {
    id: "final-mock",
    order: 6,
    title: "Final Mock",
    purpose: "A full loop simulation once the earlier sessions are behind you.",
    covers: [
      "One continuous mock across every round type",
      "Scored against the same rubric as a real loop",
      "A report naming your single highest-leverage fix"
    ],
    status: "planned"
  }
];

/** How one chapter of the DSA session is assembled from the bank. */
export interface DsaChapterConfig {
  id: string;
  title: string;
  /** Why this pattern is worth the time — shown under the chapter title. */
  whyItMatters: string;
  /** Primary patterns that feed this chapter. */
  patterns: string[];
  /** Target number of questions to pull. */
  take: number;
  /** Ceiling on hard questions, so the path stays learnable rather than exhaustive. */
  maxHard: number;
}

/**
 * Ordered so the path runs warmups → core mediums, with the advanced families
 * deliberately last and thin. Counts sum to roughly 120 of the 200 questions.
 *
 * Patterns are role-independent: a backend, mobile or data candidate meets the
 * same sliding window a frontend candidate does.
 */
export const DSA_CHAPTERS: DsaChapterConfig[] = [
  {
    id: "arrays-hashing",
    title: "Arrays & Hashing",
    whyItMatters:
      "The warmup round. Counting, lookups and single-pass scans show up in almost every phone screen.",
    patterns: ["arrays-hashing", "math", "prefix-sum", "kadane"],
    take: 10,
    maxHard: 1
  },
  {
    id: "two-pointers",
    title: "Two Pointers",
    whyItMatters:
      "Turns quadratic scans into linear ones. The technique interviewers most often expect you to reach for unprompted.",
    patterns: ["two-pointers"],
    take: 11,
    maxHard: 1
  },
  {
    id: "sliding-window",
    title: "Sliding Window",
    whyItMatters:
      "Substring and subarray questions in disguise. Recognizing the window is most of the work.",
    patterns: ["sliding-window"],
    take: 11,
    maxHard: 1
  },
  {
    id: "stack-queue",
    title: "Stack & Queue",
    whyItMatters:
      "Parsing, nesting and next-greater problems — the pattern behind matching, undo stacks and expression evaluation.",
    patterns: ["stack", "queue"],
    take: 12,
    maxHard: 1
  },
  {
    id: "binary-search",
    title: "Binary Search",
    whyItMatters:
      "Cheap to learn, frequently asked, and the boundary variants are where most candidates slip.",
    patterns: ["binary-search"],
    take: 12,
    maxHard: 1
  },
  {
    id: "linked-list",
    title: "Linked List",
    whyItMatters:
      "Pure pointer discipline. Rarely production work, but a standard filter in onsite rounds.",
    patterns: ["linked-list"],
    take: 12,
    maxHard: 1
  },
  {
    id: "trees",
    title: "Trees",
    whyItMatters:
      "The DOM is a tree. Traversal, depth and structural comparison map directly onto UI reasoning.",
    patterns: ["tree", "binary-search-tree"],
    take: 16,
    maxHard: 2
  },
  {
    id: "heaps",
    title: "Heaps & Top-K",
    whyItMatters:
      "Ranking, top-k and streaming medians — small family, high hit rate, quick to get comfortable with.",
    patterns: ["heap"],
    take: 7,
    maxHard: 1
  },
  {
    id: "intervals-matrix",
    title: "Intervals, Grids & Greedy",
    whyItMatters:
      "Scheduling, layout and grid traversal. Practical shapes that also read well in a system-design answer.",
    patterns: ["intervals", "matrix", "greedy", "simulation", "sorting", "string-matching"],
    take: 9,
    maxHard: 1
  },
  {
    id: "backtracking-tries",
    title: "Backtracking & Tries",
    whyItMatters:
      "Autocomplete and combination generation. Enough exposure to handle the common asks, not a deep dive.",
    patterns: ["backtracking", "trie"],
    take: 6,
    maxHard: 1
  },
  {
    id: "dp-basics",
    title: "Dynamic Programming Basics",
    whyItMatters:
      "One-dimensional recurrences and grid paths only. Frontend loops rarely go past this, so neither does the path.",
    patterns: ["dynamic-programming"],
    take: 10,
    maxHard: 0
  },
  {
    id: "graphs-light",
    title: "Graphs — Light Exposure",
    whyItMatters:
      "Enough to handle a flood fill or a dependency order if it comes up. Deliberately shallow.",
    patterns: ["graph", "union-find"],
    take: 7,
    maxHard: 0
  }
];

/** The minimum a question needs to appear in the plan. */
export interface PlanQuestion {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  primaryPattern: string;
  expectedTimeMinutes: number;
  phaseSlug: string;
  phaseNumber: number;
  recommendedOrder: number;
}

export interface DsaChapter {
  id: string;
  title: string;
  whyItMatters: string;
  questions: PlanQuestion[];
  counts: { easy: number; medium: number; hard: number };
  /** Sum of the chapter's estimated times, in minutes. */
  minutes: number;
}

const DIFFICULTY_RANK: Record<PlanQuestion["difficulty"], number> = {
  easy: 0,
  medium: 1,
  hard: 2
};

function byTeachingOrder(a: PlanQuestion, b: PlanQuestion): number {
  return a.phaseNumber - b.phaseNumber || a.recommendedOrder - b.recommendedOrder;
}

/**
 * Picks one chapter's questions: every easy first, then mediums, then hards up
 * to the chapter ceiling, and finally re-sorted so the chapter itself reads
 * warmup → core. Selection is deterministic, so the plan is stable between
 * requests and safe to cache.
 */
function selectChapter(config: DsaChapterConfig, pool: PlanQuestion[]): PlanQuestion[] {
  const patterns = new Set(config.patterns);
  const candidates = pool.filter((question) => patterns.has(question.primaryPattern));

  const easy = candidates.filter((q) => q.difficulty === "easy").sort(byTeachingOrder);
  const medium = candidates.filter((q) => q.difficulty === "medium").sort(byTeachingOrder);
  const hard = candidates.filter((q) => q.difficulty === "hard").sort(byTeachingOrder);

  // Reserve the hard slots up front. Filling with easy and medium first and
  // appending hards afterwards would silently starve them, since the chapter is
  // already full by then — which makes maxHard a ceiling that never applies.
  const hardPicks = hard.slice(0, Math.min(config.maxHard, config.take));
  const softBudget = config.take - hardPicks.length;

  const picked: PlanQuestion[] = [];
  for (const question of [...easy, ...medium]) {
    if (picked.length >= softBudget) break;
    picked.push(question);
  }
  picked.push(...hardPicks);

  return picked.sort(
    (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || byTeachingOrder(a, b)
  );
}

/**
 * Builds the curated DSA path from the full bank. A question is only
 * ever claimed by the first chapter whose patterns match, so nothing is
 * duplicated across chapters.
 */
export function curateFrontendDsa(all: PlanQuestion[]): DsaChapter[] {
  const claimed = new Set<string>();
  const chapters: DsaChapter[] = [];

  for (const config of DSA_CHAPTERS) {
    const pool = all.filter((question) => !claimed.has(question.slug));
    const questions = selectChapter(config, pool);
    for (const question of questions) claimed.add(question.slug);

    chapters.push({
      id: config.id,
      title: config.title,
      whyItMatters: config.whyItMatters,
      questions,
      counts: {
        easy: questions.filter((q) => q.difficulty === "easy").length,
        medium: questions.filter((q) => q.difficulty === "medium").length,
        hard: questions.filter((q) => q.difficulty === "hard").length
      },
      minutes: questions.reduce((total, q) => total + q.expectedTimeMinutes, 0)
    });
  }

  return chapters.filter((chapter) => chapter.questions.length > 0);
}

/**
 * What Maya can say about the path right now, drawn from the question bank
 * rather than invented. `watchOut` and `signal` are real strings written for
 * the next question; they are null when the bank has none.
 */
export interface CoachBrief {
  chapterTitle: string;
  chapterWhy: string;
  questionTitle: string;
  questionSlug: string;
  watchOut: string | null;
  signal: string | null;
}

export interface FrontendDsaPlan {
  chapters: DsaChapter[];
  /** Absent when the bank has no coaching text for the next question. */
  coach?: CoachBrief | null;
  totalQuestions: number;
  totalMinutes: number;
  counts: { easy: number; medium: number; hard: number };
  /** Where the CTA sends someone who has not started. */
  firstQuestionSlug: string | null;
}

export function buildFrontendDsaPlan(all: PlanQuestion[]): FrontendDsaPlan {
  const chapters = curateFrontendDsa(all);
  const questions = chapters.flatMap((chapter) => chapter.questions);

  return {
    chapters,
    totalQuestions: questions.length,
    totalMinutes: questions.reduce((total, q) => total + q.expectedTimeMinutes, 0),
    counts: {
      easy: questions.filter((q) => q.difficulty === "easy").length,
      medium: questions.filter((q) => q.difficulty === "medium").length,
      hard: questions.filter((q) => q.difficulty === "hard").length
    },
    firstQuestionSlug: chapters[0]?.questions[0]?.slug ?? null
  };
}
