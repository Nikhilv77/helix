import type { InterviewSetup } from "@/lib/shared/types";

export const INTERVIEW_REPORT_FAMILIES = [
  "dsa-design",
  "core-technical-projects",
  "hr-behavioral",
  "resume-behavioral"
] as const;

export type InterviewReportFamily = (typeof INTERVIEW_REPORT_FAMILIES)[number];

export interface EvaluationParameterDefinition {
  key: string;
  label: string;
  description: string;
  nextStep: string;
  weightPercent?: number;
}

export interface InterviewEvaluationProfile {
  family: InterviewReportFamily;
  label: string;
  shortLabel: string;
  parameters: readonly EvaluationParameterDefinition[];
}

const profiles: Record<InterviewReportFamily, InterviewEvaluationProfile> = {
  "dsa-design": profile("dsa-design", "DSA & Design", "DSA & Design", [
    parameter(
      "problem-understanding",
      "Problem understanding",
      "Frames the problem, constraints, and design goals correctly.",
      "Restate the constraints and success condition before choosing an approach."
    ),
    parameter(
      "approach-reasoning",
      "Approach & reasoning",
      "Builds a coherent algorithm or design and explains why it fits.",
      "Compare at least one alternative and explain why your chosen approach fits better."
    ),
    parameter(
      "correctness",
      "Correctness",
      "Produces a sound solution whose behavior matches the requirements.",
      "Walk through the solution against a concrete example before calling it complete."
    ),
    parameter(
      "complexity-scalability",
      "Complexity & scalability",
      "Explains computational cost or how the design behaves under load.",
      "State the important time, space, or capacity trade-off explicitly."
    ),
    parameter(
      "edge-cases-reliability",
      "Edge cases & reliability",
      "Handles boundary conditions, failure modes, and operational risks.",
      "Test the answer against one boundary case and one failure scenario."
    ),
    parameter(
      "communication",
      "Communication",
      "Keeps the reasoning structured and easy for an interviewer to follow.",
      "Signpost the approach, key decision, and conclusion in that order."
    )
  ]),
  "core-technical-projects": profile(
    "core-technical-projects",
    "Core Technical & Projects",
    "Core Technical",
    [
      parameter(
        "concept-depth",
        "Concept depth",
        "Explains the underlying mechanism rather than only naming technology.",
        "Explain what happens under the hood and why it matters."
      ),
      parameter(
        "technical-reasoning",
        "Technical reasoning",
        "Connects evidence, constraints, and technical decisions logically.",
        "Make the constraint-to-decision chain explicit."
      ),
      parameter(
        "tradeoffs",
        "Trade-offs",
        "Recognizes alternatives and the costs of the chosen direction.",
        "Name the strongest alternative and what you gave up."
      ),
      parameter(
        "practical-execution",
        "Practical execution",
        "Carries the idea into an implementable and reliable solution.",
        "Add implementation steps, validation, and failure handling."
      ),
      parameter(
        "project-ownership",
        "Project ownership",
        "Separates personal contribution from the surrounding team effort.",
        "State the decision or implementation you personally owned."
      ),
      parameter(
        "communication",
        "Communication",
        "Explains technical material precisely and in a usable sequence.",
        "Lead with the mechanism, then support it with one concrete example."
      )
    ]
  ),
  "hr-behavioral": profile("hr-behavioral", "HR & Behavioural", "HR & Behavioural", [
    parameter(
      "motivation-fit",
      "Motivation & fit",
      "Shows realistic priorities and a considered reason for the next move.",
      "Connect what you want next to one concrete experience from your career."
    ),
    parameter(
      "judgement",
      "Judgement",
      "Makes thoughtful decisions when priorities or information are unclear.",
      "Explain the trade-off you chose and the information you used."
    ),
    parameter(
      "collaboration",
      "Collaboration",
      "Handles disagreement constructively and protects working relationships.",
      "Describe what you said or did to move the relationship forward."
    ),
    parameter(
      "accountability",
      "Accountability",
      "Owns mistakes, repairs impact, and changes future behavior.",
      "Show the repair and the concrete change you made afterward."
    ),
    parameter(
      "self-awareness",
      "Self-awareness",
      "Reflects honestly on feedback, strengths, and development areas.",
      "Name what others would now observe you doing differently."
    ),
    parameter(
      "communication",
      "Communication",
      "Answers directly with a clear situation, action, and outcome.",
      "Keep the story focused and close with what changed."
    )
  ]),
  "resume-behavioral": profile(
    "resume-behavioral",
    "Resume & Behavioural",
    "Resume & Behavioural",
    [
      parameter(
        "claim-credibility",
        "Claim credibility",
        "Supports resume claims with verifiable context and detail.",
        "Anchor the claim in a specific project, constraint, and result.",
        20
      ),
      parameter(
        "personal-ownership",
        "Personal ownership",
        "Makes the candidate's own responsibility and contribution explicit.",
        "Separate what you personally did from what the team did.",
        20
      ),
      parameter(
        "decision-making",
        "Decision-making",
        "Explains choices, alternatives, and trade-offs from real work.",
        "Name the decision, why you made it, and the alternative you rejected.",
        15
      ),
      parameter(
        "specificity",
        "Specificity",
        "Uses concrete implementation, situation, and action details.",
        "Replace broad claims with one precise example.",
        15
      ),
      parameter(
        "impact-learning",
        "Impact & learning",
        "Shows what changed and what the candidate learned afterward.",
        "Close with a measured result or a durable change in behavior.",
        20
      ),
      parameter(
        "communication",
        "Communication",
        "Presents resume evidence clearly without unnecessary detail.",
        "Lead with the claim, then give evidence and the result.",
        10
      )
    ]
  )
};

