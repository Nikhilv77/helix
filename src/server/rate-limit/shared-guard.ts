import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { ApiRouteError } from "../http/api-error";
import type { AppConfigService } from "../config/app-config.service";

const KEY_PREFIX = "trailgrad:v1";
const CACHE_VALUE_PREFIX = "json:";

const FIXED_WINDOW_SCRIPT = `
local current = redis.call("INCRBY", KEYS[1], ARGV[1])
local ttl = redis.call("PTTL", KEYS[1])
if current == tonumber(ARGV[1]) or ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
return { current, ttl }
`;

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export interface RateLimitPolicy {
  namespace: string;
  limit: number;
  windowMs: number;
  code: string;
  message: string;
}

export const RATE_LIMIT_POLICIES = {
  interviewCreation: {
    namespace: "interview-create",
    limit: 5,
    windowMs: 10 * 60_000,
    code: "INTERVIEW_CREATION_RATE_LIMITED",
    message: "Too many interviews were started recently. Try again in a few minutes."
  },
  answerEvaluation: {
    namespace: "answer-evaluate",
    limit: 15,
    windowMs: 60_000,
    code: "ANSWER_RATE_LIMITED",
    message: "Answers are arriving too quickly. Wait a moment before trying again."
  },
  practiceState: {
    namespace: "practice-state",
    limit: 90,
    windowMs: 60_000,
    code: "PRACTICE_STATE_RATE_LIMITED",
    message: "Practice changes are being saved too quickly. Wait a moment and try again."
  },
  livekitToken: {
    namespace: "livekit-token",
    limit: 3,
    windowMs: 5 * 60_000,
    code: "VOICE_CONNECTION_RATE_LIMITED",
    message: "Too many voice connection attempts were made. Try again shortly."
  },
  codeExecution: {
    namespace: "code-run",
    limit: 10,
    windowMs: 60_000,
    code: "CODE_RUN_RATE_LIMITED",
    message: "Too many code runs were requested. Wait a moment before trying again."
  },
  /**
   * Asking for a human is cheap to request and expensive to answer, so this is
   * deliberately tighter than the AI-facing limits: every accepted request
   * costs a volunteer's attention, not just inference.
   */
  helpRequest: {
    namespace: "help-request",
    limit: 3,
    windowMs: 30 * 60_000,
    code: "HELP_REQUEST_RATE_LIMITED",
    message: "You have asked for help a few times recently. Give it a little while."
  },
  /**
   * Independent from opening requests: somebody who has used their request
   * quota must still be able to leave an unsafe interaction immediately.
   */
  helpSafety: {
    namespace: "help-safety",
    limit: 10,
    windowMs: 60 * 60_000,
    code: "HELP_SAFETY_RATE_LIMITED",
    message: "Too many safety actions were submitted recently. Try again shortly."
  },
  resumeUpload: {
    namespace: "resume-upload",
    limit: 3,
    windowMs: 10 * 60_000,
    code: "RESUME_UPLOAD_RATE_LIMITED",
    message: "That is a lot of resume uploads in a short window. Try again in a few minutes."
  },
  voiceGeneration: {
    namespace: "voice-generate",
    limit: 30,
    windowMs: 60_000,
    code: "VOICE_RATE_LIMITED",
    message: "Too many new voice lines were requested. Wait a moment before trying again."
  },
  voiceCharacters: {
    namespace: "voice-characters",
    limit: 12_000,
    windowMs: 60_000,
    code: "VOICE_CHARACTER_LIMITED",
    message: "Too much speech was requested at once. Wait a moment before trying again."
  },
  workspaceSearch: {
    namespace: "workspace-search",
    limit: 180,
    windowMs: 60_000,
    code: "SEARCH_RATE_LIMITED",
    message: "Search is being used too quickly. Wait a moment and try again."
  }
} as const satisfies Record<string, RateLimitPolicy>;

interface WindowResult {
  used: number;
  retryAfterMs: number;
}

export interface SharedGuardBackend {
  consume(key: string, cost: number, windowMs: number): Promise<WindowResult>;
  acquire(key: string, token: string, ttlMs: number): Promise<boolean>;
  release(key: string, token: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

export interface SharedLease {
  release(): Promise<void>;
}

export interface LockPolicy {
  namespace: string;
  ttlMs: number;
  code: string;
  message: string;
}

export class SharedGuard {
  constructor(private readonly backend: SharedGuardBackend) {}

  async enforce(policy: RateLimitPolicy, identity: string, cost = 1): Promise<void> {
    if (!Number.isInteger(cost) || cost < 1) {
      throw new Error("Rate-limit cost must be a positive integer");
    }

    let result: WindowResult;
    try {
      result = await this.backend.consume(
        rateKey(policy.namespace, identity),
        cost,
        policy.windowMs
      );
    } catch (error) {
      throw unavailable(error);
    }

    if (result.used > policy.limit) {
      throw new ApiRouteError(429, policy.code, policy.message, {
        limit: policy.limit,
        windowMs: policy.windowMs,
        retryAfterMs: Math.max(1_000, result.retryAfterMs)
      });
    }
  }

  async acquire(policy: LockPolicy, identity: string): Promise<SharedLease> {
    const key = lockKey(policy.namespace, identity);
    const token = randomUUID();
    let acquired: boolean;

    try {
      acquired = await this.backend.acquire(key, token, policy.ttlMs);
    } catch (error) {
      throw unavailable(error);
    }

    if (!acquired) {
      throw new ApiRouteError(409, policy.code, policy.message, {
        retryAfterMs: Math.min(policy.ttlMs, 5_000)
      });
    }

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        try {
          await this.backend.release(key, token);
        } catch (error) {
          // The lease has a TTL, so a failed cleanup cannot deadlock the user.
          console.error("[rate-limit] Failed to release shared lease", error);
        }
      }
    };
  }

