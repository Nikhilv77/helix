import type { Intensity, Role, RoundType } from "./types";

export type TemplateCategory = "behavioral" | "technical" | "leadership";

export interface InterviewTemplate {
  id: string;
  title: string;
  /** One line the candidate reads before committing. */
  blurb: string;
  category: TemplateCategory;
  roundType: RoundType;
  intensity: Intensity;
  minutes: number;
  /**
   * The whole round. The planner is told to serve these and nothing else, so
   * every line here should be answerable out loud from real experience.
   */
  agenda: string[];
  /** Roles this round is written for. Empty means every role. */
  roles?: Role[];
}

export const INTERVIEW_TEMPLATES: InterviewTemplate[] = [
  {
    id: "defend-projects",
    title: "Defend your projects",
    blurb: "Your strongest project, taken apart decision by decision.",
    category: "technical",
    roundType: "technical",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Establish what the project actually was and what the candidate personally built",
      "Press on one consequential design decision and the alternative they rejected",
      "Find the part that broke, was slow, or had to be rewritten",
      "Ask what they would build differently now and why"
    ]
  },
  {
    id: "explain-your-role",
    title: "Explain your role",
    blurb: "What you owned, versus what your team owned.",
    category: "behavioral",
    roundType: "behavioral",
    intensity: "realistic",
    minutes: 10,
    agenda: [
      "Get a concrete picture of the candidate's day-to-day scope",
      "Separate their personal contribution from the team's work",
      "Probe a decision they made without asking anyone",
      "Test how they know their work mattered"
    ]
  },
  {
    id: "system-design",
    title: "Learn system design",
    blurb: "Design a system out loud, with the trade-offs said aloud too.",
    category: "technical",
    roundType: "technical",
    intensity: "realistic",
    minutes: 15,
    agenda: [
      "Clarify requirements and constraints before any design is proposed",
      "Walk the data model and the main request path",
      "Push on what breaks first under 10x load and how they would know",
      "Force an explicit trade-off between consistency, cost, and latency"
    ]
  },
  {
    id: "own-a-failure",
    title: "Own a failure",
    blurb: "An incident or a bad call, without the polish.",
    category: "behavioral",
    roundType: "behavioral",
    intensity: "realistic",
    minutes: 10,
    agenda: [
      "Get one specific failure, outage, or decision that went wrong",
      "Establish the candidate's own part in it, not the team's",
      "Walk detection, response, and what the recovery actually cost",
      "Find what changed afterwards, in process or in code"
    ]
  },
  {
    id: "prove-your-impact",
    title: "Prove your impact",
    blurb: "The numbers on your resume, checked.",
    category: "behavioral",
    roundType: "behavioral",
    intensity: "brutal",
    minutes: 10,
    agenda: [
      "Pick a quantified claim and establish the baseline before the work",
      "Ask how the number was measured and by whom",
      "Separate the candidate's contribution from other causes",
      "Test what they would have done if the number had not moved"
    ]
  },
  {
    id: "debug-under-pressure",
    title: "Debug under pressure",
    blurb: "The hardest bug you have chased, step by step.",
    category: "technical",
    roundType: "technical",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Get the symptom, the blast radius, and how it was first noticed",
      "Walk the hypotheses in the order they were actually tried",
      "Press on the tooling and signals used to narrow it down",
      "Establish how the fix was verified and what stopped a repeat"
    ]
  },
  {
    id: "hiring-manager",
    title: "Hiring manager screen",
    blurb: "Scope, motivation, and whether the story holds together.",
    category: "leadership",
    roundType: "hiring-manager",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Understand the arc of their career and why each move happened",
      "Test whether the scope they claim matches the work they describe",
      "Probe how they work with product, design, and other engineers",
      "Ask what they want next and why this role is that"
    ]
  },
  {
    id: "disagree-and-commit",
    title: "Disagree and commit",
    blurb: "A real disagreement, and how it actually ended.",
    category: "behavioral",
    roundType: "behavioral",
    intensity: "realistic",
    minutes: 10,
    agenda: [
      "Get one specific technical or product disagreement with a named counterpart",
      "Establish both positions fairly, including the other side's best argument",
      "Walk how it was resolved and who decided",
      "Find what the candidate did once the decision went against them"
    ]
  },
  {
    id: "lead-without-authority",
    title: "Lead without authority",
    blurb: "Moving work you do not own.",
    category: "leadership",
    roundType: "hiring-manager",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Find work the candidate drove across a team boundary",
      "Press on how they got people to act without managing them",
      "Probe a moment when momentum stalled and what they changed",
      "Test how they mentored or unblocked someone specific"
    ]
  },
  {
    id: "code-fundamentals",
    title: "Code fundamentals",
    blurb: "The data structures and complexity behind your real work.",
    category: "technical",
    roundType: "technical",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Anchor to a data structure or algorithm the candidate actually used in production",
      "Press on why that choice over the obvious alternative",
      "Ask about complexity, memory, and the input size it was built for",
      "Test how it was covered by tests and what edge case bit them"
    ]
  },
  {
    id: "product-sense",
    title: "Product sense",
    blurb: "Users, priorities, and the trade-offs you defended.",
    category: "leadership",
    roundType: "hiring-manager",
    intensity: "realistic",
    minutes: 12,
    agenda: [
      "Establish the user problem behind something they shipped",
      "Press on what they deliberately chose not to build",
      "Ask which metric they watched and what it did",
      "Test how they would kill or double down on the feature today"
    ],
    roles: ["pm", "fullstack", "frontend"]
  },
  {
    id: "warm-up",
    title: "Five-minute warm-up",
    blurb: "A short round to shake off the nerves.",
    category: "behavioral",
    roundType: "behavioral",
    intensity: "friendly",
    minutes: 5,
    agenda: [
      "Open with a relaxed question about what they are working on now",
      "Ask for one thing they are proud of and why it was hard",
      "Close with what they want to get better at"
    ]
  }
];

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: "behavioral", label: "Behavioral" },
  { id: "technical", label: "Technical" },
  { id: "leadership", label: "Leadership" }
];

export function findTemplate(id: string | null | undefined): InterviewTemplate | null {
  if (!id) return null;
  return INTERVIEW_TEMPLATES.find((template) => template.id === id) ?? null;
}