export function interviewFamilyForSetup(
  setup: Pick<
    InterviewSetup,
    | "roundType"
    | "resumeRound"
    | "templateId"
    | "templateTitle"
    | "dsaBlockAssessment"
    | "storyPracticeAssessment"
    | "coreTechnicalAssessment"
  >
): InterviewReportFamily {
  if (setup.roundType === "hiring-manager" || setup.templateId === "hiring-manager-final") {
    return "hr-behavioral";
  }
  if (setup.resumeRound || setup.templateId === "resume-behavioral-defense") {
    return "resume-behavioral";
  }

  const practice = setup.storyPracticeAssessment?.practice;
  const identity = `${setup.templateId ?? ""} ${setup.templateTitle ?? ""}`.toLowerCase();
  if (
    setup.dsaBlockAssessment?.kind === "dsa-block-assessment" ||
    practice === "architecture-design" ||
    /\b(?:dsa|algorithm|architecture|system design)\b/.test(identity)
  ) {
    return "dsa-design";
  }

  return "core-technical-projects";
}

export function evaluationProfileForSetup(
  setup: Parameters<typeof interviewFamilyForSetup>[0]
): InterviewEvaluationProfile {
  return profiles[interviewFamilyForSetup(setup)];
}

export function evaluationProfileForFamily(
  family: InterviewReportFamily
): InterviewEvaluationProfile {
  return profiles[family];
}

export function allInterviewEvaluationProfiles(): InterviewEvaluationProfile[] {
  return INTERVIEW_REPORT_FAMILIES.map((family) => profiles[family]);
}

function profile(
  family: InterviewReportFamily,
  label: string,
  shortLabel: string,
  parameters: EvaluationParameterDefinition[]
): InterviewEvaluationProfile {
  return { family, label, shortLabel, parameters };
}

function parameter(
  key: string,
  label: string,
  description: string,
  nextStep: string,
  weightPercent?: number
): EvaluationParameterDefinition {
  return { key, label, description, nextStep, weightPercent };
}