  async getCached<T>(namespace: string, identity: string): Promise<T | null> {
    try {
      const value = await this.backend.get(cacheKey(namespace, identity));
      return value === null
        ? null
        : (JSON.parse(value.startsWith(CACHE_VALUE_PREFIX) ? value.slice(5) : value) as T);
    } catch (error) {
      throw unavailable(error);
    }
  }

  async setCached<T>(namespace: string, identity: string, value: T, ttlMs: number): Promise<void> {
    try {
      // The prefix prevents the Upstash client from automatically decoding the
      // JSON payload before this shared abstraction receives it.
      await this.backend.set(
        cacheKey(namespace, identity),
        `${CACHE_VALUE_PREFIX}${JSON.stringify(value)}`,
        ttlMs
      );
    } catch (error) {
      throw unavailable(error);
    }
  }
}

class UpstashBackend implements SharedGuardBackend {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async consume(key: string, cost: number, windowMs: number): Promise<WindowResult> {
    const result = (await this.redis.eval(FIXED_WINDOW_SCRIPT, [key], [cost, windowMs])) as [
      number,
      number
    ];
    return { used: Number(result[0]), retryAfterMs: Math.max(0, Number(result[1])) };
  }

  async acquire(key: string, token: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(key, token, { nx: true, px: ttlMs })) === "OK";
  }

  async release(key: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_LOCK_SCRIPT, [key], [token]);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get<string>(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.redis.set(key, value, { px: ttlMs });
  }
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/** Process-local fallback for development and deterministic unit tests only. */
export class MemorySharedGuardBackend implements SharedGuardBackend {
  private readonly counters = new Map<string, { used: number; expiresAt: number }>();
  private readonly values = new Map<string, MemoryEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(key: string, cost: number, windowMs: number): Promise<WindowResult> {
    const now = this.now();
    const current = this.counters.get(key);
    const entry =
      !current || current.expiresAt <= now ? { used: 0, expiresAt: now + windowMs } : current;
    entry.used += cost;
    this.counters.set(key, entry);
    return { used: entry.used, retryAfterMs: Math.max(0, entry.expiresAt - now) };
  }

  async acquire(key: string, token: string, ttlMs: number): Promise<boolean> {
    const now = this.now();
    const current = this.values.get(key);
    if (current && current.expiresAt > now) return false;
    this.values.set(key, { value: token, expiresAt: now + ttlMs });
    return true;
  }

  async release(key: string, token: string): Promise<void> {
    if (this.values.get(key)?.value === token) this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.values.set(key, { value, expiresAt: this.now() + ttlMs });
  }
}

class UnavailableBackend implements SharedGuardBackend {
  private fail(): never {
    throw new Error("Shared Redis rate limiting is not configured");
  }
  consume(): Promise<WindowResult> {
    return Promise.reject(this.fail());
  }
  acquire(): Promise<boolean> {
    return Promise.reject(this.fail());
  }
  release(): Promise<void> {
    return Promise.reject(this.fail());
  }
  get(): Promise<string | null> {
    return Promise.reject(this.fail());
  }
  set(): Promise<void> {
    return Promise.reject(this.fail());
  }
}

let singleton: { signature: string; guard: SharedGuard } | null = null;

export function getSharedGuard(config: AppConfigService): SharedGuard {
  const signature = [
    config.nodeEnv,
    config.upstashRedisRestUrl ?? "",
    config.upstashRedisRestToken ? "configured" : ""
  ].join(":");
  if (singleton?.signature === signature) return singleton.guard;

  const backend =
    config.upstashRedisRestUrl && config.upstashRedisRestToken
      ? new UpstashBackend(config.upstashRedisRestUrl, config.upstashRedisRestToken)
      : config.nodeEnv === "production"
        ? new UnavailableBackend()
        : new MemorySharedGuardBackend();
  const guard = new SharedGuard(backend);
  singleton = { signature, guard };
  return guard;
}

function rateKey(namespace: string, identity: string): string {
  return `${KEY_PREFIX}:rate:${namespace}:${identityDigest(identity)}`;
}

function lockKey(namespace: string, identity: string): string {
  return `${KEY_PREFIX}:lock:${namespace}:${identityDigest(identity)}`;
}

function cacheKey(namespace: string, identity: string): string {
  return `${KEY_PREFIX}:cache:${namespace}:${identityDigest(identity)}`;
}

function identityDigest(identity: string): string {
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

function unavailable(error: unknown): ApiRouteError {
  console.error("[rate-limit] Shared guard unavailable", error);
  return new ApiRouteError(
    503,
    "RATE_LIMIT_UNAVAILABLE",
    "This operation is temporarily unavailable. Try again in a moment."
  );
}
