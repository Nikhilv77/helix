import { Injectable } from "@nestjs/common";
import { DesignSession, DesignSessionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CreateDesignSessionDto } from "./dto/create-design-session.dto";
import { UpdateDesignSessionDto } from "./dto/update-design-session.dto";
import { CapacityCalculatorOutput } from "../tools/capacity-calculator/capacity-calculator.schema";
import { ArchitectureDiagram } from "./architecture-diagram.schema";
import { PersistedDesignValidation } from "./design-validation.schema";
import { RequirementAnalysis, StoredClarificationAnswer } from "./requirement-analysis.schema";
import { GeneratedSystemDesign } from "./system-design.schema";

@Injectable()
export class DesignSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(projectId: string, data: CreateDesignSessionDto): Promise<DesignSession> {
    return this.prisma.designSession.create({
      data: {
        projectId,
        title: data.title,
        problemStatement: data.problemStatement
      }
    });
  }

  findManyByProject(projectId: string): Promise<DesignSession[]> {
    return this.prisma.designSession.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }

  findById(id: string, ownerId?: string): Promise<DesignSession | null> {
    if (!ownerId) {
      return this.prisma.designSession.findUnique({
        where: { id }
      });
    }

    return this.prisma.designSession.findFirst({
      where: {
        id,
        project: {
          ownerId
        }
      }
    });
  }

  update(id: string, data: UpdateDesignSessionDto): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data
    });
  }

  async beginRequirementAnalysis(
    id: string,
    expectedStatus: DesignSessionStatus | DesignSessionStatus[],
    clarificationAnswers?: StoredClarificationAnswer[]
  ): Promise<DesignSession | null> {
    const result = await this.prisma.designSession.updateMany({
      where: {
        id,
        status: Array.isArray(expectedStatus) ? { in: expectedStatus } : expectedStatus
      },
      data: {
        status: DesignSessionStatus.GENERATING,
        currentStep: "requirements_analysis",
        clarificationAnswers: clarificationAnswers
          ? (clarificationAnswers as Prisma.InputJsonValue)
          : undefined,
        failureCode: null,
        failureMessage: null
      }
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  saveRequirementAnalysis(
    id: string,
    analysis: RequirementAnalysis,
    status: DesignSessionStatus
  ): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        requirementAnalysis: analysis,
        requirementsAnalyzedAt: new Date(),
        status,
        currentStep: null,
        failureCode: null,
        failureMessage: null
      }
    });
  }

  saveRequirementAnalysisFailure(
    id: string,
    failureCode: string,
    failureMessage: string
  ): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        status: DesignSessionStatus.FAILED,
        currentStep: null,
        failureCode,
        failureMessage
      }
    });
  }

  saveCapacityCalculation(
    id: string,
    calculation: CapacityCalculatorOutput
  ): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        capacityCalculation: calculation,
        capacityCalculatedAt: new Date(),
        status: DesignSessionStatus.READY_FOR_DESIGN,
        currentStep: null,
        failureCode: null,
        failureMessage: null
      }
    });
  }

  async beginDesignGeneration(id: string): Promise<DesignSession | null> {
    const result = await this.prisma.designSession.updateMany({
      where: {
        id,
        status: {
          in: [DesignSessionStatus.READY_FOR_DESIGN, DesignSessionStatus.FAILED]
        }
      },
      data: {
        status: DesignSessionStatus.GENERATING,
        currentStep: "design_generation",
        failureCode: null,
        failureMessage: null,
        startedAt: new Date(),
        completedAt: null
      }
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  saveGeneratedDesign(id: string, design: GeneratedSystemDesign): Promise<DesignSession> {
    const completedAt = new Date();

    return this.prisma.designSession.update({
      where: { id },
      data: {
        generatedDesign: design,
        designGeneratedAt: completedAt,
        status: DesignSessionStatus.COMPLETED,
        currentStep: null,
        failureCode: null,
        failureMessage: null,
        completedAt
      }
    });
  }

  saveDesignGenerationFailure(
    id: string,
    failureCode: string,
    failureMessage: string
  ): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        status: DesignSessionStatus.FAILED,
        currentStep: null,
        failureCode,
        failureMessage,
        completedAt: null
      }
    });
  }

  saveArchitectureDiagram(id: string, diagram: ArchitectureDiagram): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        architectureDiagram: diagram,
        diagramGeneratedAt: new Date()
      }
    });
  }

  saveDesignValidation(id: string, validation: PersistedDesignValidation): Promise<DesignSession> {
    return this.prisma.designSession.update({
      where: { id },
      data: {
        designValidation: validation,
        designValidatedAt: new Date()
      }
    });
  }

  delete(id: string): Promise<DesignSession> {
    return this.prisma.designSession.delete({
      where: { id }
    });
  }
}
