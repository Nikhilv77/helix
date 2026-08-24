import { Intensity, InterviewSetup, Level, Role, RoundType } from "./types";

const ROLE_LABELS: Record<Role, string> = {
  backend: "backend engineer",
  frontend: "frontend engineer",
  fullstack: "full-stack engineer",
  data: "data engineer",
  "ai-ml": "AI/ML engineer",
  pm: "product manager"
};

const LEVEL_LABELS: Record<Level, string> = {
  fresher: "fresher with no professional experience",
  "0-2": "engineer with 0-2 years of experience",
  "3-5": "engineer with 3-5 years of experience",
  "5-plus": "senior engineer with 5+ years of experience"
};

const ROUND_LABELS: Record<RoundType, string> = {
  behavioral: "behavioral",
  technical: "technical deep-dive",
  "hiring-manager": "hiring manager"
};

/** Intensity controls warmth and phrasing, never difficulty. */
const INTENSITY_RULES: Record<Intensity, string> = {
  friendly:
    "Warm, attentive, and concise. Use brief natural acknowledgements, then ask a precise follow-up. Frame skepticism as genuine curiosity.",
  realistic:
    "Calm, attentive, and direct. Use occasional neutral acknowledgements, without praise or scripted enthusiasm.",
  brutal:
    "Demanding but professional. Name the exact unsupported assumption or missing evidence without hostility, sarcasm, or intimidation."
};

/** Level controls what gets pressed on. */
const LEVEL_FOCUS: Record<Level, string> = {
  fresher: "Press on reasoning and what they learned. Do not press for scale or headcount.",
  "0-2": "Press on what they personally did and why, not on team-level outcomes.",
  "3-5": "Press on trade-offs, ownership, and what the numbers actually were.",
  "5-plus":
    "Press hard on ownership versus team credit, on trade-offs they rejected, and on scale figures."
};

export function describeRole(role: Role): string {
  return ROLE_LABELS[role];
}

export function describeLevel(level: Level): string {
  return LEVEL_LABELS[level];
}

export function describeRound(roundType: RoundType): string {
  return ROUND_LABELS[roundType];
}

export function intensityRules(intensity: Intensity): string {
  return INTENSITY_RULES[intensity];
}

export function levelFocus(level: Level): string {
  return LEVEL_FOCUS[level];
}

export function isResumeRound(setup: InterviewSetup): boolean {
  return (
    setup.templateId === "resume-behavioral-defense" ||
    setup.templateTitle?.toLowerCase().includes("resume") === true
  );
}

export function describeSetup(setup: InterviewSetup): string {
  return `${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}`;
}

/**
 * A DSA round is planned from a fixed list of practice problems rather than
 * from the candidate's resume, so it needs its own prompt and must never have
 * the generic role code exercise substituted into it.
 */
export function isDsaRound(setup: InterviewSetup): boolean {
  return Boolean(setup.dsaQuestionSlugs?.length);
}
