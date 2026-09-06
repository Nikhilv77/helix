import type { PreparationOnboardingStage } from "./preparation-onboarding";
import type { Role } from "@/lib/shared/types";

type ResumeRoleEvidence = {
  skills: string[];
  experience: Array<{ role: string; summary: string; skills: string[] }>;
  projects: Array<{ name: string; summary: string; skills: string[] }>;
};

type InferredRole = Exclude<Role, "pm" | "fullstack">;

const ROLE_SIGNALS: Record<InferredRole, RegExp[]> = {
  frontend: [
    /\breact\b/,
    /next\.js/,
    /\bvue\b/,
    /\bangular\b/,
    /\bfront[ -]?end\b/,
    /\bcss\b/,
    /\bhtml\b/,
    /web performance/,
    /user interface/
  ],
  backend: [
    /\bnode(?:\.js|js)?\b/,
    /\bexpress\b/,
    /\bnestjs\b/,
    /\bjava\b/,
    /\bspring(?: boot)?\b/,
    /\bback[ -]?end\b/,
    /\bapi(?:s)?\b/,
    /microservice/,
    /\bdjango\b/,
    /\bflask\b/,
    /\bfastapi\b/,
    /\bpostgres(?:ql)?\b/
  ],
  data: [
    /data engineer/,
    /\bspark\b/,
    /\betl\b/,
    /\belt\b/,
    /data warehouse/,
    /data pipeline/,
    /\bairflow\b/,
    /\bdbt\b/
  ],
  "ai-ml": [
    /machine learning/,
    /\bml engineer/,
    /artificial intelligence/,
    /data science/,
    /tensorflow/,
    /pytorch/,
    /scikit/,
    /\bllm\b/,
    /\brag\b/,
    /embedding/,
    /model training/
  ]
};

const ROLE_TITLE_SIGNALS: Record<InferredRole | "fullstack", RegExp[]> = {
  frontend: [/\bfront[ -]?end\b/, /\bui engineer\b/],
  backend: [/\bback[ -]?end\b/, /\bserver(?:-side)? engineer\b/],
  fullstack: [/\bfull[ -]?stack\b/],
  data: [/\bdata engineer\b/, /\banalytics engineer\b/],
  "ai-ml": [
    /\b(?:ai|ml|machine learning|artificial intelligence) (?:engineer|developer|scientist)\b/,
    /\bdata scientist\b/
  ]
};

function normalizedEvidence(values: string[]): string {
  return values.join(" ").toLowerCase();
}

function matchingSignalCount(evidence: string, signals: RegExp[]): number {
  return signals.reduce((count, signal) => count + Number(signal.test(evidence)), 0);
}

/**
 * Suggests a coding preparation track from resume evidence on the first target
 * screen. Once the candidate has saved that screen, their explicit selection
 * wins on every resume or navigation refresh.
 */
export function suggestedPreparationRole(input: {
  stage: PreparationOnboardingStage;
  savedRole: Role | null;
  resume: ResumeRoleEvidence | null;
}): Role {
  if (input.stage !== "target_role" && input.savedRole) return input.savedRole;

  const resume = input.resume;
  if (!resume) return "fullstack";

  const titles = normalizedEvidence(resume.experience.map((entry) => entry.role));
  if (matchingSignalCount(titles, ROLE_TITLE_SIGNALS.fullstack) > 0) {
    return "fullstack";
  }

  const skills = normalizedEvidence([
    ...resume.skills,
    ...resume.experience.flatMap((entry) => entry.skills),
    ...resume.projects.flatMap((project) => project.skills)
  ]);
  const experienceSummaries = normalizedEvidence(resume.experience.map((entry) => entry.summary));
  const projects = normalizedEvidence(
    resume.projects.flatMap((project) => [project.name, project.summary])
  );

  const titleMatches = {} as Record<InferredRole, number>;
  const scores = {} as Record<InferredRole, number>;
  for (const role of Object.keys(ROLE_SIGNALS) as InferredRole[]) {
    titleMatches[role] = matchingSignalCount(titles, ROLE_TITLE_SIGNALS[role]);
    scores[role] =
      titleMatches[role] * 8 +
      matchingSignalCount(skills, ROLE_SIGNALS[role]) * 3 +
      matchingSignalCount(experienceSummaries, ROLE_SIGNALS[role]) * 2 +
      matchingSignalCount(projects, ROLE_SIGNALS[role]);
  }

  const strongestSpecialization = scores["ai-ml"] >= scores.data ? "ai-ml" : "data";
  const strongestSoftwareScore = Math.max(scores.frontend, scores.backend);
  const specializationIsCredible =
    titleMatches[strongestSpecialization] > 0 ||
    (scores[strongestSpecialization] >= 6 &&
      scores[strongestSpecialization] >= strongestSoftwareScore + 2);

  if (specializationIsCredible) return strongestSpecialization;
  if (scores.frontend >= 3 && scores.backend >= 3) return "fullstack";
  if (scores.frontend > scores.backend) return "frontend";
  if (scores.backend > 0) return "backend";
  // Non-coding or ambiguous resumes still enter the product through its broad
  // software-development track and can change the selection before assessment.
  return "fullstack";
}
