import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "@/server/database/prisma.service";
import type { InterviewReport } from "@/lib/shared/types";
import {
  createInterviewReportSnapshot,
  readInterviewReportSnapshot,
  type InterviewReportSnapshot
} from "./report";
import { SESSION_TTL_MS } from "./session-constants";
import type { InterviewAnswerResponse, InterviewState } from "./types";
import type { EvaluationRecoveryMutation } from "./evaluation-recovery";
import { evaluationProfileForSetup } from "@/features/interviews/domain/evaluation-profile";
import { NotificationKind } from "@/features/notifications/server/notification.service";
import type {
  SystemDesignCanvasDocument,
  VersionedSystemDesignCanvas
} from "@/features/interviews/domain/system-design-canvas";

const ANSWER_LEASE_MS = 20_000;
const ANSWER_PROCESSING = "PROCESSING";
const ANSWER_COMPLETED = "COMPLETED";
const ANSWER_FAILED = "FAILED";
const ANSWER_CONFLICTED = "CONFLICTED";

export class SessionVersionConflictError extends Error {
  constructor(readonly sessionId: string) {
    super(`Interview session ${sessionId} changed before it could be saved`);
    this.name = SessionVersionConflictError.name;
  }
}

export class DesignCanvasVersionConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly current: VersionedSystemDesignCanvas
  ) {
    super(`System design canvas ${sessionId} changed before it could be saved`);
    this.name = DesignCanvasVersionConflictError.name;
  }
}

export type BeginAnswerResult =
  | { status: "claimed" }
  | { status: "completed"; response: InterviewAnswerResponse }
  | { status: "pending" }
  | { status: "conflicted" }
  | { status: "payload-mismatch" };

