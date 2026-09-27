import {
  RESUME_ROAST_DIMENSIONS,
  RESUME_ROAST_SCORE_MEANINGS,
  type ResumeRoastBand,
  type ResumeRoastDimensionKey,
  type ResumeRoastScorecard,
  type ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";

/**
 * Bump whenever anchors, weights or gates change. Saved scorecards are only
 * reused for a re-roast when their version matches, so a change re-scores.
 */
export const RESUME_ROAST_RUBRIC_VERSION = "rubric-v1";

/** Whole percentages summing to 100, so the arithmetic below stays exact. */
type Weights = Record<ResumeRoastDimensionKey, number>;

/**
 * How much each area moves the overall score. A recruiter reads a new-grad
 * resume for technical promise, a senior one for impact, and a staff or
 * manager one for scope, so the weights follow the selected level.
 */
const WEIGHTS: Record<"default" | "early-career" | "leadership", Weights> = {
  default: { roleFit: 30, impact: 25, ownership: 20, technical: 15, readability: 10 },
  "early-career": { roleFit: 25, impact: 15, ownership: 15, technical: 30, readability: 15 },
  leadership: { roleFit: 25, impact: 25, ownership: 30, technical: 12, readability: 8 }
};

export function resumeRoastWeights(target: ResumeRoastTarget): Weights {
  if (target.level === "internship-or-new-grad" || target.role === "internship-or-new-grad") {
    return WEIGHTS["early-career"];
  }
  if (
    target.level === "staff-or-principal" ||
    target.level === "manager" ||
    target.role === "engineering-manager"
  ) {
    return WEIGHTS.leadership;
  }
  return WEIGHTS.default;
}

const SENIOR_LEVELS = new Set<ResumeRoastTarget["level"]>(["senior", "staff-or-principal", "manager"]);

/**
 * Turns five 1-5 judgements into the 1-10 number a person would say out loud.
 * Scoring happens in code so the same judgements always give the same score.
 *
 * - All 3s (the typical "fine" resume) lands on 6; all 4s on 8; only all 5s
 *   reach 10.
 * - Gates mirror how screening works: a resume for the wrong job, or one with
 *   no sign of the scope a senior role needs, doesn't get shortlisted however
 *   tidy it is.
 */
export function computeResumeRoastOverall(
  scores: Record<ResumeRoastDimensionKey, number>,
  target: ResumeRoastTarget
): number {
  const weights = resumeRoastWeights(target);
  // weightedSum is 100x the weighted 1-5 average; this maps 1-5 onto 1-10.
  const weightedSum = RESUME_ROAST_DIMENSIONS.reduce(
    (total, { key }) => total + weights[key] * scores[key],
    0
  );
  let overall = Math.round(1 + ((weightedSum - 100) * 9) / 400);
  if (scores.roleFit <= 1) overall = Math.min(overall, 3);
  else if (scores.roleFit === 2) overall = Math.min(overall, 5);
  if (scores.ownership <= 1 && SENIOR_LEVELS.has(target.level)) overall = Math.min(overall, 5);
  // A 10 means there is nothing left to fix anywhere.
  if (RESUME_ROAST_DIMENSIONS.some(({ key }) => scores[key] < 5)) overall = Math.min(overall, 9);
  return Math.max(1, Math.min(10, overall));
}

export function resumeRoastBandFor(overall: number): ResumeRoastBand {
  if (overall >= 10) return "difficult-to-roast";
  if (overall >= 8) return "strong";
  if (overall >= 6) return "solid";
  if (overall >= 4) return "has-potential";
  return "needs-serious-work";
}

export function resumeRoastScorecard(
  dimensions: ResumeRoastScorecard["dimensions"],
  target: ResumeRoastTarget
): ResumeRoastScorecard {
  const scores = Object.fromEntries(
    RESUME_ROAST_DIMENSIONS.map(({ key }) => [key, dimensions[key].score])
  ) as Record<ResumeRoastDimensionKey, number>;
  return {
    rubricVersion: RESUME_ROAST_RUBRIC_VERSION,
    overall: computeResumeRoastOverall(scores, target),
    dimensions
  };
}

/**
 * Anchored levels written as a recruiter's own shorthand. Each level says what
 * is on the page, never how the model feels about it, so two readers of the
 * same resume land on the same number.
 */
export const RESUME_ROAST_RUBRIC_ANCHORS: Record<ResumeRoastDimensionKey, readonly string[]> = {
  roleFit: [
    "5: Every recent role and project is squarely this job. Title, stack and work match what this team hires for.",
    "4: Clearly this kind of engineer. One or two pieces are off-target or need connecting.",
    "3: Relevant, but the reader has to connect the dots. A good chunk of the work is adjacent.",
    "2: Mostly a different kind of role. The target work shows up in one project or the skills list.",
    "1: Nothing on the page is this job."
  ],
  impact: [
    "5: Most bullets say what changed and by how much (users, speed, money, time saved, reliability), and the numbers are believable.",
    "4: Several bullets show real outcomes, some with numbers. A few are still just duties.",
    "3: A couple of outcomes. Most bullets describe tasks.",
    "2: Duties only. You can't tell what got better.",
    "1: No outcomes at all, or claims nobody would believe."
  ],
  ownership: [
    "5: Shows the scope this level needs. New grad: projects they drove themselves. Junior/mid: features shipped end to end. Senior: systems owned end to end and decisions made. Staff: direction across teams. Manager: hiring, growing and running a team.",
    "4: Mostly there. The biggest-scope work needs to be said more clearly.",
    "3: A solid contributor, but little proof of the scope this level expects.",
    "2: The scope looks one level below the target.",
    "1: The scope is well below the target, or it's unclear what they owned anywhere."
  ],
  technical: [
    "5: The right stack for this role, used in bullets with real depth: trade-offs, scale, hard problems solved.",
    "4: The right stack, used in real work. Depth is implied more than shown.",
    "3: Relevant tools are listed, but the bullets rarely show how they were used.",
    "2: The stack is mostly off-target, or only appears in the skills list.",
    "1: No believable technical evidence for this role."
  ],
  readability: [
    "5: Short, specific bullets. The best work is near the top. No filler.",
    "4: Easy to scan, with a few long or vague bullets.",
    "3: Readable but padded: long bullets, the same opening verb again and again, or a crowded skills list.",
    "2: Hard to skim. The good stuff is buried.",
    "1: A wall of text."
  ]
};

export function resumeRoastRubricText(target: ResumeRoastTarget): string {
  const weights = resumeRoastWeights(target);
  const areas = RESUME_ROAST_DIMENSIONS.map(
    ({ key, label, question }) =>
      `${label} (${key}, ${weights[key]}% of the score): ${question}\n${RESUME_ROAST_RUBRIC_ANCHORS[key]
        .map((anchor) => `  ${anchor}`)
        .join("\n")}`
  ).join("\n\n");
  const meanings = RESUME_ROAST_SCORE_MEANINGS.map(
    (meaning) => `  ${meaning.min}+ ${meaning.label}: ${meaning.description}`
  ).join("\n");
  return `${areas}\n\nThe overall /10 is calculated from your five scores. For reference, it means:\n${meanings}`;
}
