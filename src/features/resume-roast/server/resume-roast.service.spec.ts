import { describe, expect, it, vi } from "vitest";
import type { CandidateInterviewProfile } from "@/features/interviews/domain/personalized-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import type {
  ResumeRoastResult,
  ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import { ResumeRoastGenerationError } from "./resume-roast.generator";
import {
  RESUME_ROAST_GENERATION_STALE_MS,
  ResumeRoastCancelledError,
  ResumeRoastGenerationFailedError,
  ResumeRoastInvalidResponseError,
  ResumeRoastProviderRateLimitedError,
  ResumeRoastService,
  ResumeRoastTimeoutError
} from "./resume-roast.service";

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const ROAST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ROAST_ID = "44444444-4444-4444-8444-444444444444";
const NOW = Date.UTC(2026, 8, 28, 10, 0, 0);
const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};
const result: ResumeRoastResult = {
  openingRoast: "The bullet brought a real result, which is inconveniently useful.",
  strength: {
    headline: "Measured impact",
    explanation: "The resume names a system and states its result.",
    evidenceAnchors: ["experience-1-achievement-1"]
  },
  problems: [],
  rewrite: null,
  verdict: {
    band: "strong",
    explanation: "The available evidence is specific and readable.",
    targetFitScore: 84
  },
  actionPlan: [
    {
      priority: 1,
      action: "Keep impact first",
      rationale: "It makes the strongest evidence easy to scan."
    }
  ]
};

function profile(resume = true): CandidateProfile {
  return {
    targetRole: "backend",
    level: "5-plus",
    targetCompany: "",
    targetDate: null,
    headline: "Backend engineer",
    context: "",
    focusAreas: [],
    stories: [],
    coverImage: null,
    profileImage: null,
    workspaceAccent: "violet",
    teacherId: null,
    helpNotificationsEnabled: true,
    teacherNotificationsEnabled: true,
    updatedAt: null,
    completeness: 0,
    onboardingCompletedAt: null,
    preparationOnboarding: {
      stage: "completed",
      updatedAt: 1,
      completedAt: 1,
      baselineStartedAt: 1,
      answers: {},
      questionIds: {},
      questions: {},
      skillProfile: null
    },
    resume: resume
      ? {
          fileName: "resume.pdf",
          uploadedAt: 1,
          confidence: 0.9,
          fullName: "Private Candidate",
          skills: ["TypeScript"],
          warnings: [],
          experience: [
            {
              organization: "Private Co",
              role: "Backend Engineer",
              period: "",
              location: "",
              summary: "Built service infrastructure.",
              achievements: ["Reduced API latency by 30% for 20 services."],
              skills: []
            }
          ],
          education: [],
          projects: [],
          achievements: [],
          practiceQuestions: [],
          roadmap: [],
          document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
          evidence: {
            dateRanges: 0,
            achievementLines: 1,
            quantifiedAchievements: 1,
            experienceEntries: 1,
            projectEntries: 0,
            educationEntries: 0
          },
          interviewKit: null
        }
      : null
  };
}

function setup(
  overrides: {
    getProfile?: CandidateProfile;
    target?: ResumeRoastTarget | null;
    previous?: unknown;
    generated?: ResumeRoastResult;
    complete?: boolean;
  } = {}
) {
  const store = {
    getTarget: vi.fn().mockResolvedValue(overrides.target ?? null),
    getLatestReady: vi.fn().mockResolvedValue(overrides.previous ?? null),
    getReadyHistory: vi.fn().mockResolvedValue(overrides.previous ? [overrides.previous] : []),
    saveTarget: vi.fn().mockResolvedValue(target),
    createGeneration: vi.fn().mockResolvedValue({
      kind: "created",
      roastId: ROAST_ID,
      generationToken: "33333333-3333-4333-8333-333333333333"
    }),
    getActiveGeneration: vi.fn().mockResolvedValue(null),
    failStaleGenerations: vi.fn().mockResolvedValue(0),
    getReusableAssessment: vi.fn().mockResolvedValue(null),
    getGenerationStatus: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(overrides.complete ?? true),
    fail: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true)
  };
  const generator = { generate: vi.fn().mockResolvedValue(overrides.generated ?? result) };
  const profiles = {
    get: vi.fn().mockResolvedValue(overrides.getProfile ?? profile()),
    ensureActiveResumeVersion: vi
      .fn()
      .mockResolvedValue({ id: VERSION_ID } as CandidateInterviewProfile)
  };
  const service = new ResumeRoastService(profiles, store as never, generator, () => NOW);
  /** prepare() narrowed to a claimed generation, as every non-join test expects. */
  const claim = async () => {
    const prepared = await service.prepare("user-a", target);
    if (prepared.kind !== "claimed") throw new Error("expected a claimed generation");
    return prepared;
  };
  return {
    claim,
    service: new ResumeRoastService(profiles, store as never, generator, () => NOW),
    store,
    generator,
    profiles,
    planningStore: profiles
  };
}

