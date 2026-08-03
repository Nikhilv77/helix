import { InterviewState } from "./types";

/**
 * In-memory session store.
 *
 * Phase 6 swaps this for Prisma. Everything above it talks to this interface
 * only, so that swap should not reach into the state machine or the routes.
 */
export interface SessionStore {
  create(state: InterviewState, ownerId: string): void;
  get(id: string): InterviewState | null;
  save(state: InterviewState): void;
  /** Backs the "2 sessions per user per day" cap. */
  countStartedSince(ownerId: string, since: number): number;
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

  create(state: InterviewState, ownerId: string): void {
    this.evictExpired();
    this.sessions.set(state.id, { state, ownerId, touchedAt: Date.now() });

    const starts = this.startsByOwner.get(ownerId) ?? [];
    starts.push(state.startedAt);
    this.startsByOwner.set(ownerId, starts);
  }

  get(id: string): InterviewState | null {
    const stored = this.sessions.get(id);
    if (!stored) return null;

    if (Date.now() - stored.touchedAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return null;
    }

    return stored.state;
  }

  save(state: InterviewState): void {
    const stored = this.sessions.get(state.id);
    if (!stored) return;
    this.sessions.set(state.id, { ...stored, state, touchedAt: Date.now() });
  }

  countStartedSince(ownerId: string, since: number): number {
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
