import type { CandidatePracticeEvidence } from "@/lib/practice/practice-evidence";
import type { CandidateSkillSignal } from "@/lib/preparation/preparation-onboarding";
import type { DsaChapter, FrontendDsaPlan, PlanQuestion } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile, Level, Role } from "@/lib/shared/types";
import type { DsaBlockAssessmentReport } from "@/lib/dsa/block-assessment-report";

export type DsaPathTier = "foundations" | "building" | "advanced" | "diagnostic";

export interface DsaRecommendation {
  tier: DsaPathTier;
  source: "assessment" | "performance";
  targetLabel: string;
  focusChapterId: string;
  focusLabel: string;
  strengthLabel: string | null;
  blockTitle: string;
  rationale: string;
  questions: PlanQuestion[];
  minutes: number;
  mix: { easy: number; medium: number; hard: number };
  estimatedPathQuestions: number;
  availableQuestions: number;
  /** Immutable compact assessment evidence that selected this block, if any. */
  assessmentEvidence?: {
    reportVersion: number;
    overall: number;
    metrics: Record<string, number>;
    weakPatterns: string[];
    strongPatterns: string[];
  };
}

interface RecommendationInput {
  plan: FrontendDsaPlan;
  profile: Pick<CandidateProfile, "targetRole" | "level" | "targetDate" | "preparationOnboarding">;
  evidence: CandidatePracticeEvidence | null;
  statuses?: Record<string, string>;
  blockQuestionSlugs?: string[];
  retainCompletedQuestions?: boolean;
  now?: number;
  assessmentReport?: DsaBlockAssessmentReport | null;
}

const ROLE_LABELS: Record<Role, string> = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Full Stack",
  data: "Data",
  "ai-ml": "AI/ML",
  pm: "Product"
};

const LEVEL_LABELS: Record<Level, string> = {
  fresher: "entry-level",
  "0-2": "early-career",
  "3-5": "mid-level",
  "5-plus": "senior"
};

const ROLE_CHAPTER_WEIGHT: Record<Role, Partial<Record<string, number>>> = {
  backend: {
    "arrays-hashing": 18,
    "binary-search": 12,
    trees: 14,
    "graphs-light": 12,
    heaps: 8
  },
  frontend: {
    "arrays-hashing": 18,
    "two-pointers": 10,
    "sliding-window": 12,
    trees: 10,
    "stack-queue": 8
  },
  fullstack: {
    "arrays-hashing": 18,
    "binary-search": 10,
    trees: 12,
    "sliding-window": 10,
    "graphs-light": 8
  },
  data: {
    "arrays-hashing": 18,
    "binary-search": 12,
    heaps: 12,
    "intervals-matrix": 10,
    "graphs-light": 8
  },
  "ai-ml": {
    "arrays-hashing": 14,
    heaps: 12,
    "dp-basics": 14,
    "graphs-light": 12,
    "intervals-matrix": 8
  },
  pm: { "arrays-hashing": 10, "binary-search": 6, "intervals-matrix": 6 }
};

const TOPIC_CHAPTER: Record<string, string> = {
  "arrays & hashing": "arrays-hashing",
  "search patterns": "binary-search",
  trees: "trees",
  "sliding window": "sliding-window",
  "dynamic programming": "dp-basics"
};

const ROLE_PATH_FACTOR: Record<Role, number> = {
  backend: 1,
  frontend: 0.85,
  fullstack: 1,
  data: 0.75,
  "ai-ml": 0.65,
  pm: 0.25
};

/**
 * Produces the next small DSA block from target context, the onboarding pulse,
 * and verified Practice evidence. It is deliberately deterministic: identical
 * evidence always yields the same block, while a new solve naturally changes it.
 */
