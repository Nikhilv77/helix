import { Prisma } from "@prisma/client";
import { architectureDesignAssessmentReportSchema } from "@/features/practice/architecture-design/domain/assessment-contracts";
import { architectureDesignScenarioSelectionSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignScenarioSchema } from "@/features/practice/architecture-design/domain/scenario-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import type { ArchitectureDesignPracticeService } from "./practice.service";

const historySelect = {
  id: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  selectionSnapshot: true,
  scenarioSnapshot: true,
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
} satisfies Prisma.ArchitectureBlockSelect;

/** Owner-scoped history reads only immutable block snapshots, never the live catalogue. */
export class ArchitectureDesignHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practice: Pick<ArchitectureDesignPracticeService, "historyBlock">
  ) {}

  async list(ownerId: string) {
    const blocks = await this.prisma.architectureBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: historySelect
    });
    return blocks.map((block) => {
      const report = block.assessment?.report
        ? architectureDesignAssessmentReportSchema.parse(block.assessment.report.reportSnapshot)
        : null;
      return {
        id: block.id,
        ordinal: block.ordinal,
        isCurrent: block.isCurrent,
        status: block.status,
        difficulty: architectureDesignScenarioSelectionSchema.parse(block.selectionSnapshot)
          .selectedScenario.difficulty,
        scenario: architectureDesignScenarioSchema.parse(block.scenarioSnapshot),
        completedQuestionCount: block.questions.filter(({ status }) => status === "COMPLETED")
          .length,
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

export type ArchitectureDesignHistoryList = Awaited<
  ReturnType<ArchitectureDesignHistoryService["list"]>
>;
export type ArchitectureDesignHistorySummary = ArchitectureDesignHistoryList[number];
