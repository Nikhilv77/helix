import type { CandidateResume } from "@/lib/shared/types";

/**
 * Tier 3 personalization — resume-bound prompt rendering.
 *
 * A template carries a generic `prompt` and an optional `promptTemplate` whose
 * slots are filled from the candidate's own resume, so the same question reads
 * as though it were written about their stack.
 *
 * Four rules, and the third is the one that matters:
 *
 * 1. `promptTemplate` is optional. Without one, `prompt` renders unchanged.
 * 2. If any slot cannot be resolved, fall back to `prompt` **entirely**. A
 *    half-filled prompt reads worse than a generic one.
 * 3. Slots affect framing only, never the answer. The `answerKey` is identical
 *    whichever slots resolved — otherwise mechanical grading breaks and two
 *    candidates get different verdicts on identical code.
 * 4. Below a confidence threshold, do not personalize at all. A wrong employer
 *    name costs more trust than a generic prompt ever saves.
 */

/** Below this, the parse is not trusted enough to put its output in front of someone. */
export const MIN_RESUME_CONFIDENCE = 0.6;

const SLOT_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Anything left in braces after substitution.
 *
 * Part of the bank predates this resolver and uses a different syntax —
 * `{resume.projectOrRole}`, `{targetRole}` — which SLOT_PATTERN does not match.
 * Without this guard those templates render with the placeholder printed
 * verbatim to the candidate, which is worse than any generic prompt.
 */
const ANY_PLACEHOLDER = /\{[^{}]*\}/;

export interface PersonalizationContext {
  resume: CandidateResume | null;
  resumeConfidence: number | null;
  targetCompany: string | null;
  level: string | null;
  editorLanguage: string | null;
}

/** The single most frequent skill across experience and projects. */
function dominantSkill(resume: CandidateResume): string | null {
  const counts = new Map<string, number>();
  const record = (skill: string) => {
    const key = skill.trim();
    if (key.length === 0) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const entry of resume.experience) entry.skills.forEach(record);
  for (const project of resume.projects) project.skills.forEach(record);

  let best: string | null = null;
  let bestCount = 0;
  for (const [skill, count] of counts) {
    // Ties resolve alphabetically so the same resume always renders the same
    // prompt — an unstable slot would make a question look edited between views.
    if (count > bestCount || (count === bestCount && best !== null && skill < best)) {
      best = skill;
      bestCount = count;
    }
  }
  return best;
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function buildSlots(context: PersonalizationContext): Record<string, string | null> {
  const { resume } = context;
  return {
    primaryLanguage: firstNonEmpty([context.editorLanguage]),
    framework: resume ? dominantSkill(resume) : null,
    projectName: resume ? firstNonEmpty(resume.projects.map((p) => p.name)) : null,
    employer: resume ? firstNonEmpty(resume.experience.map((e) => e.organization)) : null,
    targetCompany: firstNonEmpty([context.targetCompany]),
    level: firstNonEmpty([context.level])
  };
}

/**
 * Returns the prompt to display. Never throws, and never returns a partially
 * filled template — callers can use the result directly.
 */
export function renderPrompt(
  question: { prompt: string; promptTemplate?: string | null },
  context: PersonalizationContext
): string {
  const template = question.promptTemplate?.trim();
  if (!template) return question.prompt;

  const confidence = context.resumeConfidence;
  if (confidence === null || confidence < MIN_RESUME_CONFIDENCE) return question.prompt;

  const slots = buildSlots(context);

  let unresolved = false;
  const rendered = template.replace(SLOT_PATTERN, (_match, name: string) => {
    const value = slots[name];
    if (!value) {
      unresolved = true;
      return "";
    }
    return value;
  });

  // An unknown slot name lands here too: buildSlots has no entry for it, so it
  // reads as unresolved rather than rendering an empty gap.
  if (unresolved) return question.prompt;

  // A template written in a syntax this resolver does not speak is unrenderable,
  // not renderable-as-is.
  return ANY_PLACEHOLDER.test(rendered) ? question.prompt : rendered;
}
