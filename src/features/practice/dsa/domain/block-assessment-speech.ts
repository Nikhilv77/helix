import type { InterviewQuestionKind, Turn } from "@/lib/shared/types";
import type { TEACHER_LINES } from "@/lib/voice/teacher-lines";

export type BlockAssessmentMoment = keyof typeof TEACHER_LINES.blockAssessment;

/**
 * Which pre-recorded line the teacher says for the latest guidance turn. The
 * turn's full text (feedback, explanation, next question) stays on screen;
 * speech only gives the verdict and where things go next. Returns null for a
 * turn this does not recognise, which is then read in full.
 *
 * `next` describes the session as it is now, so this is only meaningful for
 * the most recent teacher turn.
 */
export function blockAssessmentMoment(
  turns: readonly Turn[],
  turnIndex: number,
  next: { done: boolean; kind: InterviewQuestionKind | null }
): BlockAssessmentMoment | null {
  const turn = turns[turnIndex];
  if (!turn || turn.speaker !== "agent") return null;
  const answer = turns
    .slice(0, turnIndex)
    .reverse()
    .find((candidate) => candidate.speaker === "user");
  if (!answer) return "opening";
  if (next.done) return "done";
  if (typeof turn.correct === "boolean") {
    if (next.kind === "code") return turn.correct ? "reviewCorrectToCode" : "reviewIncorrectToCode";
    return turn.correct ? "reviewCorrectNext" : "reviewIncorrectNext";
  }
  if (next.kind === "code") return answer.skipped ? "codeSkippedNext" : "codeNext";
  return null;
}