/** Shared contract for the in-memory test store and durable production store. */
export interface SessionStore {
  create(state: InterviewState, ownerId: string): Promise<void>;
  get(id: string): Promise<InterviewState | null>;
  getVersioned(id: string): Promise<VersionedInterviewSession | null>;
  /** Owner-scoped live-session read that also enforces the room TTL. */
  getActiveOwned(id: string, ownerId: string): Promise<InterviewState | null>;
  getActiveOwnedVersioned(id: string, ownerId: string): Promise<VersionedInterviewSession | null>;
  /** Durable owner-scoped read used by history and reports; does not enforce room TTL. */
  getOwned(id: string, ownerId: string): Promise<StoredInterviewSession | null>;
  /** Restores a deliberately resumable durable session to the live-room window. */
  reactivateOwned(id: string, ownerId: string): Promise<VersionedInterviewSession | null>;
  listByOwner(ownerId: string, limit: number): Promise<StoredInterviewSession[]>;
  /** Transcript-free read model used by the cross-session reports index. */
  listReportsByOwner(ownerId: string, limit: number, now?: number): Promise<InterviewReport[]>;
  /** Moves sessions proven by a signed anonymous-browser identity to its account. */
  reassignOwner(fromOwnerId: string, toOwnerId: string): Promise<number>;
  getDesignCanvas(sessionId: string, ownerId: string): Promise<VersionedSystemDesignCanvas | null>;
  saveDesignCanvas(
    sessionId: string,
    ownerId: string,
    document: SystemDesignCanvasDocument,
    expectedRevision: number
  ): Promise<VersionedSystemDesignCanvas>;
  save(
    state: InterviewState,
    expectedVersion: number,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number>;
  beginAnswer(
    sessionId: string,
    turnId: string,
    answerHash: string,
    now?: number
  ): Promise<BeginAnswerResult>;
  answerRequest(sessionId: string, turnId: string, answerHash: string): Promise<BeginAnswerResult>;
  completeAnswer(
    state: InterviewState,
    expectedVersion: number,
    turnId: string,
    response: InterviewAnswerResponse,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number>;
  failAnswer(sessionId: string, turnId: string): Promise<void>;
  conflictAnswer(sessionId: string, turnId: string): Promise<void>;
  /** Backs the "2 sessions per user per day" cap. */
  countStartedSince(ownerId: string, since: number): Promise<number>;
}

export { SESSION_TTL_MS } from "./session-constants";
/** Long enough to still enforce the daily cap after sessions themselves expire. */
const OWNER_HISTORY_TTL_MS = 25 * 60 * 60 * 1000;

interface StoredSession {
  state: InterviewState;
  ownerId: string;
  touchedAt: number;
  version: number;
}

export interface StoredInterviewSession {
  state: InterviewState;
  touchedAt: number;
}

export interface VersionedInterviewSession extends StoredInterviewSession {
  version: number;
}

interface MemoryAnswerRequest {
  answerHash: string;
  status: string;
  response?: InterviewAnswerResponse;
  leaseUntil: number;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly durableSessions = new Map<string, StoredSession>();
  private readonly answerRequests = new Map<string, MemoryAnswerRequest>();
  private readonly evaluationRecoveries = new Map<string, EvaluationRecoveryMutation>();
  private readonly designCanvases = new Map<string, VersionedSystemDesignCanvas>();
  /** Start times per owner, kept beyond session lifetime for the daily cap. */
  private readonly startsByOwner = new Map<string, number[]>();

  async create(state: InterviewState, ownerId: string): Promise<void> {
    this.evictExpired();
    const stored = { state, ownerId, touchedAt: Date.now(), version: 0 };
    this.sessions.set(state.id, stored);
    this.durableSessions.set(state.id, stored);

    const starts = this.startsByOwner.get(ownerId) ?? [];
    starts.push(state.startedAt);
    this.startsByOwner.set(ownerId, starts);
  }

  async get(id: string): Promise<InterviewState | null> {
    return (await this.getVersioned(id))?.state ?? null;
  }

  async getVersioned(id: string): Promise<VersionedInterviewSession | null> {
    const stored = this.sessions.get(id);
    if (!stored) return null;
    if (Date.now() - stored.touchedAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return null;
    }
    return storedView(stored);
  }

  async getActiveOwned(id: string, ownerId: string): Promise<InterviewState | null> {
    return (await this.getActiveOwnedVersioned(id, ownerId))?.state ?? null;
  }

  async getActiveOwnedVersioned(
    id: string,
    ownerId: string
  ): Promise<VersionedInterviewSession | null> {
    const stored = this.sessions.get(id);
    if (!stored || stored.ownerId !== ownerId) return null;

    if (Date.now() - stored.touchedAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return null;
    }

    return storedView(stored);
  }

  async getOwned(id: string, ownerId: string): Promise<StoredInterviewSession | null> {
    const stored = this.durableSessions.get(id);
    if (!stored || stored.ownerId !== ownerId) return null;
    return storedView(stored);
  }

  async reactivateOwned(id: string, ownerId: string): Promise<VersionedInterviewSession | null> {
    const stored = this.durableSessions.get(id);
    if (!stored || stored.ownerId !== ownerId) return null;

    const reactivated = { ...stored, touchedAt: Date.now() };
    this.durableSessions.set(id, reactivated);
    this.sessions.set(id, reactivated);
    return storedView(reactivated);
  }

  async listByOwner(ownerId: string, limit: number): Promise<StoredInterviewSession[]> {
    return [...this.durableSessions.values()]
      .filter((session) => session.ownerId === ownerId)
      .sort((left, right) => right.state.startedAt - left.state.startedAt)
      .slice(0, limit)
      .map(storedView);
  }

  async listReportsByOwner(
    ownerId: string,
    limit: number,
    now = Date.now()
  ): Promise<InterviewReport[]> {
    return (await this.listByOwner(ownerId, limit)).map((session) =>
      readInterviewReportSnapshot(
        createInterviewReportSnapshot(session, now),
        session.touchedAt,
        now
      )
    );
  }

  async reassignOwner(fromOwnerId: string, toOwnerId: string): Promise<number> {
    let moved = 0;
    for (const [id, stored] of this.durableSessions.entries()) {
      if (stored.ownerId !== fromOwnerId) continue;
      const updated = { ...stored, ownerId: toOwnerId };
      this.durableSessions.set(id, updated);
      if (this.sessions.has(id)) this.sessions.set(id, updated);
      moved += 1;
    }
    return moved;
  }

  async getDesignCanvas(
    sessionId: string,
    ownerId: string
  ): Promise<VersionedSystemDesignCanvas | null> {
    const session = this.durableSessions.get(sessionId);
    if (!session || session.ownerId !== ownerId) return null;
    return this.designCanvases.get(sessionId) ?? null;
  }

  async saveDesignCanvas(
    sessionId: string,
    ownerId: string,
    document: SystemDesignCanvasDocument,
    expectedRevision: number
  ): Promise<VersionedSystemDesignCanvas> {
    const session = this.durableSessions.get(sessionId);
    if (!session || session.ownerId !== ownerId) {
      throw new Error(`Interview session ${sessionId} was not found`);
    }
    const current = this.designCanvases.get(sessionId);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      throw new DesignCanvasVersionConflictError(
        sessionId,
        current ?? { document, revision: 0, updatedAt: session.touchedAt }
      );
    }
    const saved = { document, revision: expectedRevision + 1, updatedAt: Date.now() };
    this.designCanvases.set(sessionId, saved);
    return saved;
  }

  async save(
    state: InterviewState,
    expectedVersion: number,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number> {
    const stored = this.durableSessions.get(state.id);
    if (!stored || stored.version !== expectedVersion) {
      throw new SessionVersionConflictError(state.id);
    }
    const version = expectedVersion + 1;
    const updated = { ...stored, state, touchedAt: Date.now(), version };
    this.durableSessions.set(state.id, updated);
    if (this.sessions.has(state.id)) {
      this.sessions.set(state.id, updated);
    }
    this.recordEvaluationRecovery(state.id, evaluationRecovery);
    return version;
  }

  async beginAnswer(
    sessionId: string,
    turnId: string,
    answerHash: string,
    now = Date.now()
  ): Promise<BeginAnswerResult> {
    const key = answerRequestKey(sessionId, turnId);
    const existing = this.answerRequests.get(key);
    if (!existing) {
      this.answerRequests.set(key, {
        answerHash,
        status: ANSWER_PROCESSING,
        leaseUntil: now + ANSWER_LEASE_MS
      });
      return { status: "claimed" };
    }
    if (existing.answerHash !== answerHash) return { status: "payload-mismatch" };
    if (existing.status === ANSWER_COMPLETED && existing.response) {
      return { status: "completed", response: existing.response };
    }
    if (existing.status === ANSWER_CONFLICTED) return { status: "conflicted" };
    if (existing.status === ANSWER_FAILED || existing.leaseUntil <= now) {
      this.answerRequests.set(key, {
        answerHash,
        status: ANSWER_PROCESSING,
        leaseUntil: now + ANSWER_LEASE_MS
      });
      return { status: "claimed" };
    }
    return { status: "pending" };
  }

  async answerRequest(
    sessionId: string,
    turnId: string,
    answerHash: string
  ): Promise<BeginAnswerResult> {
    const existing = this.answerRequests.get(answerRequestKey(sessionId, turnId));
    return answerRequestResult(existing, answerHash);
  }

  async completeAnswer(
    state: InterviewState,
    expectedVersion: number,
    turnId: string,
    response: InterviewAnswerResponse,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number> {
    const key = answerRequestKey(state.id, turnId);
    const request = this.answerRequests.get(key);
    if (!request || request.status !== ANSWER_PROCESSING) {
      throw new Error("Interview answer request is not processing");
    }
    const version = await this.save(state, expectedVersion, evaluationRecovery);
    this.answerRequests.set(key, {
      ...request,
      status: ANSWER_COMPLETED,
      response,
      leaseUntil: Date.now()
    });
    return version;
  }

  async failAnswer(sessionId: string, turnId: string): Promise<void> {
    this.updateAnswerStatus(sessionId, turnId, ANSWER_FAILED);
  }

  async conflictAnswer(sessionId: string, turnId: string): Promise<void> {
    this.updateAnswerStatus(sessionId, turnId, ANSWER_CONFLICTED);
  }

  async countStartedSince(ownerId: string, since: number): Promise<number> {
    const starts = this.startsByOwner.get(ownerId) ?? [];
    return starts.filter((startedAt) => startedAt >= since).length;
  }

  private evictExpired(): void {
    const now = Date.now();

    for (const [id, stored] of this.sessions.entries()) {
      if (now - stored.touchedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }

    for (const [ownerId, starts] of this.startsByOwner.entries()) {
      const kept = starts.filter((startedAt) => now - startedAt < OWNER_HISTORY_TTL_MS);
      if (kept.length === 0) {
        this.startsByOwner.delete(ownerId);
      } else {
        this.startsByOwner.set(ownerId, kept);
      }
    }
  }

  private updateAnswerStatus(sessionId: string, turnId: string, status: string): void {
    const key = answerRequestKey(sessionId, turnId);
    const request = this.answerRequests.get(key);
    if (request?.status === ANSWER_PROCESSING) {
      this.answerRequests.set(key, { ...request, status, leaseUntil: Date.now() });
    }
  }

  /** Test seam for proving failed live evaluations are durably scheduled. */
  evaluationRecoveryCount(): number {
    return this.evaluationRecoveries.size;
  }

  private recordEvaluationRecovery(
    sessionId: string,
    mutation: EvaluationRecoveryMutation | undefined
  ): void {
    if (!mutation) return;
    const key = `${sessionId}:${mutation.action === "enqueue" ? mutation.payload.questionIndex : mutation.questionIndex}`;
    if (mutation.action === "resolve") this.evaluationRecoveries.delete(key);
    else this.evaluationRecoveries.set(key, mutation);
  }
}

/** Durable store used by Next.js and the remote voice worker in production. */
export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(state: InterviewState, ownerId: string): Promise<void> {
    const touchedAt = new Date();
    await this.prisma.interviewSession.create({
      data: {
        id: state.id,
        ownerId,
        state: toJson(state),
        reportSnapshot: toJsonValue(
          createInterviewReportSnapshot(
            { state, touchedAt: touchedAt.getTime() },
            touchedAt.getTime()
          )
        ),
        startedAt: new Date(state.startedAt),
        touchedAt
      }
    });
  }

  async get(id: string): Promise<InterviewState | null> {
    return (await this.getVersioned(id))?.state ?? null;
  }

  async getVersioned(id: string): Promise<VersionedInterviewSession | null> {
    const stored = await this.prisma.interviewSession.findUnique({ where: { id } });
    if (!stored) return null;

    if (Date.now() - stored.touchedAt.getTime() > SESSION_TTL_MS) {
      return null;
    }

    return prismaStoredView(stored);
  }

  async getActiveOwned(id: string, ownerId: string): Promise<InterviewState | null> {
    return (await this.getActiveOwnedVersioned(id, ownerId))?.state ?? null;
  }

  async getActiveOwnedVersioned(
    id: string,
    ownerId: string
  ): Promise<VersionedInterviewSession | null> {
    const stored = await this.prisma.interviewSession.findFirst({
      where: {
        id,
        ownerId,
        touchedAt: { gte: new Date(Date.now() - SESSION_TTL_MS) }
      }
    });
    return stored ? prismaStoredView(stored) : null;
  }

  async getOwned(id: string, ownerId: string): Promise<StoredInterviewSession | null> {
    const stored = await this.prisma.interviewSession.findFirst({ where: { id, ownerId } });
    if (!stored) return null;

    return {
      state: stored.state as unknown as InterviewState,
      touchedAt: stored.touchedAt.getTime()
    };
  }

  async reactivateOwned(id: string, ownerId: string): Promise<VersionedInterviewSession | null> {
    const reactivatedAt = new Date();
    const result = await this.prisma.interviewSession.updateMany({
      where: { id, ownerId },
      data: { touchedAt: reactivatedAt }
    });
    if (result.count !== 1) return null;

    const stored = await this.prisma.interviewSession.findFirst({ where: { id, ownerId } });
    return stored ? prismaStoredView(stored) : null;
  }

  async listByOwner(ownerId: string, limit: number): Promise<StoredInterviewSession[]> {
    const sessions = await this.prisma.interviewSession.findMany({
      where: { ownerId },
      orderBy: { startedAt: "desc" },
      take: limit
    });

    return sessions.map((session) => ({
      state: session.state as unknown as InterviewState,
      touchedAt: session.touchedAt.getTime()
    }));
  }

  async listReportsByOwner(
    ownerId: string,
    limit: number,
    now = Date.now()
  ): Promise<InterviewReport[]> {
    const rows = await this.prisma.interviewSession.findMany({
      where: { ownerId },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: { id: true, reportSnapshot: true, touchedAt: true }
    });
    const legacyIds = rows.filter((row) => row.reportSnapshot === null).map((row) => row.id);
    const legacyRows = legacyIds.length
      ? await this.prisma.interviewSession.findMany({
          where: { id: { in: legacyIds }, ownerId },
          select: { id: true, state: true, touchedAt: true }
        })
      : [];
    const legacySnapshots = new Map<string, InterviewReportSnapshot>();

    for (const row of legacyRows) {
      const snapshot = createInterviewReportSnapshot(
        {
          state: row.state as unknown as InterviewState,
          touchedAt: row.touchedAt.getTime()
        },
        now
      );
      legacySnapshots.set(row.id, snapshot);
    }

    if (legacySnapshots.size) {
      // Preserve touchedAt so backfilling an old report cannot revive an
      // expired interview room. Concurrent session writes win this race.
      await Promise.all(
        legacyRows.map((row) =>
          this.prisma.interviewSession.updateMany({
            where: { id: row.id, reportSnapshot: { equals: Prisma.DbNull } },
            data: {
              reportSnapshot: toJsonValue(legacySnapshots.get(row.id)),
              touchedAt: row.touchedAt
            }
          })
        )
      );
    }

    return rows.flatMap((row) => {
      const snapshot =
        (row.reportSnapshot as unknown as InterviewReportSnapshot | null) ??
        legacySnapshots.get(row.id);
      return snapshot ? [readInterviewReportSnapshot(snapshot, row.touchedAt.getTime(), now)] : [];
    });
  }

  async reassignOwner(fromOwnerId: string, toOwnerId: string): Promise<number> {
    const result = await this.prisma.interviewSession.updateMany({
      where: { ownerId: fromOwnerId },
      data: { ownerId: toOwnerId }
    });
    return result.count;
  }

  async getDesignCanvas(
    sessionId: string,
    ownerId: string
  ): Promise<VersionedSystemDesignCanvas | null> {
    const row = await this.prisma.interviewDesignCanvas.findFirst({
      where: { sessionId, session: { ownerId } }
    });
    return row
      ? {
          document: row.document as unknown as SystemDesignCanvasDocument,
          revision: row.revision,
          updatedAt: row.updatedAt.getTime()
        }
      : null;
  }

  async saveDesignCanvas(
    sessionId: string,
    ownerId: string,
    document: SystemDesignCanvasDocument,
    expectedRevision: number
  ): Promise<VersionedSystemDesignCanvas> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const session = await transaction.interviewSession.findFirst({
          where: { id: sessionId, ownerId },
          select: { id: true }
        });
        if (!session) throw new Error(`Interview session ${sessionId} was not found`);

        const current = await transaction.interviewDesignCanvas.findUnique({
          where: { sessionId }
        });
        if ((current?.revision ?? 0) !== expectedRevision) {
          throw new DesignCanvasVersionConflictError(
            sessionId,
            current
              ? {
                  document: current.document as unknown as SystemDesignCanvasDocument,
                  revision: current.revision,
                  updatedAt: current.updatedAt.getTime()
                }
              : { document, revision: 0, updatedAt: Date.now() }
          );
        }

        const saved = current
          ? await transaction.interviewDesignCanvas.update({
              where: { sessionId },
              data: { document: toJsonValue(document), revision: { increment: 1 } }
            })
          : await transaction.interviewDesignCanvas.create({
              data: { sessionId, document: toJsonValue(document), revision: 1 }
            });
        return {
          document: saved.document as unknown as SystemDesignCanvasDocument,
          revision: saved.revision,
          updatedAt: saved.updatedAt.getTime()
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await this.getDesignCanvas(sessionId, ownerId);
        if (current) throw new DesignCanvasVersionConflictError(sessionId, current);
      }
      throw error;
    }
  }

  async save(
    state: InterviewState,
    expectedVersion: number,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number> {
    const touchedAt = new Date();
    const reportSnapshot = createInterviewReportSnapshot(
      { state, touchedAt: touchedAt.getTime() },
      touchedAt.getTime()
    );
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.interviewSession.updateMany({
        where: { id: state.id, version: expectedVersion },
        data: {
          state: toJson(state),
          reportSnapshot: toJsonValue(reportSnapshot),
          touchedAt,
          version: { increment: 1 }
        }
      });
      if (result.count !== 1) throw new SessionVersionConflictError(state.id);
      await applyEvaluationRecoveryMutation(transaction, state.id, evaluationRecovery);
      await recordInterviewReportNotification(transaction, state, reportSnapshot);
    });
    return expectedVersion + 1;
  }

