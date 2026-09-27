import { randomUUID } from "node:crypto";
import { Prisma, ResumeRoastStatus } from "@prisma/client";
import { z } from "zod";
import {
  ResumeRoastResultSchema,
  ResumeRoastTargetSchema,
  type ResumeRoastResult,
  type ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import type { PrismaService } from "@/server/database/prisma.service";
import { NotificationKind } from "@/features/notifications/server/notification.service";

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
  resumeFileName?: string | null;
};

export interface ResumeRoastGeneration {
  roastId: string;
  generationToken: string;
}

/** A generation another request (tab, refresh, retry) already has running. */
export interface ActiveResumeRoastGeneration {
  roastId: string;
  target: ResumeRoastTarget;
  startedAt: Date;
}

export type CreateResumeRoastGenerationResult =
  | ({ kind: "created" } & ResumeRoastGeneration)
  | { kind: "conflict" };

export type ResumeRoastGenerationStatus =
  | { status: "generating"; target: ResumeRoastTarget; startedAt: Date }
  | { status: "ready"; roast: StoredResumeRoast }
  | { status: "failed" };

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

  async countReady(ownerId: string): Promise<number> {
    return this.prisma.resumeRoast.count({
      where: { ownerId, status: ResumeRoastStatus.READY }
    });
  }

  async latestReadyAt(ownerId: string): Promise<Date | null> {
    const latest = await this.prisma.resumeRoast.findFirst({
      where: { ownerId, status: ResumeRoastStatus.READY },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    });
    return latest?.updatedAt ?? null;
  }

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

  async getLatestReady(
    ownerId: string,
    resumeProfileVersionId: string
  ): Promise<StoredResumeRoast | null> {
    const parsedOwnerId = z.string().trim().min(1).max(191).parse(ownerId);
    const record = await this.prisma.resumeRoast.findFirst({
      where: {
        ownerId: parsedOwnerId,
        resumeProfileVersionId,
        status: ResumeRoastStatus.READY
      },
      orderBy: { createdAt: "desc" }
    });
    return record ? readyFromRecord(record) : null;
  }

  async getReadyHistory(ownerId: string): Promise<StoredResumeRoast[]> {
    const parsedOwnerId = z.string().trim().min(1).max(191).parse(ownerId);
    const records = await this.prisma.resumeRoast.findMany({
      where: { ownerId: parsedOwnerId, status: ResumeRoastStatus.READY },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        resumeProfileVersion: { select: { resumeFileName: true } }
      }
    });
    return records.flatMap((record) => {
      const parsed = readyFromRecord(record);
      return parsed
        ? [{ ...parsed, resumeFileName: record.resumeProfileVersion.resumeFileName }]
        : [];
    });
  }

  /**
   * A partial unique index allows one GENERATING row per owner, so a second
   * tab or a double submit gets `conflict` and joins the running roast.
   */
  async createGeneration(input: CreateResumeRoastInput): Promise<CreateResumeRoastGenerationResult> {
    const parsed = parseCreateInput(input);
    const generationToken = randomUUID();
    try {
      const created = await this.prisma.resumeRoast.create({
        data: {
          ...parsed,
          status: ResumeRoastStatus.GENERATING,
          generationToken
        },
        select: { id: true }
      });
      return { kind: "created", roastId: created.id, generationToken };
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) return { kind: "conflict" };
      throw error;
    }
  }

  async getActiveGeneration(
    ownerId: string,
    startedAfter: Date
  ): Promise<ActiveResumeRoastGeneration | null> {
    const record = await this.prisma.resumeRoast.findFirst({
      where: { ownerId, status: ResumeRoastStatus.GENERATING, createdAt: { gt: startedAfter } },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true, companyEnvironment: true, level: true, createdAt: true }
    });
    return record
      ? { roastId: record.id, target: parseTarget(record), startedAt: record.createdAt }
      : null;
  }

  /**
   * A function killed mid-generation (deploy, crash, hard timeout) leaves its
   * row GENERATING. Anything older than the generation budget can't finish.
   */
  async failStaleGenerations(ownerId: string, startedBefore: Date): Promise<number> {
    const updated = await this.prisma.resumeRoast.updateMany({
      where: { ownerId, status: ResumeRoastStatus.GENERATING, createdAt: { lte: startedBefore } },
      data: { status: ResumeRoastStatus.FAILED, generationToken: null, result: Prisma.DbNull }
    });
    return updated.count;
  }

  async getGenerationStatus(
    ownerId: string,
    roastId: string,
    startedAfter: Date
  ): Promise<ResumeRoastGenerationStatus | null> {
    const record = await this.prisma.resumeRoast.findFirst({ where: { id: roastId, ownerId } });
    if (!record) return null;
    if (record.status === ResumeRoastStatus.GENERATING) {
      return record.createdAt > startedAfter
        ? { status: "generating", target: parseTarget(record), startedAt: record.createdAt }
        : { status: "failed" };
    }
    const ready = readyFromRecord(record);
    return ready ? { status: "ready", roast: ready } : { status: "failed" };
  }

  /**
   * The newest saved scorecard for this exact resume version, target and
   * rubric. Reusing it keeps a re-roast's score identical to the first one.
   */
  async getReusableAssessment(
    ownerId: string,
    resumeProfileVersionId: string,
    target: ResumeRoastTarget,
    rubricVersion: string
  ): Promise<Pick<ResumeRoastResult, "scorecard" | "verdict"> | null> {
    const records = await this.prisma.resumeRoast.findMany({
      where: {
        ownerId,
        resumeProfileVersionId,
        status: ResumeRoastStatus.READY,
        role: target.role,
        companyEnvironment: target.companyEnvironment,
        level: target.level
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { result: true }
    });
    for (const record of records) {
      const result = parseStoredResult(record.result);
      if (result?.scorecard?.rubricVersion === rubricVersion) {
        return { scorecard: result.scorecard, verdict: result.verdict };
      }
    }
    return null;
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
          body: parsed.scorecard
            ? `James scored it ${parsed.scorecard.overall}/10 for your target. Open it to see what to fix first.`
            : `Your target-fit score is ${parsed.verdict.targetFitScore ?? 0}/100. Open the analysis to see James’s feedback.`,
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

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function toJson(value: ResumeRoastResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
