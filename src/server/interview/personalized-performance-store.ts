import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION,
  parseCandidatePerformanceProfile,
  type CandidatePerformanceProfile
} from "@/lib/interviews/performance-profile";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import type { PrismaService } from "../database/prisma.service";
import {
  aggregateCandidatePerformanceProfile,
  completedAdaptiveSessions,
  performanceSourceFingerprint
} from "./performance-profile-aggregator";
import type { InterviewState } from "./types";

/** Persists immutable aggregates from personalized, DSA, and behavioral sessions. */
export class PersonalizedPerformanceStore {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(ownerId: string, now = Date.now()): Promise<CandidatePerformanceProfile | null> {
    const records = await this.prisma.interviewSession.findMany({
      where: { ownerId },
      orderBy: { startedAt: "desc" },
      take: 100
    });
    const sessions = completedAdaptiveSessions(
      records.map((record) => ({
        state: record.state as unknown as InterviewState,
        touchedAt: record.touchedAt.getTime()
      }))
    );
    if (!sessions.length) return null;

    const sourceSessionFingerprint = performanceSourceFingerprint(sessions);
    const existing = await this.prisma.candidatePerformanceProfileVersion.findUnique({
      where: {
        ownerId_sourceSessionFingerprint_schemaVersion: {
          ownerId,
          sourceSessionFingerprint,
          schemaVersion: CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION
        }
      }
    });
    if (existing) return performanceFromRecord(existing);

    try {
      const stored = await this.prisma.$transaction(async (transaction) => {
        const duplicate = await transaction.candidatePerformanceProfileVersion.findUnique({
          where: {
            ownerId_sourceSessionFingerprint_schemaVersion: {
              ownerId,
              sourceSessionFingerprint,
              schemaVersion: CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION
            }
          }
        });
        if (duplicate) return duplicate;

        const latest = await transaction.candidatePerformanceProfileVersion.findFirst({
          where: { ownerId },
          orderBy: { revision: "desc" },
          select: { revision: true }
        });
        const profile = aggregateCandidatePerformanceProfile({
          id: randomUUID(),
          revision: (latest?.revision ?? 0) + 1,
          sessions,
          generatedAt: now,
          sourceSessionFingerprint
        });
        if (!profile) return null;

        return transaction.candidatePerformanceProfileVersion.create({
          data: {
            id: profile.id,
            ownerId,
            revision: profile.revision,
            schemaVersion: profile.schemaVersion,
            sourceSessionFingerprint: profile.sourceSessionFingerprint,
            completedSessionCount: profile.completedSessionCount,
            answeredQuestionCount: profile.answeredQuestionCount,
            profile: toJson(profile),
            generatedAt: new Date(profile.generatedAt)
          }
        });
      });
      return stored ? performanceFromRecord(stored) : null;
    } catch (error) {
      // Concurrent roadmap reads can aggregate the same completed sessions.
      // The fingerprint constraint chooses a winner; reuse that immutable row.
      const winner = await this.prisma.candidatePerformanceProfileVersion
        .findUnique({
          where: {
            ownerId_sourceSessionFingerprint_schemaVersion: {
              ownerId,
              sourceSessionFingerprint,
              schemaVersion: CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION
            }
          }
        })
        .catch(() => null);
      if (winner) return performanceFromRecord(winner);
      throw error;
    }
  }

  async latest(ownerId: string): Promise<CandidatePerformanceProfile | null> {
    const stored = await this.prisma.candidatePerformanceProfileVersion.findFirst({
      where: { ownerId },
      orderBy: { revision: "desc" }
    });
    return stored ? performanceFromRecord(stored) : null;
  }
}

function performanceFromRecord(record: {
  id: string;
  revision: number;
  schemaVersion: number;
  sourceSessionFingerprint: string;
  completedSessionCount: number;
  answeredQuestionCount: number;
  profile: Prisma.JsonValue;
  generatedAt: Date;
}): CandidatePerformanceProfile {
  const profile = parseCandidatePerformanceProfile(record.profile);
  if (
    profile.id !== record.id ||
    profile.revision !== record.revision ||
    profile.schemaVersion !== record.schemaVersion ||
    profile.sourceSessionFingerprint !== record.sourceSessionFingerprint ||
    profile.completedSessionCount !== record.completedSessionCount ||
    profile.answeredQuestionCount !== record.answeredQuestionCount ||
    profile.generatedAt !== record.generatedAt.getTime()
  ) {
    throw new ConflictErrorException(
      "PERFORMANCE_PROFILE_SNAPSHOT_MISMATCH",
      "Stored performance metadata does not match its immutable snapshot.",
      { performanceProfileVersionId: record.id }
    );
  }
  return profile;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