export function buildDsaRecommendation(input: RecommendationInput): DsaRecommendation | null {
  const questions = input.plan.chapters.flatMap((chapter) => chapter.questions);
  if (!questions.length) return null;

  const statuses = input.statuses ?? {};
  const pending = questions.filter((question) => statuses[question.slug] !== "COMPLETED");
  if (!pending.length && questions.every((question) => statuses[question.slug] === "COMPLETED")) {
    return null;
  }
  const frozenQuestions = (input.blockQuestionSlugs ?? []).flatMap((slug) => {
    const question = questions.find((candidate) => candidate.slug === slug);
    return question ? [question] : [];
  });
  const available = input.retainCompletedQuestions
    ? questions
    : pending.length
      ? pending
      : questions;
  const role = input.profile.targetRole ?? "fullstack";
  const level = input.profile.level;
  const dsaSignal = input.profile.preparationOnboarding.skillProfile?.signals.find(
    (signal) => signal.areaId === "dsa"
  );
  const tier = assessmentTier(input.assessmentReport) ?? recommendationTier(dsaSignal?.startingState, input.evidence);
  const source = input.assessmentReport ? "assessment" : input.evidence?.verifiedQuestionCount ? "performance" : "assessment";
  const chapterScores = input.plan.chapters
    .map((chapter, index) => ({
      chapter,
      score: chapterPriority(chapter, index, role, dsaSignal, input.evidence, statuses, input.assessmentReport)
    }))
    .sort(
      (left, right) => right.score - left.score || left.chapter.id.localeCompare(right.chapter.id)
    );
  const suggestedFocus = chapterScores[0]?.chapter ?? input.plan.chapters[0]!;
  const focus = frozenQuestions[0]
    ? (chapterForQuestion(input.plan.chapters, frozenQuestions[0].slug) ?? suggestedFocus)
    : suggestedFocus;
  const candidateChapterIds = new Set(chapterScores.slice(0, 4).map(({ chapter }) => chapter.id));
  const candidateQuestions = available.filter((question) =>
    candidateChapterIds.has(chapterForQuestion(input.plan.chapters, question.slug)?.id ?? "")
  );
  const blockSize = Math.min(blockSizeForTier(tier), available.length);
  const selected = frozenQuestions.length
    ? frozenQuestions
    : selectBlock(
        candidateQuestions.length >= blockSize ? candidateQuestions : available,
        chapterScores.map(({ chapter }) => chapter.id),
        input.plan.chapters,
        difficultySequence(tier),
        blockSize,
        statuses
      );
  const strengthLabel = strongestLabel(dsaSignal, input.evidence, input.plan.chapters);
  const estimatedPathQuestions = pathSize(
    tier,
    role,
    level,
    input.profile.targetDate,
    input.now ?? Date.now(),
    questions.length,
    selected.length
  );

  return {
    tier,
    source,
    targetLabel: `${ROLE_LABELS[role]} ${level ? LEVEL_LABELS[level] : "interview"}`,
    focusChapterId: focus.id,
    focusLabel: focus.title,
    strengthLabel,
    blockTitle: focus.title,
    rationale: rationaleFor(tier, focus.title, role, level),
    questions: selected,
    minutes: selected.reduce((total, question) => total + question.expectedTimeMinutes, 0),
    mix: difficultyCounts(selected),
    estimatedPathQuestions,
    availableQuestions: questions.length,
    ...(input.assessmentReport
      ? {
          assessmentEvidence: {
            reportVersion: input.assessmentReport.reportVersion,
            overall: input.assessmentReport.overall,
            metrics: input.assessmentReport.metrics,
            weakPatterns: input.assessmentReport.nextRecommendationSignals.weakPatterns,
            strongPatterns: input.assessmentReport.nextRecommendationSignals.strongPatterns
          }
        }
      : {})
  };
}

function recommendationTier(
  startingState: string | undefined,
  evidence: CandidatePracticeEvidence | null
): DsaPathTier {
  const problemSolving = evidence?.skills.find((skill) => skill.skillKey === "problem-solving");
  if (problemSolving && evidence) {
    if (problemSolving.score < 60) return "foundations";
    if (
      problemSolving.score >= 82 &&
      problemSolving.confidence >= 0.7 &&
      evidence.verifiedQuestionCount >= 4
    ) {
      return "advanced";
    }
    return "building";
  }
  if (startingState === "needs-foundations") return "foundations";
  if (startingState === "experienced-active") return "advanced";
  if (startingState === "experienced-rusty" || startingState === "some-familiarity") {
    return "building";
  }
  return "diagnostic";
}

