import { TEACHER_LINES } from "@/lib/voice/teacher-lines";

/**
 * What the teacher says the first time a learner reaches the Overview after
 * onboarding, once per learner. Pre-recorded for every teacher, so the tour
 * costs no live speech.
 */
export function overviewTourLine(): string {
  return TEACHER_LINES.overviewTour[0];
}
