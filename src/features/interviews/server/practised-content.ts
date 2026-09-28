import { getPrismaService } from "@/server/database/prisma.service";

/**
 * What a learner has already worked through in Practice, so an interview can
 * ask something they have not rehearsed. Both lookups are best effort: a
 * failed read only means the round may repeat practised content.
 */

/** AI/ML Core Technical practice questions the learner opened, as `ai-ml-core-N` keys. */
export async function practisedAiMlCoreQuestionKeys(ownerId: string): Promise<Set<string>> {
  try {
    const rows = await getPrismaService().aiMlPracticeQuestion.findMany({
      where: {
        ownerId,
        questionKey: { startsWith: "ai-ml-core-" },
        OR: [{ completedAt: { not: null } }, { learnedAt: { not: null } }]
      },
      select: { questionKey: true }
    });
    return new Set(rows.map((row) => row.questionKey));
  } catch {
    return new Set();
  }
}

/** Architecture & Design practice scenarios the learner has started. */
export async function practisedArchitectureScenarioKeys(ownerId: string): Promise<string[]> {
  try {
    const rows = await getPrismaService().architectureScenarioProgress.findMany({
      where: { ownerId, startedAt: { not: null } },
      select: { scenarioKey: true }
    });
    return rows.map((row) => row.scenarioKey);
  } catch {
    return [];
  }
}