function chapterPriority(
  chapter: DsaChapter,
  index: number,
  role: Role,
  signal: CandidateSkillSignal | undefined,
  evidence: CandidatePracticeEvidence | null,
  statuses: Record<string, string>,
  assessmentReport?: DsaBlockAssessmentReport | null
): number {
  let score = 120 - index * 3 + (ROLE_CHAPTER_WEIGHT[role][chapter.id] ?? 0);
  for (const topic of signal?.topics ?? []) {
    if (TOPIC_CHAPTER[topic.label.trim().toLowerCase()] !== chapter.id) continue;
    if (topic.familiarity === "needs-refresh") score += 55;
    else if (topic.familiarity === "unknown") score += 25;
    else if (topic.familiarity === "familiar") score -= 18;
  }

  const patternScores = evidence?.skills.filter(
    (skill) =>
      skill.skillKey.startsWith("dsa-pattern:") &&
      chapter.questions.some(
        (question) => question.primaryPattern === skill.skillKey.slice("dsa-pattern:".length)
      )
  );
  if (patternScores?.length) {
    const weightedScore =
      patternScores.reduce((total, skill) => total + skill.score * skill.confidence, 0) /
      patternScores.reduce((total, skill) => total + skill.confidence, 0);
    score += (82 - weightedScore) * 1.4;
  }
  if (chapter.questions.some((question) => statuses[question.slug] === "IN_PROGRESS")) score += 80;
  if (assessmentReport) {
    if (assessmentReport.nextRecommendationSignals.weakPatterns.some((pattern) =>
      chapter.questions.some((question) => question.primaryPattern === pattern)
    )) score += 90;
    if (assessmentReport.nextRecommendationSignals.strongPatterns.some((pattern) =>
      chapter.questions.some((question) => question.primaryPattern === pattern)
    )) score -= 200;
    if (assessmentReport.metrics["correctness-edge-cases"] < 50) score += 15;
  }
  const remaining = chapter.questions.filter(
    (question) => statuses[question.slug] !== "COMPLETED"
  ).length;
  if (remaining === 0) score -= 10_000;
  else score -= ((chapter.questions.length - remaining) / chapter.questions.length) * 45;
  return score;
}

/** Assessment complements, never overwrites, verified-practice evidence. */
function assessmentTier(report: DsaBlockAssessmentReport | null | undefined): DsaPathTier | null {
  if (!report) return null;
  if (report.metrics["correctness-edge-cases"] < 50 || report.overall < 50) return "foundations";
  if (report.overall >= 80 && report.metrics["correctness-edge-cases"] >= 75) return "advanced";
  return "building";
}

function selectBlock(
  pool: PlanQuestion[],
  chapterOrder: string[],
  chapters: DsaChapter[],
  desiredDifficulties: PlanQuestion["difficulty"][],
  blockSize: number,
  statuses: Record<string, string>
): PlanQuestion[] {
  const chapterRank = new Map(chapterOrder.map((id, index) => [id, index]));
  const chapterByQuestion = new Map(
    chapters.flatMap((chapter) => chapter.questions.map((question) => [question.slug, chapter.id]))
  );
  const ordered = pool.slice().sort((left, right) => {
    const leftOpen = statuses[left.slug] === "IN_PROGRESS" ? 0 : 1;
    const rightOpen = statuses[right.slug] === "IN_PROGRESS" ? 0 : 1;
    return (
      leftOpen - rightOpen ||
      (chapterRank.get(chapterByQuestion.get(left.slug) ?? "") ?? 99) -
        (chapterRank.get(chapterByQuestion.get(right.slug) ?? "") ?? 99) ||
      left.phaseNumber - right.phaseNumber ||
      left.recommendedOrder - right.recommendedOrder
    );
  });
  const selected: PlanQuestion[] = [];
  const used = new Set<string>();
  for (const difficulty of desiredDifficulties) {
    const match = ordered.find(
      (question) => !used.has(question.slug) && question.difficulty === difficulty
    );
    if (!match) continue;
    used.add(match.slug);
    selected.push(match);
  }
  for (const question of ordered) {
    if (selected.length >= blockSize) break;
    if (used.has(question.slug)) continue;
    used.add(question.slug);
    selected.push(question);
  }
  return selected.slice(0, blockSize);
}

