import type { PreparationOnboardingStage } from "./preparation-onboarding";
import type { Role } from "@/lib/shared/types";

type ResumeRoleEvidence = {
  skills: string[];
  experience: Array<{ role: string; summary: string; skills: string[] }>;
  projects: Array<{ name: string; summary: string; skills: string[] }>;
};

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

  const experience = input.resume?.experience.flatMap((entry) => [
    entry.role,
    entry.summary,
    ...entry.skills
  ]) ?? [];
  const projects = input.resume?.projects.flatMap((project) => [
    project.name,
    project.summary,
    ...project.skills
  ]) ?? [];
  const evidence = [...(input.resume?.skills ?? []), ...experience, ...projects]
    .join(" ")
    .toLowerCase();

  const aiMl = /(machine learning|\bml engineer|artificial intelligence|data science|tensorflow|pytorch|scikit|\bllm\b|\brag\b|embedding|model training)/.test(evidence);
  const data = /(data engineer|\bspark\b|\betl\b|\belt\b|data warehouse|data pipeline|\bairflow\b|\bdbt\b)/.test(evidence);
  const frontend = /(\breact\b|next\.js|\bvue\b|\bangular\b|\bfrontend\b|front-end|\bcss\b|\bhtml\b|web performance|user interface)/.test(evidence);
  const backend = /(\bnode(?:\.js|js)?\b|\bexpress\b|\bnestjs\b|\bjava\b|\bspring\b|\bbackend\b|back-end|\bapi(?:s)?\b|microservice|\bdjango\b|\bflask\b|\bfastapi\b|\bpostgres(?:ql)?\b)/.test(evidence);

  if (aiMl) return "ai-ml";
  if (data) return "data";
  if (frontend && backend) return "fullstack";
  if (frontend) return "frontend";
  if (backend) return "backend";
  // Non-coding or ambiguous resumes still enter the product through its broad
  // software-development track and can change the selection before assessment.
  return "fullstack";
}

