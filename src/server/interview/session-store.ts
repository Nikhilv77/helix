import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import type { InterviewState } from "./types";

/** Shared contract for the in-memory test store and durable production store. */
export interface SessionStore {
  create(state: InterviewState, ownerId: string): Promise<void>;
  get(id: string): Promise<InterviewState | null>;
  save(state: InterviewState): Promise<void>;
  /** Backs the "2 sessions per user per day" cap. */
  countStartedSince(ownerId: string, since: number): Promise<number>;
}

const SESSION_TTL_MS = 60 * 60 * 1000;
/** Long enough to still enforce the daily cap after sessions themselves expire. */
const OWNER_HISTORY_TTL_MS = 25 * 60 * 60 * 1000;

interface StoredSession {
  state: InterviewState;
  ownerId: string;
  touchedAt: number;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  /** Start times per owner, kept beyond session lifetime for the daily cap. */
  private readonly startsByOwner = new Map<string, number[]>();

  async create(state: InterviewState, ownerId: string): Promise<void> {
    this.evictExpired();
    this.sessions.set(state.id, { state, ownerId, touchedAt: Date.now() });

    const starts = this.startsByOwner.get(ownerId) ?? [];
    starts.push(state.startedAt);
    this.startsByOwner.set(ownerId, starts);
  }

  async get(id: string): Promise<InterviewState | null> {
    const stored = this.sessions.get(id);
    if (!stored) return null;

    if (Date.now() - stored.touchedAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return null;
    }

    return stored.state;
  }

  async save(state: InterviewState): Promise<void> {
    const stored = this.sessions.get(state.id);
    if (!stored) return;
    this.sessions.set(state.id, { ...stored, state, touchedAt: Date.now() });
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
    const stored = await this.prisma.interviewSession.findUnique({ where: { id } });
    if (!stored) return null;

    if (Date.now() - stored.touchedAt.getTime() > SESSION_TTL_MS) {
      return null;
    }

    return stored.state as unknown as InterviewState;
  }

  async save(state: InterviewState): Promise<void> {
    await this.prisma.interviewSession.updateMany({
      where: { id: state.id },
      data: { state: toJson(state), touchedAt: new Date() }
    });
  }

  async countStartedSince(ownerId: string, since: number): Promise<number> {
    return this.prisma.interviewSession.count({
      where: {
        ownerId,
        startedAt: { gte: new Date(since) }
      }
    });
  }
}

function toJson(state: InterviewState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}
