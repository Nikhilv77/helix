import type { InterviewQuestionKind, Turn } from "@/lib/shared/types";
import type { TEACHER_LINES } from "@/lib/voice/teacher-lines";

export type PracticeAssessmentMoment = keyof typeof TEACHER_LINES.practiceAssessment;

/**
 * Which pre-recorded line the teacher says for a practice assessment turn.
 * Returns null for turns that must be heard in full, such as a follow-up
 * question the learner has to answer.
 *
 * `next` describes the session now, so this is only meaningful for the most
 * recent teacher turn.
 */
export function practiceAssessmentMoment(
  turn: Turn,
  next: { done: boolean; kind: InterviewQuestionKind | null }
): PracticeAssessmentMoment | null {
  if (turn.speaker !== "agent") return null;
  if (turn.action === "intro") return "opening";
  if (turn.action !== "move_on") return null;
  if (next.done) return "done";
  return next.kind === "code" ? "nextCode" : "nextQuestion";
}
