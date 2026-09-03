import { ApiRouteError } from "../http/api-error";
import {
  MemorySharedGuardBackend,
  RATE_LIMIT_POLICIES,
  SharedGuard,
  type LockPolicy,
  type RateLimitPolicy
} from "./shared-guard";

describe("SharedGuard", () => {
  let now = 1_000;
  let guard: SharedGuard;

  const ratePolicy: RateLimitPolicy = {
    namespace: "test-rate",
    limit: 2,
    windowMs: 10_000,
    code: "TEST_RATE_LIMITED",
    message: "Slow down"
  };

  const lockPolicy: LockPolicy = {
    namespace: "test-lock",
    ttlMs: 5_000,
    code: "TEST_BUSY",
    message: "Already running"
  };

  beforeEach(() => {
    now = 1_000;
    guard = new SharedGuard(new MemorySharedGuardBackend(() => now));
  });

  it("limits one identity without affecting another and resets after the window", async () => {
    await guard.enforce(ratePolicy, "user-a");
    await guard.enforce(ratePolicy, "user-a");
    await guard.enforce(ratePolicy, "user-b");

    await expect(guard.enforce(ratePolicy, "user-a")).rejects.toMatchObject({
      statusCode: 429,
      code: "TEST_RATE_LIMITED",
      details: { limit: 2, windowMs: 10_000, retryAfterMs: 10_000 }
    } satisfies Partial<ApiRouteError>);

    now += 10_001;
    await expect(guard.enforce(ratePolicy, "user-a")).resolves.toBeUndefined();
  });

  it("allows one new peer-help request every ten minutes", () => {
    expect(RATE_LIMIT_POLICIES.helpRequest).toMatchObject({
      namespace: "help-request-10m",
      limit: 1,
      windowMs: 10 * 60_000
    });
  });

  it("keeps Resume Roast generation to six requests per ten minutes", () => {
    expect(RATE_LIMIT_POLICIES.resumeRoastGeneration).toMatchObject({
      namespace: "resume-roast-generate",
      limit: 6,
      windowMs: 10 * 60_000,
      code: "RESUME_ROAST_RATE_LIMITED"
    });
  });

  it("supports weighted limits such as TTS characters", async () => {
    await guard.enforce({ ...ratePolicy, limit: 10 }, "user-a", 7);

    await expect(guard.enforce({ ...ratePolicy, limit: 10 }, "user-a", 4)).rejects.toMatchObject({
      statusCode: 429,
      code: "TEST_RATE_LIMITED"
    });
  });

  it("allows one distributed lease until it is released", async () => {
    const first = await guard.acquire(lockPolicy, "session-a");

    await expect(guard.acquire(lockPolicy, "session-a")).rejects.toMatchObject({
      statusCode: 409,
      code: "TEST_BUSY"
    });
    await expect(guard.acquire(lockPolicy, "session-b")).resolves.toBeDefined();

    await first.release();
    await expect(guard.acquire(lockPolicy, "session-a")).resolves.toBeDefined();
  });

  it("recovers an abandoned lease after its TTL", async () => {
    await guard.acquire(lockPolicy, "session-a");
    now += lockPolicy.ttlMs + 1;

    await expect(guard.acquire(lockPolicy, "session-a")).resolves.toBeDefined();
  });

  it("shares cached values until their TTL expires", async () => {
    await guard.setCached("connection", "session-a", { room: "room-a" }, 2_000);

    await expect(guard.getCached("connection", "session-a")).resolves.toEqual({ room: "room-a" });
    now += 2_001;
    await expect(guard.getCached("connection", "session-a")).resolves.toBeNull();
  });
});
