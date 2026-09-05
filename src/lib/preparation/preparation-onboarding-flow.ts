import type { Role } from "@/lib/shared/types";
import type { BaselineSection } from "./preparation-onboarding";

export const BASELINE_DURATION_LABEL = "About 12–15 minutes";

/** Client-safe narration copy. This module deliberately imports no question banks. */
export function baselineQuestionTeacherCue(section: BaselineSection, questionId?: string): string {
  const cuesBySection: Record<BaselineSection, string[]> = {
    "dsa-familiarity": ["Be honest with yourself here—there’s no trick.", "Take a second and choose what feels most true today.", "This just helps me meet you at the right starting point."],
    "dsa-lookup": ["Read the constraint carefully and think about the operation you need most.", "Take your time—look for the structure that removes repeated work.", "You’ve got this. Focus on what needs to be fast."],
    "dsa-binary-search": ["Pause for a moment and look for the monotonic clue.", "Read carefully—notice how the search space behaves.", "Think about whether one side can be ruled out each time."],
    "dsa-tree-bfs": ["Picture the problem one level at a time before you choose.", "No rush—think about how the work would spread through the structure.", "Read the traversal requirement closely; the wording is the hint."],
    "dsa-adaptive": ["Nice—take one more beat and focus on the window constraint.", "You’re doing well. Think about what the left and right pointers must preserve.", "Read it slowly; the contiguous range is the important clue."],
    "dsa-code-lookup": ["You’ve got the idea—now read the order of those two lines carefully.", "Take a moment with the snippet. Ask what information must be checked before it changes.", "Read this one line by line; the order is the whole point."],
    "dsa-code-binary-search": ["Now trace one pass through the loop before you choose.", "Take your time with the bounds—notice which half can be ruled out.", "Read the comparison carefully, then follow where the target could still be."],
    "technical-1": ["Take a moment and reason from the real production constraint.", "Read carefully—choose the first useful move, not the biggest change.", "There’s no rush. Look for the boundary that needs attention."],
    "technical-2": ["Think it through before you answer; practical details matter here.", "Take your time and follow the data through the system.", "Read the scenario closely—the safest next step is usually in the constraint."],
    "technical-3": ["One more small decision—trust your engineering instinct.", "Pause and look for the failure mode before choosing.", "Read it carefully; you’re looking for the reliable path."],
    engineering: ["Take your time—start with the evidence before changing anything.", "Think like you’re on call: what would you want to know first?", "Read the trade-off carefully; the calm first move matters."],
    architecture: ["Zoom out for a moment and think about the boundary, not just one component.", "Take your time—start from the constraint the system must satisfy.", "Think through the failure and growth path before you choose."]
  };
  const cues = cuesBySection[section];
  return cues[hash(`${section}:${questionId ?? "default"}`) % cues.length]!;
}

/** DSA is not part of the initial AI/ML or legacy Product baseline. */
export function includesDsaPulse(role: Role): boolean {
  return role !== "ai-ml" && role !== "pm";
}

export function firstBaselineSection(role: Role): BaselineSection {
  return includesDsaPulse(role) ? "dsa-familiarity" : "technical-1";
}

export function nextBaselineSection(section: BaselineSection): BaselineSection | null {
  if (section === "dsa-familiarity") return "dsa-lookup";
  if (section === "dsa-lookup") return "dsa-binary-search";
  if (section === "dsa-binary-search") return "dsa-tree-bfs";
  if (section === "dsa-tree-bfs") return "dsa-adaptive";
  if (section === "dsa-adaptive") return "dsa-code-lookup";
  if (section === "dsa-code-lookup") return "dsa-code-binary-search";
  if (section === "dsa-code-binary-search") return "technical-1";
  if (section === "technical-1") return "technical-2";
  if (section === "technical-2") return "technical-3";
  if (section === "technical-3") return "engineering";
  if (section === "engineering") return "architecture";
  return null;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}
