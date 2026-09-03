import type { CandidateResume } from "@/lib/shared/types";

/** A bullet above this many words is usually harder to scan in a resume. */
export const RESUME_ROAST_LONG_BULLET_WORD_THRESHOLD = 32;
/** Keep the model input bounded without cutting a source bullet used for a rewrite. */
export const RESUME_ROAST_MAX_EVIDENCE_ITEMS = 36;
export const RESUME_ROAST_MAX_EVIDENCE_TEXT_LENGTH = 500;
export const RESUME_ROAST_MAX_TOP_SKILLS = 20;
const RESUME_ROAST_MAX_EDUCATION_FACT_LENGTH = 150;

export type ResumeRoastEvidenceKind =
  | "experience-summary"
  | "experience-achievement"
  | "project-summary"
  | "project-outcome"
  | "education"
  | "achievement";

/**
 * Metadata helps distinguish otherwise similar bullets, without passing a
 * filename, candidate identity, contact information, or raw document text.
 */
export interface ResumeRoastEvidenceContext {
  role?: string;
  project?: string;
}

export interface ResumeRoastEvidenceItem {
  id: string;
  kind: ResumeRoastEvidenceKind;
  text: string;
  context?: ResumeRoastEvidenceContext;
}

export interface ResumeRoastRepeatedVerb {
  verb: string;
  count: number;
  evidenceIds: string[];
}

export interface ResumeRoastSignals {
  bulletCount: number;
  metricBearingBulletCount: number;
  metricBearingEvidenceIds: string[];
  missingMetricBulletCount: number;
  missingMetricEvidenceIds: string[];
  repeatedLeadingVerbs: ResumeRoastRepeatedVerb[];
  longBulletEvidenceIds: string[];
  averageWordsPerBullet: number;
  maxWordsPerBullet: number;
  /** The count before this compact snapshot caps or de-duplicates skills. */
  skillListSize: number;
}

/** Compact source material for one grounded Resume Roast model request. */
export interface ResumeRoastSnapshot {
  evidence: ResumeRoastEvidenceItem[];
  warnings: string[];
  topSkills: string[];
  signals: ResumeRoastSignals;
}

type EvidenceCandidate = ResumeRoastEvidenceItem;

/**
 * Builds a deterministic snapshot from the already stored extraction. A null
 * resume deliberately remains null: the caller can route the user to Profile
 * without attempting an upload or a second parser pass.
 */
export function buildResumeRoastSnapshot(
  resume: CandidateResume | null
): ResumeRoastSnapshot | null {
  if (resume === null) return null;

  const evidence = collectEvidence(resume);
  const bulletEvidence = evidence.filter(isBulletEvidence);
  const wordCounts = bulletEvidence.map((item) => countWords(item.text));
  const metricBearingEvidenceIds = bulletEvidence
    .filter((item) => hasQuantitativeEvidence(item.text))
    .map((item) => item.id);
  const metricBearingIds = new Set(metricBearingEvidenceIds);
  const missingMetricEvidenceIds = bulletEvidence
    .filter((item) => !metricBearingIds.has(item.id))
    .map((item) => item.id);

  return {
    evidence,
    warnings: compactWarnings(resume.warnings),
    topSkills: compactSkills(resume.skills),
    signals: {
      bulletCount: bulletEvidence.length,
      metricBearingBulletCount: metricBearingEvidenceIds.length,
      metricBearingEvidenceIds,
      missingMetricBulletCount: missingMetricEvidenceIds.length,
      missingMetricEvidenceIds,
      repeatedLeadingVerbs: findRepeatedLeadingVerbs(bulletEvidence),
      longBulletEvidenceIds: bulletEvidence
        .filter((item) => countWords(item.text) > RESUME_ROAST_LONG_BULLET_WORD_THRESHOLD)
        .map((item) => item.id),
      averageWordsPerBullet:
        wordCounts.length === 0
          ? 0
          : Math.round((wordCounts.reduce((total, count) => total + count, 0) / wordCounts.length) * 10) /
            10,
      maxWordsPerBullet: wordCounts.length === 0 ? 0 : Math.max(...wordCounts),
      skillListSize: resume.skills.length
    }
  };
}