describe("ResumeRoastService", () => {
  it("returns a normal missing-resume handoff without resolving a resume version", async () => {
    const { service, store, planningStore } = setup({ getProfile: profile(false) });

    await expect(service.state("user-a")).resolves.toEqual({
      hasResume: false,
      target: null,
      suggestedTarget: null,
      previousRoast: null,
      history: [],
      inProgress: null
    });
    // Target and history are read in parallel with the profile to save a round
    // trip; without a resume nothing version-specific is resolved or returned.
    expect(planningStore.ensureActiveResumeVersion).not.toHaveBeenCalled();
    expect(store.getLatestReady).not.toHaveBeenCalled();
  });

  it("returns the latest completed roast as per-user history", async () => {
    const previous = {
      id: ROAST_ID,
      ownerId: "user-a",
      resumeProfileVersionId: VERSION_ID,
      promptVersion: "resume-roast-v6",
      ...target,
      status: "READY" as const,
      result,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const { service, store } = setup({ target, previous });

    await expect(service.state("user-a")).resolves.toEqual({
      hasResume: true,
      target,
      suggestedTarget: { role: "backend-engineer", level: "senior" },
      previousRoast: { id: ROAST_ID, target, result },
      history: [
        expect.objectContaining({ id: ROAST_ID, resumeVersionId: VERSION_ID, target, result })
      ],
      inProgress: null
    });
    expect(store.getReadyHistory).toHaveBeenCalledWith("user-a");
    // The roast for the current version was already in history.
    expect(store.getLatestReady).not.toHaveBeenCalled();
  });

  it("falls back to the latest roast for the current version when history lacks it", async () => {
    const previous = {
      id: ROAST_ID,
      ownerId: "user-a",
      resumeProfileVersionId: VERSION_ID,
      promptVersion: "resume-roast-v6",
      ...target,
      status: "READY" as const,
      result,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const { service, store } = setup({ target, previous });
    store.getReadyHistory.mockResolvedValue([]);

    await expect(service.state("user-a")).resolves.toMatchObject({
      previousRoast: { id: ROAST_ID, target, result },
      history: []
    });
    expect(store.getLatestReady).toHaveBeenCalledWith("user-a", VERSION_ID);
  });

  it("creates a fresh history row for every requested analysis", async () => {
    const { service, store } = setup();

    await service.prepare("user-a", target);
    await service.prepare("user-a", target);

    expect(store.saveTarget).toHaveBeenCalledWith("user-a", target);
    expect(store.createGeneration).toHaveBeenCalledTimes(2);
    expect(store.createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "user-a",
        resumeProfileVersionId: VERSION_ID,
        promptVersion: "resume-roast-v7"
      })
    );
  });

  it("joins a running roast instead of spending quota on a duplicate", async () => {
    const { service, store } = setup();
    const startedAt = new Date(NOW - 5_000);
    store.getActiveGeneration.mockResolvedValue({ roastId: OTHER_ROAST_ID, target, startedAt });
    const beforeGenerate = vi.fn();

    await expect(service.prepare("user-a", target, { beforeGenerate })).resolves.toEqual({
      kind: "joined",
      inProgress: { roastId: OTHER_ROAST_ID, target, startedAt: startedAt.getTime() }
    });
    expect(beforeGenerate).not.toHaveBeenCalled();
    expect(store.createGeneration).not.toHaveBeenCalled();
    expect(store.saveTarget).not.toHaveBeenCalled();
    // Only rows that started inside the stale window count as running.
    expect(store.getActiveGeneration).toHaveBeenCalledWith(
      "user-a",
      new Date(NOW - RESUME_ROAST_GENERATION_STALE_MS)
    );
    expect(store.failStaleGenerations).toHaveBeenCalledWith(
      "user-a",
      new Date(NOW - RESUME_ROAST_GENERATION_STALE_MS)
    );
  });

  it("joins the winner when another request claims the slot first", async () => {
    const { service, store } = setup();
    const startedAt = new Date(NOW - 100);
    store.createGeneration.mockResolvedValue({ kind: "conflict" });
    store.getActiveGeneration
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ roastId: OTHER_ROAST_ID, target, startedAt });
    const beforeGenerate = vi.fn();

    await expect(service.prepare("user-a", target, { beforeGenerate })).resolves.toMatchObject({
      kind: "joined",
      inProgress: { roastId: OTHER_ROAST_ID }
    });
    // Losing the race is still a join: no quota spent.
    expect(beforeGenerate).not.toHaveBeenCalled();
  });

  it("releases the slot when the rate limit refuses a new roast", async () => {
    const { service, store } = setup();
    const limited = new Error("limited");

    await expect(
      service.prepare("user-a", target, { beforeGenerate: () => Promise.reject(limited) })
    ).rejects.toBe(limited);
    expect(store.fail).toHaveBeenCalledWith(
      "user-a",
      ROAST_ID,
      "33333333-3333-4333-8333-333333333333"
    );
  });

  it("reuses the saved scorecard for the same resume and target", async () => {
    const { claim, store, generator, service } = setup();
    const assessment = {
      scorecard: {
        rubricVersion: "rubric-v1",
        overall: 7,
        dimensions: Object.fromEntries(
          ["roleFit", "impact", "ownership", "technical", "readability"].map((key) => [
            key,
            { score: 4, note: "Clear enough.", evidenceAnchors: [] }
          ])
        )
      },
      verdict: { band: "solid", explanation: "You'd get shortlisted." }
    };
    store.getReusableAssessment.mockResolvedValue(assessment);

    const claimed = await claim();
    expect(store.getReusableAssessment).toHaveBeenCalledWith("user-a", VERSION_ID, target, "rubric-v1");
    expect(claimed.assessment).toEqual(assessment);
    await service.finishClaim("user-a", claimed);
    expect(generator.generate).toHaveBeenCalledWith(expect.objectContaining({ assessment }));
  });

  it("logs one safe line per roast with provider timings", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { claim, service, generator } = setup();
    generator.generate.mockImplementationOnce(async (input: { onTrace?: (trace: unknown) => void }) => {
      input.onTrace?.({
        provider: "gemini",
        operation: "resume.roast.generate",
        model: "flash",
        modelClass: "fast",
        attempt: 1,
        maxAttempts: 1,
        durationMs: 3_100,
        outcome: "success"
      });
      return result;
    });

    await service.finishClaim("user-a", await claim());
    const line = String(log.mock.calls.find(([text]) => String(text).includes("resume_roast.generation"))?.[0]);
    expect(line).toContain('"outcome":"ready"');
    expect(line).toContain('"provider":"gemini"');
    expect(line).toContain('"usedFallback":false');
    expect(line).not.toContain("user-a");
    expect(line).not.toContain(result.openingRoast);

    generator.generate.mockRejectedValueOnce(new ResumeRoastGenerationError());
    await expect(service.finishClaim("user-a", await claim())).rejects.toBeInstanceOf(
      ResumeRoastInvalidResponseError
    );
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain(
      '"errorCode":"RESUME_ROAST_INVALID_RESPONSE"'
    );
  });

  it("reports where a followed roast stands", async () => {
    const { service, store } = setup();
    const startedAt = new Date(NOW - 2_000);
    store.getGenerationStatus.mockResolvedValueOnce({ status: "generating", target, startedAt });
    await expect(service.generationState("user-a", ROAST_ID)).resolves.toEqual({
      status: "generating",
      inProgress: { roastId: ROAST_ID, target, startedAt: startedAt.getTime() }
    });

    store.getGenerationStatus.mockResolvedValueOnce({ status: "failed" });
    await expect(service.generationState("user-a", ROAST_ID)).resolves.toEqual({
      status: "failed"
    });

    store.getGenerationStatus.mockResolvedValueOnce(null);
    await expect(service.generationState("user-b", ROAST_ID)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("generates once, conditionally persists, and never returns a stale completion", async () => {
    const { service, generator, store, claim } = setup();
    const claimed = await claim();

    await expect(
      service.finishClaim("user-a", claimed, new AbortController().signal)
    ).resolves.toEqual({
      id: ROAST_ID,
      target,
      result
    });
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(store.complete).toHaveBeenCalledWith(
      "user-a",
      ROAST_ID,
      "33333333-3333-4333-8333-333333333333",
      result
    );
    const stale = setup({ complete: false });
    const staleClaim = await stale.claim();
    await expect(
      stale.service.finishClaim("user-a", staleClaim, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastGenerationFailedError);
    expect(stale.store.fail).toHaveBeenCalled();
  });

  it("fails a token-scoped generation with safe errors and owner-scoped deletion", async () => {
    const { service, generator, store, claim } = setup();
    const claimed = await claim();
    generator.generate.mockRejectedValueOnce(new ResumeRoastGenerationError());

    await expect(
      service.finishClaim("user-a", claimed, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastInvalidResponseError);
    expect(store.fail).toHaveBeenCalledWith(
      "user-a",
      ROAST_ID,
      "33333333-3333-4333-8333-333333333333"
    );
    await service.delete("user-b", ROAST_ID);
    expect(store.delete).toHaveBeenLastCalledWith("user-b", ROAST_ID);
  });

  it("preserves a provider timeout as a safe timeout-specific route error", async () => {
    const { service, generator, store, claim } = setup();
    const claimed = await claim();
    generator.generate.mockRejectedValueOnce(
      new AiProviderException({
        code: "AI_TIMEOUT",
        message: "AI provider request timed out",
        provider: "gemini",
        operation: "resume.roast.generate",
        retryable: true
      })
    );

    await expect(
      service.finishClaim("user-a", claimed, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastTimeoutError);
    expect(store.fail).toHaveBeenCalledWith(
      "user-a",
      ROAST_ID,
      "33333333-3333-4333-8333-333333333333"
    );
  });

  it("maps provider schema failures to the invalid-response route error", async () => {
    const { service, generator, claim } = setup();
    const claimed = await claim();
    generator.generate.mockRejectedValueOnce(
      new AiProviderException({
        code: "AI_INVALID_RESPONSE",
        message: "private provider parsing detail",
        provider: "gemini",
        operation: "resume.roast.generate",
        retryable: false
      })
    );

    await expect(
      service.finishClaim("user-a", claimed, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastInvalidResponseError);
  });

  it("maps provider throttling to a safe rate-limit route error", async () => {
    const { service, generator, claim } = setup();
    const claimed = await claim();
    generator.generate.mockRejectedValueOnce(
      new AiProviderException({
        code: "AI_RATE_LIMITED",
        message: "private provider detail",
        provider: "groq",
        operation: "resume.roast.generate-fallback",
        retryable: true,
        retryAfterMs: 60_000
      })
    );

    await expect(
      service.finishClaim("user-a", claimed, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastProviderRateLimitedError);
  });

  it("aborts an interrupted claim before model work and leaves no partial completion", async () => {
    const { service, generator, store, claim } = setup();
    const claimed = await claim();
    const controller = new AbortController();
    controller.abort();

    await expect(service.finishClaim("user-a", claimed, controller.signal)).rejects.toBeInstanceOf(
      ResumeRoastCancelledError
    );
    expect(generator.generate).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(store.fail).toHaveBeenCalledWith(
      "user-a",
      ROAST_ID,
      "33333333-3333-4333-8333-333333333333"
    );
  });
});
