import phase1Arrays from "@/data/dsa/phase-1-arrays.json";
import phase2Strings from "@/data/dsa/phase-2-strings.json";
import phase3SlidingWindow from "@/data/dsa/phase-3-sliding-window.json";
import phase4BinarySearch from "@/data/dsa/phase-4-binary-search.json";
import phase5LinkedList from "@/data/dsa/phase-5-linked-list.json";
import phase6StackQueue from "@/data/dsa/phase-6-stack-queue.json";
import phase7Trees from "@/data/dsa/phase-7-trees.json";
import phase8Heap from "@/data/dsa/phase-8-heap.json";
import phase9Graphs from "@/data/dsa/phase-9-graphs.json";
import phase10DynamicProgramming from "@/data/dsa/phase-10-dynamic-programming.json";
import phase11TriesBacktracking from "@/data/dsa/phase-11-tries-backtracking.json";

/**
 * Temporary shape for the DSA question bank. The questions live in
 * `src/data/dsa/*.json` while the bank is being written; once the schema
 * settles they move into Prisma and this module becomes the read model over
 * that table instead of over the JSON files.
 */

export type DsaDifficulty = "easy" | "medium" | "hard";

/**
 * The pattern families a phase is organised around. The first ten came with
 * the array phase; `stack`, `simulation` and `string-matching` were added for
 * the string phase, `binary-search` and `linked-list` for the phases named
 * after them, where the original ten had no honest home for those questions.
 * Tries and backtracking are separate families because candidates learn them
 * through different state models. Design problems keep their algorithmic
 * pattern and carry `design-problem` as a sub-pattern rather than forming a
 * family of their own.
 */
export type DsaPattern =
  | "arrays-hashing"
  | "two-pointers"
  | "sliding-window"
  | "prefix-sum"
  | "intervals"
  | "matrix"
  | "greedy"
  | "sorting"
  | "kadane"
  | "math"
  | "stack"
  | "simulation"
  | "string-matching"
  | "binary-search"
  | "linked-list"
  | "queue"
  | "tree"
  | "binary-search-tree"
  | "heap"
  | "graph"
  | "union-find"
  | "dynamic-programming"
  | "trie"
  | "backtracking";

export interface DsaComplexity {
  time: string;
  space: string;
}

/** One way to solve a question, from brute force up to the intended solution. */
export interface DsaApproach {
  /** e.g. "Brute force — check every pair" or "Optimal — one-pass hash map". */
  name: string;
  /** The idea in prose, no code. */
  idea: string;
  /** Terse ordered outline. Still not code — a candidate should be able to say these aloud. */
  steps: string[];
  complexity: DsaComplexity;
  /** Why you would or would not choose this one. */
  tradeoff: string;
}

export interface DsaExample {
  input: string;
  output: string;
  explanation: string;
}

export interface DsaQuestion {
  title: string;
  slug: string;
  source: string;
  externalUrl: string;
  primaryPattern: DsaPattern;
  subPatterns: string[];
  difficulty: DsaDifficulty;
  expectedTimeMinutes: number;
  /** 1-based teaching order inside the phase, not the order of the source list. */
  recommendedOrder: number;
  /** Slugs of questions in the same phase that should come first. */
  prerequisites: string[];
  conceptsTested: string[];
  commonMistakes: string[];
  interviewSignals: string[];
  followUpPrompts: string[];
  promptSummary: string;
  highLevelApproach: string;
  complexity: DsaComplexity;

  // --- teaching layer -------------------------------------------------------
  // Optional only while the bank is being backfilled phase by phase; the shape
  // is frozen, so filling these in never changes the schema again.