function collectEvidence(resume: CandidateResume): ResumeRoastEvidenceItem[] {
  const candidates: EvidenceCandidate[] = [];

  for (const [experienceIndex, experience] of resume.experience.entries()) {
    const context = contextForRole(experience.role);
    candidates.push({
      id: `experience-${experienceIndex + 1}-summary`,
      kind: "experience-summary",
      text: experience.summary,
      ...(context ? { context } : {})
    });
    for (const [achievementIndex, achievement] of experience.achievements.entries()) {
      candidates.push({
        id: `experience-${experienceIndex + 1}-achievement-${achievementIndex + 1}`,
        kind: "experience-achievement",
        text: achievement,
        ...(context ? { context } : {})
      });
    }
  }

  for (const [projectIndex, project] of resume.projects.entries()) {
    const context = contextForProject(project.name);
    candidates.push({
      id: `project-${projectIndex + 1}-summary`,
      kind: "project-summary",
      text: project.summary,
      ...(context ? { context } : {})
    });
    candidates.push({
      id: `project-${projectIndex + 1}-outcome`,
      kind: "project-outcome",
      text: project.outcome,
      ...(context ? { context } : {})
    });
  }

  for (const [educationIndex, education] of resume.education.entries()) {
    const text = educationEvidenceText(education);
    if (!text) continue;
    candidates.push({
      id: `education-${educationIndex + 1}`,
      kind: "education",
      text
    });
  }

  for (const [achievementIndex, achievement] of resume.achievements.entries()) {
    candidates.push({
      id: `achievement-${achievementIndex + 1}`,
      kind: "achievement",
      text: achievement
    });
  }

  const seenText = new Set<string>();
  const evidence: ResumeRoastEvidenceItem[] = [];
  for (const candidate of candidates) {
    if (!isUsableEvidenceText(candidate.text) || seenText.has(candidate.text)) continue;
    seenText.add(candidate.text);
    evidence.push(candidate);
    if (evidence.length === RESUME_ROAST_MAX_EVIDENCE_ITEMS) break;
  }
  return evidence;
}

function isBulletEvidence(item: ResumeRoastEvidenceItem): boolean {
  return item.kind !== "education";
}

/**
 * Education facts are useful grounding for an early-career strength, but are
 * not resume bullets and must never influence bullet-writing diagnostics.
 */
function educationEvidenceText(education: CandidateResume["education"][number]): string | null {
  const facts = [education.credential, education.field, education.institution]
    .map(compactEducationFact)
    .filter((fact): fact is string => fact !== null);
  if (facts.length === 0) return null;

  const text = facts.join(" · ");
  return text.length <= RESUME_ROAST_MAX_EVIDENCE_TEXT_LENGTH ? text : null;
}

function compactEducationFact(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= RESUME_ROAST_MAX_EDUCATION_FACT_LENGTH
    ? cleaned
    : null;
}

function contextForRole(role: string): ResumeRoastEvidenceContext | undefined {
  const safeRole = compactMetadata(role);
  return safeRole ? { role: safeRole } : undefined;
}

function contextForProject(project: string): ResumeRoastEvidenceContext | undefined {
  const safeProject = compactMetadata(project);
  return safeProject ? { project: safeProject } : undefined;
}

function compactMetadata(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= 120 ? cleaned : null;
}

function isUsableEvidenceText(value: string): boolean {
  return value.trim().length > 0 && value.length <= RESUME_ROAST_MAX_EVIDENCE_TEXT_LENGTH;
}

function compactWarnings(warnings: string[]): string[] {
  return compactStrings(warnings, 12, 240);
}

function compactSkills(skills: string[]): string[] {
  return compactStrings(skills, RESUME_ROAST_MAX_TOP_SKILLS, 80);
}

function compactStrings(values: string[], maximumItems: number, maximumLength: number): string[] {
  const seen = new Set<string>();
  const compacted: string[] = [];
  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/g, " ");
    const key = cleaned.toLocaleLowerCase("en");
    if (!cleaned || cleaned.length > maximumLength || seen.has(key)) continue;
    seen.add(key);
    compacted.push(cleaned);
    if (compacted.length === maximumItems) break;
  }
  return compacted;
}

/**
 * This detects quantitative notation, not proven business impact. A date or a
 * number alone is deliberately insufficient; prompts must still treat every
 * item as evidence to inspect rather than an inferred outcome.
 */
function hasQuantitativeEvidence(text: string): boolean {
  const looksLikeOnlyDateRange =
    /\bfrom\s+(?:19|20)\d{2}\s+to\s+(?:19|20)\d{2}\b/i.test(text) &&
    !/\b\d+(?:\.\d+)?\s*(?:users?|customers?|clients?|requests?|transactions?|orders?|events?|records?|documents?|files?|apis?|services?|endpoints?|features?|engineers?|people|team members?|reports?|tests?|tickets?|issues?|deployments?|releases?|regions?|countries|languages|models?|datasets?|tables?|pipelines?|servers?|instances?|gb|tb|mb|kb)\b/i.test(
      text
    );
  return (
    /\b\d+(?:[.,]\d+)?\s*%/.test(text) ||
    /(?:[$€£₹]\s*\d|\b(?:usd|eur|gbp|inr)\s*\d)/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*[x×](?=\s|$|[.,;:)\]])/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|s|sec(?:onds?)?|mins?|minutes?|hrs?|hours?|days?|weeks?|months?)\b/i.test(
      text
    ) ||
    /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/.test(text) ||
    /\b\d+(?:\.\d+)?\s*(?:users?|customers?|clients?|requests?|transactions?|orders?|events?|records?|documents?|files?|apis?|services?|endpoints?|features?|engineers?|people|team members?|reports?|tests?|tickets?|issues?|deployments?|releases?|regions?|countries|languages|models?|datasets?|tables?|pipelines?|servers?|instances?|gb|tb|mb|kb)\b/i.test(
      text
    ) ||
    (!looksLikeOnlyDateRange &&
      /\b(?:by|from|to|over|under|within|across|at least|more than|less than)\s+\d+(?:[.,]\d+)?\b/i.test(
        text
      ))
  );
}

