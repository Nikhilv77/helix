import { Prisma } from "@prisma/client";
import { appliedEngineeringAssessmentReportSchema } from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { selectedAppliedEngineeringIncidentSchema } from "@/features/practice/applied-engineering/domain/incident-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AppliedEngineeringPracticeService } from "./practice.service";

const historySelect = {
  id: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  incidentSnapshot: true,
  preparedAt: true,
  assessedAt: true,
  questions: { orderBy: { order: "asc" as const }, select: { id: true, order: true, status: true } },
  assessment: {
    select: {
      id: true,
      status: true,
      report: { select: { reportSnapshot: true } }
    }
  }
} satisfies Prisma.AppliedEngineeringBlockSelect;

/** Owner-scoped history reads use only immutable incident snapshots. */
export class AppliedEngineeringHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practice: Pick<AppliedEngineeringPracticeService, "historyBlock">
  ) {}

  async list(ownerId: string) {
    const blocks = await this.prisma.appliedEngineeringBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: historySelect
    });
    return blocks.map((block) => {
      const report = block.assessment?.report
        ? appliedEngineeringAssessmentReportSchema.parse(block.assessment.report.reportSnapshot)
        : null;
      return {
        id: block.id,
        ordinal: block.ordinal,
        isCurrent: block.isCurrent,
        status: block.status,
        incident: selectedAppliedEngineeringIncidentSchema.parse(block.incidentSnapshot),
        completedQuestionCount: block.questions.filter(({ status }) => status === "COMPLETED").length,
        learnedQuestionCount: block.questions.filter(({ status }) => status === "LEARNED").length,
        // Question links for a started library path that is not the current block.
        questions: block.questions.map(({ id, order, status }) => ({ id, order, status })),
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

export type AppliedEngineeringHistoryList = Awaited<ReturnType<AppliedEngineeringHistoryService["list"]>>;
export type AppliedEngineeringHistorySummary = AppliedEngineeringHistoryList[number];
