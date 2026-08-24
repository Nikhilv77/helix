import browserOs from "@/data/fundamentals/browser-os.json";
import databases from "@/data/fundamentals/databases.json";
import networking from "@/data/fundamentals/networking.json";
import systems from "@/data/fundamentals/systems.json";
import type { Level } from "@/lib/shared/types";

/**
 * The computer-fundamentals bank.
 *
 * Unlike the resume round, none of this is generated: fundamentals are the same
 * for every candidate, so the questions are authored once and read from disk.
 * A round therefore costs nothing to plan, and its multiple choice stage costs
 * nothing to grade.
 */

export type FundamentalsArea = "networking" | "browser-os" | "databases" | "systems";
export type FundamentalsFormat = "mcq" | "explain" | "scenario";

export interface FundamentalsConcept {
  title: string;
  summary: string;
  points: string[];
}

export interface FundamentalsQuestion {
  slug: string;
  area: FundamentalsArea;
  areaTitle: string;
  format: FundamentalsFormat;
  /** Levels this question is a fair ask for. */
  levels: Level[];
  prompt: string;
  /** Four options for `mcq`, empty otherwise. */
  options: string[];
  /** Index into `options`. Graded on the server, never sent to the browser. */
  answerIndex: number;
  explanation: string;
  /** What a strong spoken answer contains. Empty for `mcq`. */
  expects: string[];
  probeIfMissing: string;
  /** Shown once the question has been answered, as the teaching moment. */
  concept: FundamentalsConcept;
}

interface RawArea {
  area: string;
  title: string;
  whyItMatters: string;
  questions: Array<Record<string, unknown>>;
}

const AREA_FILES = [networking, browserOs, databases, systems] as unknown as RawArea[];

let cache: FundamentalsQuestion[] | null = null;

export function fundamentalsQuestions(): FundamentalsQuestion[] {
  if (cache) return cache;

  cache = AREA_FILES.flatMap((file) =>
    file.questions.map((raw) => ({
      slug: String(raw.slug),
      area: file.area as FundamentalsArea,
      areaTitle: file.title,
      format: raw.format as FundamentalsFormat,
      levels: (raw.levels as Level[] | undefined) ?? [],
      prompt: String(raw.prompt),
      options: (raw.options as string[] | undefined) ?? [],
      answerIndex: typeof raw.answerIndex === "number" ? raw.answerIndex : 0,
      explanation: String(raw.explanation ?? ""),
      expects: (raw.expects as string[] | undefined) ?? [],
      probeIfMissing: String(raw.probeIfMissing ?? ""),
      concept: raw.concept as FundamentalsConcept
    }))
  );

  return cache;
}

export function findFundamentalsQuestion(slug: string): FundamentalsQuestion | null {
  return fundamentalsQuestions().find((question) => question.slug === slug) ?? null;
}

/**
 * Questions a candidate at this level should be asked. A question with no
 * declared levels is fair game for everyone, and an unknown level falls back to
 * the whole bank rather than to nothing.
 */
export function questionsForLevel(level: Level | null): FundamentalsQuestion[] {
  const all = fundamentalsQuestions();
  if (!level) return all;

  const matching = all.filter(
    (question) => question.levels.length === 0 || question.levels.includes(level)
  );
  return matching.length ? matching : all;
}