function difficultySequence(tier: DsaPathTier): PlanQuestion["difficulty"][] {
  if (tier === "foundations") {
    return ["easy", "easy", "medium", "easy", "medium", "easy", "medium", "easy"];
  }
  if (tier === "advanced") {
    return ["easy", "medium", "medium", "hard", "medium", "hard", "medium"];
  }
  if (tier === "building") {
    return ["easy", "medium", "medium", "easy", "medium", "hard", "medium", "medium"];
  }
  return ["easy", "medium", "easy", "medium", "medium", "hard"];
}

function blockSizeForTier(tier: DsaPathTier): number {
  if (tier === "advanced") return 7;
  if (tier === "diagnostic") return 6;
  return 8;
}

function pathSize(
  tier: DsaPathTier,
  role: Role,
  level: Level | null,
  targetDate: string | null,
  now: number,
  available: number,
  minimum: number
): number {
  let size =
    tier === "foundations" ? available : tier === "building" ? 88 : tier === "advanced" ? 34 : 54;
  size *= ROLE_PATH_FACTOR[role];
  if (tier !== "foundations" && level === "5-plus") size *= 0.82;
  else if (tier === "building" && level === "3-5") size *= 0.9;
  const days = targetDate ? (new Date(targetDate).getTime() - now) / 86_400_000 : null;
  if (days !== null && Number.isFinite(days)) {
    if (days <= 14) size *= 0.65;
    else if (days <= 30) size *= 0.8;
  }
  return Math.max(minimum, Math.min(available, Math.round(size)));
}

function strongestLabel(
  signal: { topics?: Array<{ label: string; familiarity: string }> } | undefined,
  evidence: CandidatePracticeEvidence | null,
  chapters: DsaChapter[]
): string | null {
  const strongest = evidence?.skills
    .filter((skill) => skill.skillKey.startsWith("dsa-pattern:"))
    .sort((left, right) => right.score - left.score)[0];
  if (strongest && strongest.score >= 70) {
    const pattern = strongest.skillKey.slice("dsa-pattern:".length);
    return (
      chapters.find((chapter) =>
        chapter.questions.some((question) => question.primaryPattern === pattern)
      )?.title ?? formatPattern(pattern)
    );
  }
  return signal?.topics?.find((topic) => topic.familiarity === "familiar")?.label ?? null;
}

function rationaleFor(tier: DsaPathTier, focus: string, role: Role, level: Level | null): string {
  const levelCopy = level ? `${LEVEL_LABELS[level]} ${ROLE_LABELS[role]}` : ROLE_LABELS[role];
  if (tier === "advanced") {
    return `${focus} is worth pressure-testing at ${levelCopy} depth before moving on.`;
  }
  if (tier === "foundations") {
    return `${focus} builds the lookup and pattern-recognition skills used throughout coding interviews.`;
  }
  if (tier === "building") {
    return `${focus} is the clearest next step toward your ${levelCopy} interview bar.`;
  }
  return `${focus} gives Trailgrad the clearest signal for setting your starting level.`;
}

function difficultyCounts(questions: PlanQuestion[]) {
  return questions.reduce(
    (counts, question) => {
      counts[question.difficulty] += 1;
      return counts;
    },
    { easy: 0, medium: 0, hard: 0 }
  );
}

function chapterForQuestion(chapters: DsaChapter[], slug: string): DsaChapter | null {
  return (
    chapters.find((chapter) => chapter.questions.some((question) => question.slug === slug)) ?? null
  );
}

function formatPattern(pattern: string): string {
  return pattern
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
