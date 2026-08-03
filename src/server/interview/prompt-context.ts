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
    "Warm but not soft. You may acknowledge an answer in three words before following up. Soften a challenge by framing it as curiosity.",
  realistic:
    "Neutral and direct. No acknowledgement, no encouragement. Ask the next thing as though you have four more candidates today.",
  brutal:
    "Blunt. Name the gap in the answer explicitly before asking. No acknowledgement, no softening, no hedging. Keep it short."
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

export function describeSetup(setup: InterviewSetup): string {
  return `${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}`;
}