  async beginAnswer(
    sessionId: string,
    turnId: string,
    answerHash: string,
    now = Date.now()
  ): Promise<BeginAnswerResult> {
    const leaseUntil = new Date(now + ANSWER_LEASE_MS);
    const created = await this.prisma.interviewAnswerRequest.createMany({
      data: [
        { id: randomUUID(), sessionId, turnId, answerHash, status: ANSWER_PROCESSING, leaseUntil }
      ],
      skipDuplicates: true
    });
    if (created.count === 1) return { status: "claimed" };

    const existing = await this.prisma.interviewAnswerRequest.findUnique({
      where: { sessionId_turnId: { sessionId, turnId } }
    });
    const result = answerRequestResult(existing ?? undefined, answerHash);
    if (
      existing?.answerHash === answerHash &&
      (existing.status === ANSWER_FAILED ||
        (existing.status === ANSWER_PROCESSING && existing.leaseUntil.getTime() <= now))
    ) {
      const reclaimed = await this.prisma.interviewAnswerRequest.updateMany({
        where: {
          id: existing.id,
          answerHash,
          OR: [
            { status: ANSWER_FAILED },
            { status: ANSWER_PROCESSING, leaseUntil: { lte: new Date(now) } }
          ]
        },
        data: { status: ANSWER_PROCESSING, leaseUntil, response: Prisma.DbNull }
      });
      if (reclaimed.count === 1) return { status: "claimed" };
      return this.answerRequest(sessionId, turnId, answerHash);
    }
    return result;
  }