  /** Fuller restatement in our own words: what is given, what is asked. */
  problemStatement?: string;
  /** Input bounds a candidate should ask about or assume. */
  constraints?: string[];
  examples?: DsaExample[];
  /** The one realization that turns the problem from hard to routine. */
  keyInsight?: string;
  /** Progressive nudges: each reveals a little more, none gives the answer away. */
  hints?: string[];
  /** Ordered brute force first, intended solution last. */
  approaches?: DsaApproach[];
  /** Inputs that break a naive implementation. */
  edgeCases?: string[];
  /** Slugs elsewhere in the bank worth doing next. May cross phases. */
  relatedQuestions?: string[];
}

/** True once a question carries the full teaching layer. */
export function isEnriched(question: DsaQuestion): boolean {
  return Boolean(
    question.problemStatement &&
    question.hints?.length &&
    question.approaches?.length &&
    question.keyInsight
  );
}

export interface DsaPhase {
  phase: string;
  questions: DsaQuestion[];
}

/** Every phase file, in curriculum order. New phases get appended here. */
const PHASE_FILES: DsaPhase[] = [
  phase1Arrays as DsaPhase,
  phase2Strings as DsaPhase,
  phase3SlidingWindow as DsaPhase,
  phase4BinarySearch as DsaPhase,
  phase5LinkedList as DsaPhase,
  phase6StackQueue as DsaPhase,
  phase7Trees as DsaPhase,
  phase8Heap as DsaPhase,
  phase9Graphs as DsaPhase,
  phase10DynamicProgramming as DsaPhase,
  phase11TriesBacktracking as DsaPhase
];

/** Phases with their questions sorted into the recommended teaching order. */
export function dsaPhases(): DsaPhase[] {
  return PHASE_FILES.map((phase) => ({
    ...phase,
    questions: [...phase.questions].sort((a, b) => a.recommendedOrder - b.recommendedOrder)
  }));
}

export function dsaQuestionCount(): number {
  return PHASE_FILES.reduce((total, phase) => total + phase.questions.length, 0);
}

export interface DsaPatternGroup {
  pattern: DsaPattern;
  questions: DsaQuestion[];
}

/**
 * Buckets a phase by primary pattern. Groups are ordered by the earliest
 * question in each one, so the pattern order mirrors the teaching order.
 */
export function groupByPattern(questions: DsaQuestion[]): DsaPatternGroup[] {
  const groups = new Map<DsaPattern, DsaQuestion[]>();
  for (const question of questions) {
    const bucket = groups.get(question.primaryPattern);
    if (bucket) bucket.push(question);
    else groups.set(question.primaryPattern, [question]);
  }

  return [...groups.entries()]
    .map(([pattern, grouped]) => ({
      pattern,
      questions: [...grouped].sort((a, b) => a.recommendedOrder - b.recommendedOrder)
    }))
    .sort((a, b) => firstOrder(a.questions) - firstOrder(b.questions));
}

function firstOrder(questions: DsaQuestion[]): number {
  return questions.reduce(
    (lowest, question) => Math.min(lowest, question.recommendedOrder),
    Number.POSITIVE_INFINITY
  );
}

export function countByDifficulty(questions: DsaQuestion[]): Record<DsaDifficulty, number> {
  const counts: Record<DsaDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;
  return counts;
}

