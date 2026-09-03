import { describe, expect, it, vi } from "vitest";
import type { CandidateInterviewProfile } from "@/lib/interviews/personalized-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import type { ResumeRoastResult, ResumeRoastTarget } from "@/lib/resume-roast/contracts";
import { AiProviderException } from "../ai/ai-provider.exception";
import { ResumeRoastGenerationError } from "./resume-roast.generator";
import {
  ResumeRoastCancelledError,
  ResumeRoastGenerationFailedError,
  ResumeRoastInvalidResponseError,
  ResumeRoastService,
  ResumeRoastTimeoutError
} from "./resume-roast.service";

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const ROAST_ID = "22222222-2222-4222-8222-222222222222";
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
      roastId: ROAST_ID,
      generationToken: "33333333-3333-4333-8333-333333333333"
    }),
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
  return {
    service: new ResumeRoastService(profiles, store as never, generator),
    store,
    generator,
    profiles,
    planningStore: profiles
  };
}

describe("ResumeRoastService", () => {
  it("returns a normal missing-resume handoff without querying history", async () => {
    const { service, store, planningStore } = setup({ getProfile: profile(false) });

    await expect(service.state("user-a")).resolves.toEqual({
      hasResume: false,
      target: null,
      suggestedTarget: null,
      previousRoast: null,
      history: []
    });
    expect(planningStore.ensureActiveResumeVersion).not.toHaveBeenCalled();
    expect(store.getTarget).not.toHaveBeenCalled();
    expect(store.getLatestReady).not.toHaveBeenCalled();
  });

  it("returns the latest completed roast as per-user history", async () => {
    const previous = {
      id: ROAST_ID,
      ownerId: "user-a",
      resumeProfileVersionId: VERSION_ID,
      promptVersion: "resume-roast-v5",
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
      ]
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
        promptVersion: "resume-roast-v5"
      })
    );
  });

  it("generates once, conditionally persists, and never returns a stale completion", async () => {
    const { service, generator, store } = setup();
    const claimed = await service.prepare("user-a", target);

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
    const staleClaim = await stale.service.prepare("user-a", target);
    await expect(
      stale.service.finishClaim("user-a", staleClaim, new AbortController().signal)
    ).rejects.toBeInstanceOf(ResumeRoastGenerationFailedError);
    expect(stale.store.fail).toHaveBeenCalled();
  });

  it("fails a token-scoped generation with safe errors and owner-scoped deletion", async () => {
    const { service, generator, store } = setup();
    const claimed = await service.prepare("user-a", target);
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
    const { service, generator, store } = setup();
    const claimed = await service.prepare("user-a", target);
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
    const { service, generator } = setup();
    const claimed = await service.prepare("user-a", target);
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

  it("aborts an interrupted claim before model work and leaves no partial completion", async () => {
    const { service, generator, store } = setup();
    const claimed = await service.prepare("user-a", target);
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
