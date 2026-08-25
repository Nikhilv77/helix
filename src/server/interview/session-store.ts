import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import type { InterviewAnswerResponse, InterviewState } from "./types";

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
  listByOwner(ownerId: string, limit: number): Promise<StoredInterviewSession[]>;
  /** Moves sessions proven by a signed anonymous-browser identity to its account. */
  reassignOwner(fromOwnerId: string, toOwnerId: string): Promise<number>;
  save(state: InterviewState, expectedVersion: number): Promise<number>;
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
    response: InterviewAnswerResponse
  ): Promise<number>;
  failAnswer(sessionId: string, turnId: string): Promise<void>;
  conflictAnswer(sessionId: string, turnId: string): Promise<void>;
  /** Backs the "2 sessions per user per day" cap. */
  countStartedSince(ownerId: string, since: number): Promise<number>;
}

export const SESSION_TTL_MS = 60 * 60 * 1000;
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

  async listByOwner(ownerId: string, limit: number): Promise<StoredInterviewSession[]> {
    return [...this.durableSessions.values()]
      .filter((session) => session.ownerId === ownerId)
      .sort((left, right) => right.state.startedAt - left.state.startedAt)
      .slice(0, limit)
      .map(storedView);
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

  async save(state: InterviewState, expectedVersion: number): Promise<number> {
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
    response: InterviewAnswerResponse
  ): Promise<number> {
    const key = answerRequestKey(state.id, turnId);
    const request = this.answerRequests.get(key);
    if (!request || request.status !== ANSWER_PROCESSING) {
      throw new Error("Interview answer request is not processing");
    }
    const version = await this.save(state, expectedVersion);
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
}

/** Durable store used by Next.js and the remote voice worker in production. */
export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(state: InterviewState, ownerId: string): Promise<void> {
    await this.prisma.interviewSession.create({
      data: {
        id: state.id,
        ownerId,
        state: toJson(state),
        startedAt: new Date(state.startedAt)
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

  async reassignOwner(fromOwnerId: string, toOwnerId: string): Promise<number> {
    const result = await this.prisma.interviewSession.updateMany({
      where: { ownerId: fromOwnerId },
      data: { ownerId: toOwnerId }
    });
    return result.count;
  }

  async save(state: InterviewState, expectedVersion: number): Promise<number> {
    const result = await this.prisma.interviewSession.updateMany({
      where: { id: state.id, version: expectedVersion },
      data: { state: toJson(state), touchedAt: new Date(), version: { increment: 1 } }
    });
    if (result.count !== 1) throw new SessionVersionConflictError(state.id);
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
    response: InterviewAnswerResponse
  ): Promise<number> {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.interviewSession.updateMany({
        where: { id: state.id, version: expectedVersion },
        data: { state: toJson(state), touchedAt: new Date(), version: { increment: 1 } }
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