/** URL- and anchor-safe id for a phase title, e.g. "Phase 6 — Stack & Queue". */
export function phaseSlug(phase: string): string {
  return phase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A question plus everything the detail view needs to place it in the bank. */
export interface DsaQuestionDetail {
  question: DsaQuestion;
  phase: string;
  phaseSlug: string;
  /** Neighbours in the same phase, by recommended order. */
  previous: DsaQuestion | null;
  next: DsaQuestion | null;
  /** Prerequisites resolved from slugs to questions. */
  prerequisites: DsaQuestion[];
  /** Questions in this phase that name this one as a prerequisite. */
  unlocks: DsaQuestion[];
  /** Related questions resolved across the full bank. */
  relatedQuestions: DsaQuestion[];
}

export function findQuestion(slug: string): DsaQuestionDetail | null {
  const phases = dsaPhases();
  const globalBySlug = new Map(
    phases.flatMap((phase) => phase.questions.map((question) => [question.slug, question]))
  );

  for (const phase of phases) {
    const index = phase.questions.findIndex((question) => question.slug === slug);
    if (index === -1) continue;

    const question = phase.questions[index];
    if (!question) continue;

    const bySlug = new Map(phase.questions.map((item) => [item.slug, item]));
    return {
      question,
      phase: phase.phase,
      phaseSlug: phaseSlug(phase.phase),
      previous: phase.questions[index - 1] ?? null,
      next: phase.questions[index + 1] ?? null,
      prerequisites: question.prerequisites
        .map((prerequisite) => bySlug.get(prerequisite))
        .filter((item): item is DsaQuestion => item !== undefined),
      unlocks: phase.questions.filter((item) => item.prerequisites.includes(slug)),
      relatedQuestions: (question.relatedQuestions ?? [])
        .map((related) => globalBySlug.get(related))
        .filter((item): item is DsaQuestion => item !== undefined)
    };
  }
  return null;
}

export function allQuestionSlugs(): string[] {
  return PHASE_FILES.flatMap((phase) => phase.questions.map((question) => question.slug));
}

export interface DsaTagUse {
  tag: string;
  questions: DsaQuestion[];
  phases: string[];
}

/**
 * Sub-pattern usage across the whole bank, most-used first. Sub-patterns are a
 * controlled vocabulary, so this doubles as the cross-phase technique index and
 * as the check that no tag has drifted into a one-off.
 */
export function subPatternIndex(): DsaTagUse[] {
  const uses = new Map<string, { questions: DsaQuestion[]; phases: Set<string> }>();
  for (const phase of dsaPhases()) {
    for (const question of phase.questions) {
      for (const tag of question.subPatterns) {
        const entry = uses.get(tag) ?? { questions: [], phases: new Set<string>() };
        entry.questions.push(question);
        entry.phases.add(phase.phase);
        uses.set(tag, entry);
      }
    }
  }
  return [...uses.entries()]
    .map(([tag, entry]) => ({ tag, questions: entry.questions, phases: [...entry.phases] }))
    .sort((a, b) => b.questions.length - a.questions.length || a.tag.localeCompare(b.tag));
}

export interface DsaAudit {
  /** No prerequisites and nothing depends on them: possibly a missing edge. */
  orphans: Array<{ question: DsaQuestion; phase: string }>;
  /** Tags used by exactly one question: candidates for merging away. */
  singletonTags: DsaTagUse[];
  /** Difficulty label disagreeing with the time estimate. */
  timeMismatches: Array<{ question: DsaQuestion; phase: string }>;
  /** Slugs whose LeetCode URL does not match, i.e. a rename went unnoticed. */
  urlMismatches: Array<{ question: DsaQuestion; phase: string }>;
}

export function auditBank(): DsaAudit {
  const orphans: DsaAudit["orphans"] = [];
  const timeMismatches: DsaAudit["timeMismatches"] = [];
  const urlMismatches: DsaAudit["urlMismatches"] = [];

  for (const phase of dsaPhases()) {
    for (const question of phase.questions) {
      const depended = phase.questions.some((other) => other.prerequisites.includes(question.slug));
      if (question.prerequisites.length === 0 && !depended) {
        orphans.push({ question, phase: phase.phase });
      }
      const slow = question.difficulty === "easy" && question.expectedTimeMinutes >= 25;
      const fast = question.difficulty === "hard" && question.expectedTimeMinutes <= 25;
      if (slow || fast) timeMismatches.push({ question, phase: phase.phase });
      if (question.externalUrl !== `https://leetcode.com/problems/${question.slug}/`) {
        urlMismatches.push({ question, phase: phase.phase });
      }
    }
  }

  return {
    orphans,
    singletonTags: subPatternIndex().filter((entry) => entry.questions.length === 1),
    timeMismatches,
    urlMismatches
  };
}
