import { randomUUID } from "node:crypto";
import { Prisma, ResumeRoastStatus } from "@prisma/client";
import { z } from "zod";
import {
  ResumeRoastResultSchema,
  ResumeRoastTargetSchema,
  type ResumeRoastResult,
  type ResumeRoastTarget
} from "@/lib/resume-roast/contracts";
import type { PrismaService } from "../database/prisma.service";
import { NotificationKind } from "../notifications/notification.service";

const RoastMetadataSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(191),
    resumeProfileVersionId: z.string().uuid(),
    promptVersion: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9._-]+$/)
  })
  .strict();

export type CreateResumeRoastInput = ResumeRoastTarget & {
  ownerId: string;
  resumeProfileVersionId: string;
  promptVersion: string;
};

export type StoredResumeRoast = CreateResumeRoastInput & {
  id: string;
  status: "READY";
  result: ResumeRoastResult;
  createdAt: Date;
  updatedAt: Date;
};

export interface ResumeRoastGeneration {
  roastId: string;
  generationToken: string;
}

type RoastRecord = {
  id: string;
  ownerId: string;
  resumeProfileVersionId: string;
  role: string;
  companyEnvironment: string;
  level: string;
  promptVersion: string;
  status: ResumeRoastStatus;
  generationToken: string | null;
  result: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Owner-scoped append-only persistence for Resume Roast history. */
export class ResumeRoastStore {
  constructor(private readonly prisma: PrismaService) {}

  async getTarget(ownerId: string): Promise<ResumeRoastTarget | null> {
    const target = await this.prisma.resumeRoastTarget.findUnique({ where: { ownerId } });
    return target ? parseTarget(target) : null;
  }

  async saveTarget(ownerId: string, target: ResumeRoastTarget): Promise<ResumeRoastTarget> {
    const parsed = ResumeRoastTargetSchema.parse(target);
    const stored = await this.prisma.resumeRoastTarget.upsert({
      where: { ownerId },
      create: { ownerId, ...parsed },
      update: parsed
    });
    return parseTarget(stored);
  }

  async getLatestReady(ownerId: string): Promise<StoredResumeRoast | null> {
    const parsedOwnerId = z.string().trim().min(1).max(191).parse(ownerId);
    const record = await this.prisma.resumeRoast.findFirst({
      where: { ownerId: parsedOwnerId, status: ResumeRoastStatus.READY },
      orderBy: { createdAt: "desc" }
    });
    return record ? readyFromRecord(record) : null;
  }

  async createGeneration(input: CreateResumeRoastInput): Promise<ResumeRoastGeneration> {
    const parsed = parseCreateInput(input);
    const generationToken = randomUUID();
    const created = await this.prisma.resumeRoast.create({
      data: {
        ...parsed,
        status: ResumeRoastStatus.GENERATING,
        generationToken
      }
    });
    return { roastId: created.id, generationToken };
  }

  async complete(
    ownerId: string,
    roastId: string,
    generationToken: string,
    result: ResumeRoastResult
  ): Promise<boolean> {
    const parsed = ResumeRoastResultSchema.parse(result);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.resumeRoast.updateMany({
        where: {
          id: roastId,
          ownerId,
          generationToken,
          status: ResumeRoastStatus.GENERATING
        },
        data: {
          status: ResumeRoastStatus.READY,
          generationToken: null,
          result: toJson(parsed)
        }
      });
      if (updated.count !== 1) return false;

      await transaction.notification.createMany({
        data: {
          ownerId,
          kind: NotificationKind.RESUME_ROAST_COMPLETED,
          title: "James has analysed your resume",
          body: `Your target-fit score is ${parsed.verdict.targetFitScore}/100. Open the analysis to see James’s feedback.`,
          href: "/resume-roast",
          subjectId: roastId
        },
        skipDuplicates: true
      });
      return true;
    });
  }

  async fail(ownerId: string, roastId: string, generationToken: string): Promise<boolean> {
    const updated = await this.prisma.resumeRoast.updateMany({
      where: {
        id: roastId,
        ownerId,
        generationToken,
        status: ResumeRoastStatus.GENERATING
      },
      data: {
        status: ResumeRoastStatus.FAILED,
        generationToken: null,
        result: Prisma.DbNull
      }
    });
    return updated.count === 1;
  }

  async delete(ownerId: string, roastId: string): Promise<boolean> {
    const deleted = await this.prisma.resumeRoast.deleteMany({ where: { id: roastId, ownerId } });
    return deleted.count === 1;
  }
}

function parseCreateInput(input: CreateResumeRoastInput): CreateResumeRoastInput {
  const target = ResumeRoastTargetSchema.parse({
    role: input.role,
    companyEnvironment: input.companyEnvironment,
    level: input.level
  });
  const metadata = RoastMetadataSchema.parse({
    ownerId: input.ownerId,
    resumeProfileVersionId: input.resumeProfileVersionId,
    promptVersion: input.promptVersion
  });
  return {
    ...metadata,
    ...target
  };
}

function parseTarget(target: unknown): ResumeRoastTarget {
  if (!target || typeof target !== "object") return ResumeRoastTargetSchema.parse(target);
  const candidate = target as Record<string, unknown>;
  return ResumeRoastTargetSchema.parse({
    role: candidate.role,
    companyEnvironment: candidate.companyEnvironment,
    level: candidate.level
  });
}

function readyFromRecord(record: RoastRecord): StoredResumeRoast | null {
  if (record.status !== ResumeRoastStatus.READY || record.result === null) return null;
  const result = parseStoredResult(record.result);
  if (!result) return null;
  return {
    id: record.id,
    ownerId: record.ownerId,
    resumeProfileVersionId: record.resumeProfileVersionId,
    role: record.role as ResumeRoastTarget["role"],
    companyEnvironment: record.companyEnvironment as ResumeRoastTarget["companyEnvironment"],
    level: record.level as ResumeRoastTarget["level"],
    promptVersion: record.promptVersion,
    status: "READY",
    result,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function parseStoredResult(result: Prisma.JsonValue | null): ResumeRoastResult | null {
  if (result === null) return null;
  const parsed = ResumeRoastResultSchema.safeParse(result);
  return parsed.success ? parsed.data : null;
}

function toJson(value: ResumeRoastResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
