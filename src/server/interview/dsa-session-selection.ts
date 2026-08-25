import type { DsaDifficulty } from "@/lib/dsa/dsa";
import {
  PROBLEM_SOLVING_SKILL_KEY,
  type CandidatePerformanceProfile
} from "@/lib/interviews/performance-profile";

export interface DsaSelectionCandidate {
  slug: string;
  title: string;
  difficulty: string;
  primaryPattern: string;
}

export type DsaDifficultyBand = "foundational" | "intermediate" | "advanced";

/** Uses demonstrated DSA ability only after it has enough confidence to steer a round. */
export function dsaDifficultyBand(
  performance: CandidatePerformanceProfile | null
): DsaDifficultyBand | null {
  const signal = performance?.skills.find((skill) => skill.skillKey === PROBLEM_SOLVING_SKILL_KEY);
  if (!signal || signal.confidence < 0.45) return null;
  if (signal.score < 50) return "foundational";
  if (signal.score >= 82) return "advanced";
  return "intermediate";
}

/**
 * Keeps the existing solved-first behavior while preferring a difficulty band
 * based on prior DSA evidence. Questions are still shuffled inside each band.
 */
export function selectDsaInterviewQuestions<T extends DsaSelectionCandidate>({
  solved,
  fallback,
  performance,
  count,
  random = Math.random
}: {
  solved: T[];
  fallback: T[];
  performance: CandidatePerformanceProfile | null;
  count: number;
  random?: () => number;
}): T[] {
  const band = dsaDifficultyBand(performance);
  const ordered = band
    ? [
        ...orderByDifficulty(solved, difficultyOrder(band), random),
        ...orderByDifficulty(fallback, difficultyOrder(band), random)
      ]
    : [...shuffle(solved, random), ...shuffle(fallback, random)];
  const seen = new Set<string>();
  return ordered
    .filter((item) => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    })
    .slice(0, count);
}

function difficultyOrder(band: DsaDifficultyBand): DsaDifficulty[] {
  if (band === "foundational") return ["easy", "medium", "hard"];
  if (band === "advanced") return ["hard", "medium", "easy"];
  return ["medium", "easy", "hard"];
}

function orderByDifficulty<T extends DsaSelectionCandidate>(
  values: T[],
  order: DsaDifficulty[],
  random: () => number
): T[] {
  const normalized = new Map<DsaDifficulty, T[]>([
    ["easy", []],
    ["medium", []],
    ["hard", []]
  ]);
  const unknown: T[] = [];

  for (const value of values) {
    const difficulty = value.difficulty.toLowerCase() as DsaDifficulty;
    const bucket = normalized.get(difficulty);
    if (bucket) bucket.push(value);
    else unknown.push(value);
  }

  return [
    ...order.flatMap((difficulty) => shuffle(normalized.get(difficulty) ?? [], random)),
    ...shuffle(unknown, random)
  ];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}
