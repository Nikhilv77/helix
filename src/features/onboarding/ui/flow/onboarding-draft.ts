import type { Level, ResumeExtractionResponse } from "@/lib/shared/types";
import { onboardingSteps, type Step } from "./onboarding-data";

/**
 * Keeps an unfinished onboarding in this browser tab, so a refresh during the
 * resume review does not send someone back to the teacher picker and make
 * them wait for the resume to be read again. Tab-scoped on purpose: it holds
 * the person's own resume extraction and disappears when the tab closes.
 */
const STORAGE_KEY = "trailgrad:onboarding-draft";
/** A preview this close to expiry would fail on completion, so start over. */
const MIN_PREVIEW_LIFETIME_MS = 5 * 60_000;

export interface OnboardingDraft {
  step: Step;
  teacherId: string | null;
  level: Level | null;
  result: ResumeExtractionResponse | null;
}

const REVIEW_STEPS: readonly Step[] = ["identity", "evidence", "readiness"];

export function readOnboardingDraft(now = Date.now()): OnboardingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OnboardingDraft;
    // A draft saved by an older build can name a step that no longer exists.
    if (!onboardingSteps.some((item) => item.value === draft.step)) return null;
    const reviewing = REVIEW_STEPS.includes(draft.step);
    const previewAlive =
      typeof draft.result?.previewExpiresAt === "number" &&
      draft.result.previewExpiresAt - now > MIN_PREVIEW_LIFETIME_MS;
    // A review step is only resumable with a preview that can still be
    // confirmed; otherwise fall back to the resume step with the choices kept.
    if (reviewing && !previewAlive) return { ...draft, step: "resume", result: null };
    return draft;
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft): void {
  try {
    // The upload step holds a File that cannot be stored; resume at that step
    // with the teacher and level already chosen.
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the flow still works, it just will not resume.
  }
}

export function clearOnboardingDraft(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
