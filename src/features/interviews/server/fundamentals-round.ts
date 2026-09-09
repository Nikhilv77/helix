import {
  fundamentalsQuestions,
  questionsForLevel,
  type FundamentalsArea,
  type FundamentalsFormat,
  type FundamentalsQuestion
} from "@/lib/fundamentals/fundamentals";
import type { Level } from "@/lib/shared/types";
import type { InterviewSetup, PlannedQuestion } from "./types";

export const RAPID_QUESTIONS = 5;
export const EXPLAIN_QUESTIONS = 3;
export const SCENARIO_QUESTIONS = 1;
export const FUNDAMENTALS_QUESTION_COUNT =
  RAPID_QUESTIONS + EXPLAIN_QUESTIONS + SCENARIO_QUESTIONS;

/** Weighted for a frontend candidate: the network is where their bugs live. */
const AREA_PRIORITY: FundamentalsArea[] = ["networking", "browser-os", "databases", "systems"];

/**
 * Assembles a fundamentals round from the authored bank.
 *
 * Nothing here is generated. The questions, their answers and their concept
 * cards are all on disk, so a round costs no model call to plan and its rapid
 * stage costs none to grade. Only the spoken stages reach the decider.
 */
export function buildFundamentalsPlan(
  level: Level | null,
  options: { shuffle?: <T>(items: T[]) => T[] } = {}
): PlannedQuestion[] {
  const shuffle = options.shuffle ?? shuffleInPlace;
  const levelPool = questionsForLevel(level);
  const fullPool = fundamentalsQuestions();
  const used = new Set<string>();

  /**
   * Prefers questions written for this level, but never lets a thin level cut a
   * stage short — a round with no spoken questions is not a round.
   */
  const stagePool = (format: FundamentalsFormat) => {
    const preferred = levelPool.filter((question) => question.format === format);
    const rest = fullPool.filter(
      (question) => question.format === format && !preferred.includes(question)
    );
    return [...shuffle(preferred), ...shuffle(rest)];
  };

  const rapid = spreadAcrossAreas(stagePool("mcq"), RAPID_QUESTIONS, used);
  const explain = spreadAcrossAreas(stagePool("explain"), EXPLAIN_QUESTIONS, used);
  const scenario = stagePool("scenario")
    .filter((question) => !used.has(question.slug))
    .slice(0, SCENARIO_QUESTIONS);

  return [
    ...rapid.map((question) => toPlanned(question, "rapid")),
    ...explain.map((question) => toPlanned(question, "explain")),
    ...scenario.map((question) => toPlanned(question, "scenario"))
  ];
}

/**
 * Takes at most one question per area before allowing a second, so a five
 * question stage covers the ground instead of asking about DNS five times.
 */
function spreadAcrossAreas(
  candidates: FundamentalsQuestion[],
  take: number,
  used: Set<string>
): FundamentalsQuestion[] {
  const picked: FundamentalsQuestion[] = [];
  const perArea = new Map<FundamentalsArea, number>();

  for (let round = 0; picked.length < take && round < 4; round += 1) {
    for (const area of AREA_PRIORITY) {
      if (picked.length >= take) break;
      if ((perArea.get(area) ?? 0) > round) continue;

      const question = candidates.find(
        (candidate) => candidate.area === area && !used.has(candidate.slug)
      );
      if (!question) continue;

      picked.push(question);
      used.add(question.slug);
      perArea.set(area, (perArea.get(area) ?? 0) + 1);
    }
  }

  // A thin bank for this level should still produce a full stage.
  for (const question of candidates) {
    if (picked.length >= take) break;
    if (used.has(question.slug)) continue;
    picked.push(question);
    used.add(question.slug);
  }

  return picked;
}

function toPlanned(
  question: FundamentalsQuestion,
  stage: "rapid" | "explain" | "scenario"
): PlannedQuestion {
  const isMultipleChoice = question.format === "mcq" && question.options.length >= 2;

  return {
    text: question.prompt,
    evidenceAnchor: question.areaTitle,
    kind: isMultipleChoice ? "mcq" : "conversation",
    stage,
    skill: question.areaTitle,
    language: "",
    codeTask: "",
    codeSnippet: "",
    options: isMultipleChoice ? question.options : undefined,
    answerIndex: isMultipleChoice ? question.answerIndex : undefined,
    explanation: question.explanation || undefined,
    answerFormat: isMultipleChoice ? "mcq" : "spoken",
    competency: question.areaTitle,
    intent:
      stage === "scenario"
        ? "Test whether the candidate can diagnose from a symptom rather than recite a definition."
        : `Establish whether the candidate understands the mechanism behind ${question.areaTitle.toLowerCase()}.`,
    mustHit: question.expects.length
      ? question.expects.slice(0, 3)
      : ["the mechanism, not the label", "why it behaves that way"],
    probeIfMissing: question.probeIfMissing || "What is actually happening underneath that?",
    /** Ties the planned question back to its concept card. */
    sourceSlug: question.slug
  };
}

export function fundamentalsRoundContext(level: Level | null): string {
  return [
    "This is a computer fundamentals round in three stages: quick checks across areas, then the mechanism behind them, then diagnosing something real.",
    "The candidate is a frontend engineer, so weight networking and browser behaviour over database internals.",
    "Test understanding, not vocabulary. A correct definition with no mechanism behind it is not a strong answer.",
    level ? `Candidate level: ${level}.` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1200);
}

export function isFundamentalsRoundSetup(setup: InterviewSetup): boolean {
  return setup.fundamentalsRound === true;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
  return items;
}
