import { Prisma } from "@prisma/client";
import { coreTechnicalAssessmentReportSchema } from "@/lib/practice/core-technical/assessment-contracts";
import { selectedStorySchema } from "@/lib/practice/core-technical/story-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import type { CoreTechnicalPracticeService } from "./practice.service";

const historySelect = {
  id: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  storySnapshot: true,
  preparedAt: true,
  assessedAt: true,
  questions: { select: { status: true } },
  assessment: {
    select: {
      id: true,
      status: true,
      report: { select: { reportSnapshot: true } }
    }
  }
} satisfies Prisma.CoreTechnicalBlockSelect;

/** Snapshot-only owner history. It never joins mutable story catalogue content. */
export class CoreTechnicalHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practice: Pick<CoreTechnicalPracticeService, "historyBlock">
  ) {}

  async list(ownerId: string) {
    const blocks = await this.prisma.coreTechnicalBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: historySelect
    });
    return blocks.map((block) => {
      const report = block.assessment?.report
        ? coreTechnicalAssessmentReportSchema.parse(block.assessment.report.reportSnapshot)
        : null;
      return {
        id: block.id,
        ordinal: block.ordinal,
        isCurrent: block.isCurrent,
        status: block.status,
        story: selectedStorySchema.parse(block.storySnapshot),
        completedQuestionCount: block.questions.filter(({ status }) => status === "COMPLETED").length,
        learnedQuestionCount: block.questions.filter(({ status }) => status === "LEARNED").length,
        assessment: block.assessment
          ? {
              id: block.assessment.id,
              status: block.assessment.status,
              overallScore: report?.overallScore ?? null
            }
          : null,
        preparedAt: block.preparedAt.toISOString(),
        assessedAt: block.assessedAt?.toISOString() ?? null
      };
    });
  }

  read(ownerId: string, blockId: string) {
    return this.practice.historyBlock(ownerId, blockId);
  }
}

export type CoreTechnicalHistoryList = Awaited<
  ReturnType<CoreTechnicalHistoryService["list"]>
>;
export type CoreTechnicalHistorySummary = CoreTechnicalHistoryList[number];
