import { Prisma } from "@prisma/client";
import { appliedEngineeringAssessmentReportSchema } from "@/lib/practice/applied-engineering/assessment-contracts";
import { selectedAppliedEngineeringIncidentSchema } from "@/lib/practice/applied-engineering/incident-contracts";
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
  questions: { select: { status: true } },
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