  async answerRequest(
    sessionId: string,
    turnId: string,
    answerHash: string
  ): Promise<BeginAnswerResult> {
    const existing = await this.prisma.interviewAnswerRequest.findUnique({
      where: { sessionId_turnId: { sessionId, turnId } }
    });
    return answerRequestResult(existing ?? undefined, answerHash);
  }

  async completeAnswer(
    state: InterviewState,
    expectedVersion: number,
    turnId: string,
    response: InterviewAnswerResponse,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<number> {
    const touchedAt = new Date();
    const reportSnapshot = createInterviewReportSnapshot(
      { state, touchedAt: touchedAt.getTime() },
      touchedAt.getTime()
    );
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.interviewSession.updateMany({
        where: { id: state.id, version: expectedVersion },
        data: {
          state: toJson(state),
          reportSnapshot: toJsonValue(reportSnapshot),
          touchedAt,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new SessionVersionConflictError(state.id);

      const completed = await transaction.interviewAnswerRequest.updateMany({
        where: { sessionId: state.id, turnId, status: ANSWER_PROCESSING },
        data: {
          status: ANSWER_COMPLETED,
          response: toJsonValue(response),
          leaseUntil: new Date()
        }
      });
      if (completed.count !== 1) throw new Error("Interview answer request is not processing");
      await applyEvaluationRecoveryMutation(transaction, state.id, evaluationRecovery);
      await recordInterviewReportNotification(transaction, state, reportSnapshot);
    });
    return expectedVersion + 1;
  }

  async failAnswer(sessionId: string, turnId: string): Promise<void> {
    await this.updateAnswerStatus(sessionId, turnId, ANSWER_FAILED);
  }

  async conflictAnswer(sessionId: string, turnId: string): Promise<void> {
    await this.updateAnswerStatus(sessionId, turnId, ANSWER_CONFLICTED);
  }

  async countStartedSince(ownerId: string, since: number): Promise<number> {
    return this.prisma.interviewSession.count({
      where: {
        ownerId,
        startedAt: { gte: new Date(since) }
      }
    });
  }

  private async updateAnswerStatus(
    sessionId: string,
    turnId: string,
    status: string
  ): Promise<void> {
    await this.prisma.interviewAnswerRequest.updateMany({
      where: { sessionId, turnId, status: ANSWER_PROCESSING },
      data: { status, leaseUntil: new Date() }
    });
  }
}

async function recordInterviewReportNotification(
  transaction: Prisma.TransactionClient,
  state: InterviewState,
  snapshot: InterviewReportSnapshot
): Promise<void> {
  if (state.phase !== "done") return;

  const session = await transaction.interviewSession.findUnique({
    where: { id: state.id },
    select: { ownerId: true }
  });
  if (!session?.ownerId.startsWith("user:")) return;

  // Notification rows belong to candidate profiles. An authenticated session
  // can briefly outlive a deleted/incomplete profile, so absence is a normal
  // no-delivery outcome rather than a reason to roll back the interview.
  const recipient = await transaction.candidateProfile.findUnique({
    where: { ownerId: session.ownerId },
    select: { ownerId: true }
  });
  if (!recipient) return;

  const copy = interviewReportNotificationCopy(state, snapshot);
  await transaction.notification.createMany({
    data: {
      ownerId: recipient.ownerId,
      kind: NotificationKind.INTERVIEW_REPORT_READY,
      title: copy.title,
      body: copy.body,
      href: "/reports",
      subjectId: state.id
    },
    skipDuplicates: true
  });
}

export function interviewReportNotificationCopy(
  state: InterviewState,
  snapshot: InterviewReportSnapshot
): { title: string; body: string } {
  const profile = evaluationProfileForSetup(state.setup);
  const title = `${profile.label} report is ready`;
  if (snapshot.report.answerCount === 0) {
    return {
      title,
      body: "Your session summary is ready. Open it to review the interview and choose your next step."
    };
  }

  return {
    title,
    body: `Your evidence score is ${snapshot.report.summary.evidenceScore}/100. See what landed, what needs work, and your next step.`
  };
}

async function applyEvaluationRecoveryMutation(
  transaction: Prisma.TransactionClient,
  sessionId: string,
  mutation: EvaluationRecoveryMutation | undefined
): Promise<void> {
  if (!mutation) return;
  const questionIndex =
    mutation.action === "enqueue" ? mutation.payload.questionIndex : mutation.questionIndex;

  if (mutation.action === "resolve") {
    await transaction.interviewEvaluationJob.updateMany({
      where: { sessionId, questionIndex, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "SUPERSEDED", leaseUntil: null, completedAt: new Date() }
    });
    return;
  }

  await transaction.interviewEvaluationJob.updateMany({
    where: {
      sessionId,
      questionIndex,
      answerHash: { not: mutation.payload.answerHash },
      status: { in: ["PENDING", "PROCESSING"] }
    },
    data: { status: "SUPERSEDED", leaseUntil: null, completedAt: new Date() }
  });
  await transaction.interviewEvaluationJob.upsert({
    where: {
      sessionId_questionIndex_answerHash: {
        sessionId,
        questionIndex,
        answerHash: mutation.payload.answerHash
      }
    },
    create: {
      sessionId,
      questionIndex,
      answerHash: mutation.payload.answerHash,
      payload: toJsonValue(mutation.payload),
      status: "PENDING",
      availableAt: new Date()
    },
    update: {
      payload: toJsonValue(mutation.payload),
      status: "PENDING",
      attempts: 0,
      availableAt: new Date(),
      leaseUntil: null,
      lastError: null,
      completedAt: null
    }
  });
}

function toJson(state: InterviewState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function storedView(stored: StoredSession): VersionedInterviewSession {
  return { state: stored.state, touchedAt: stored.touchedAt, version: stored.version };
}

function prismaStoredView(stored: {
  state: Prisma.JsonValue;
  touchedAt: Date;
  version: number;
}): VersionedInterviewSession {
  return {
    state: stored.state as unknown as InterviewState,
    touchedAt: stored.touchedAt.getTime(),
    version: stored.version
  };
}

function answerRequestKey(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

function answerRequestResult(
  request:
    | {
        answerHash: string;
        status: string;
        response?: unknown;
      }
    | undefined,
  answerHash: string
): BeginAnswerResult {
  if (!request) return { status: "pending" };
  if (request.answerHash !== answerHash) return { status: "payload-mismatch" };
  if (request.status === ANSWER_COMPLETED && request.response) {
    return { status: "completed", response: request.response as InterviewAnswerResponse };
  }
  if (request.status === ANSWER_CONFLICTED) return { status: "conflicted" };
  return { status: "pending" };
}
