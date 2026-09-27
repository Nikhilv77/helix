import { appliedEngineeringAssessmentSnapshotSchema } from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { appliedEngineeringQuestionSchema } from "@/features/practice/applied-engineering/domain/question-contracts";
import {
  buildRecallQuiz,
  type RecallQuizItem,
  type RecallQuizSource
} from "@/features/practice/shared/domain/recall-quiz";
import type { PrismaService } from "@/server/database/prisma.service";

/**
 * The unscored recall check for an Applied Engineering assessment room. It
 * reads the finished practice block, leaves out every question the assessment
 * prompts are graded against, and returns nothing on any mismatch, so a
 * failure only hides the panel.
 */
export async function loadAppliedEngineeringRecallQuiz(
  prisma: PrismaService,
  ownerId: string,
  sessionId: string
): Promise<RecallQuizItem[]> {
  const assessment = await prisma.appliedEngineeringAssessment.findFirst({
    where: { id: sessionId, ownerId },
    select: {
      assessmentSnapshot: true,
      block: {
        select: {
          questions: {
            where: { status: { in: ["COMPLETED", "LEARNED"] } },
            select: { id: true, order: true, privateSnapshot: true }
          }
        }
      }
    }
  });
  if (!assessment?.assessmentSnapshot) return [];

  const snapshot = appliedEngineeringAssessmentSnapshotSchema.safeParse(
    assessment.assessmentSnapshot
  );
  if (!snapshot.success) return [];
  const graded = new Set(
    snapshot.data.prompts.map((prompt) => prompt.privateEvaluation.sourceQuestionId)
  );

  const sources: RecallQuizSource[] = [];
  for (const row of assessment.block.questions) {
    const parsed = appliedEngineeringQuestionSchema.safeParse(row.privateSnapshot);
    if (!parsed.success) continue;
    const question = parsed.data;
    sources.push({
      id: row.id,
      order: row.order,
      prompt: question.prompt,
      choices: question.format === "mcq" ? question.choices : undefined,
      correctChoiceIndex: question.format === "mcq" ? question.answer.correctChoiceIndex : undefined,
      concise: question.answer.concise,
      explanation: question.answer.explanation
    });
  }
  return buildRecallQuiz(sources, graded);
}