function findRepeatedLeadingVerbs(evidence: ResumeRoastEvidenceItem[]): ResumeRoastRepeatedVerb[] {
  const groups = new Map<string, string[]>();
  for (const item of evidence) {
    const verb = normalizeLeadingVerb(item.text);
    if (!verb) continue;
    const evidenceIds = groups.get(verb) ?? [];
    evidenceIds.push(item.id);
    groups.set(verb, evidenceIds);
  }

  return [...groups.entries()]
    .filter(([, evidenceIds]) => evidenceIds.length > 1)
    .map(([verb, evidenceIds]) => ({ verb, count: evidenceIds.length, evidenceIds }));
}

function normalizeLeadingVerb(text: string): string | null {
  const firstWord = text
    .replace(/^\s*(?:[-•▪◦*]+\s*)+/, "")
    .match(/^[\p{L}][\p{L}'-]*/u)?.[0]
    ?.toLocaleLowerCase("en");
  if (!firstWord) return null;
  return LEADING_VERB_CANONICAL_MAP[firstWord] ?? null;
}

/**
 * Only known, common resume action verbs are eligible for a repetition signal.
 * This avoids treating a repeated subject such as "The" or "Customer" as a
 * writing problem, while preserving explainable normalization for obvious
 * inflections of these verbs.
 */
const LEADING_VERB_CANONICAL_MAP: Readonly<Record<string, string>> = {
  analyze: "analyze",
  analyzed: "analyze",
  analyzing: "analyze",
  analyzes: "analyze",
  architect: "architect",
  architected: "architect",
  architecting: "architect",
  architects: "architect",
  automate: "automate",
  automated: "automate",
  automating: "automate",
  automates: "automate",
  build: "build",
  built: "build",
  building: "build",
  builds: "build",
  collaborate: "collaborate",
  collaborated: "collaborate",
  collaborating: "collaborate",
  collaborates: "collaborate",
  create: "create",
  created: "create",
  creating: "create",
  creates: "create",
  deliver: "deliver",
  delivered: "deliver",
  delivering: "deliver",
  delivers: "deliver",
  deploy: "deploy",
  deployed: "deploy",
  deploying: "deploy",
  deploys: "deploy",
  design: "design",
  developed: "develop",
  develop: "develop",
  developing: "develop",
  develops: "develop",
  designed: "design",
  designing: "design",
  designs: "design",
  implement: "implement",
  implemented: "implement",
  implementing: "implement",
  implements: "implement",
  improve: "improve",
  improved: "improve",
  improving: "improve",
  improves: "improve",
  increase: "increase",
  increased: "increase",
  increasing: "increase",
  increases: "increase",
  integrate: "integrate",
  integrated: "integrate",
  integrating: "integrate",
  integrates: "integrate",
  introduce: "introduce",
  introduced: "introduce",
  introducing: "introduce",
  introduces: "introduce",
  launch: "launch",
  launched: "launch",
  launching: "launch",
  launches: "launch",
  lead: "lead",
  led: "lead",
  leading: "lead",
  leads: "lead",
  manage: "manage",
  managed: "manage",
  managing: "manage",
  manages: "manage",
  mentor: "mentor",
  mentored: "mentor",
  mentoring: "mentor",
  mentors: "mentor",
  migrate: "migrate",
  migrated: "migrate",
  migrating: "migrate",
  migrates: "migrate",
  optimize: "optimize",
  optimized: "optimize",
  optimizing: "optimize",
  optimizes: "optimize",
  own: "own",
  owned: "own",
  owning: "own",
  owns: "own",
  research: "research",
  researched: "research",
  researching: "research",
  researches: "research",
  reduce: "reduce",
  reduced: "reduce",
  reducing: "reduce",
  reduces: "reduce",
  scale: "scale",
  scaled: "scale",
  scaling: "scale",
  scales: "scale",
  secure: "secure",
  secured: "secure",
  securing: "secure",
  secures: "secure",
  showcase: "showcase",
  showcased: "showcase",
  showcasing: "showcase",
  showcases: "showcase"
};

function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
