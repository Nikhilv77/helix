import { DsaPracticeBlockStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DsaRecommendation } from "@/lib/practice/dsa-recommendation";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import type { DsaPracticeBlockRecord, DsaPracticeBlockStore } from "./dsa-practice-block.store";

const mocks = vi.hoisted(() => ({ build: vi.fn() }));

vi.mock("@/lib/practice/dsa-recommendation", () => ({
  buildDsaRecommendation: mocks.build
}));

import { buildStableDsaRecommendation } from "./stable-dsa-recommendation";

const recommendation = {
  tier: "building",
  source: "assessment",
  targetLabel: "Full Stack interview",
  focusChapterId: "arrays-hashing",
  focusLabel: "Arrays & Hashing",
  strengthLabel: null,
  blockTitle: "Arrays & Hashing",
  rationale: "Focus here first.",
  questions: [{ slug: "one" }, { slug: "two" }],
  minutes: 30,
  mix: { easy: 1, medium: 1, hard: 0 },
  estimatedPathQuestions: 20,
  availableQuestions: 100
} as DsaRecommendation;

function snapshot(value: DsaRecommendation = recommendation) {
  return {
    schemaVersion: 1,
    recommendation: value
  } as unknown as DsaPracticeBlockRecord["recommendationSnapshot"];
}

function block(
  status: DsaPracticeBlockStatus,
  input: Partial<DsaPracticeBlockRecord> = {}
): DsaPracticeBlockRecord {
  return {
    id: "block-1",
    ownerId: "owner-1",
    ordinal: 1,
    isCurrent: true,
    status,
    recommendationSnapshot: snapshot(),
    questionSlugs: ["one", "two"],
    assessmentReadyAt: null,
    assessedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assessment: {
      id: "assessment-1",
      interviewSessionId: null,
      startedAt: null,
      completedAt: null
    },
    ...input
  } as DsaPracticeBlockRecord;
}

function blockStore(
  current: DsaPracticeBlockRecord | null,
  refreshed: DsaPracticeBlockRecord | null = current,
  advanced: DsaPracticeBlockRecord | null = null
) {
  return {
    current: vi.fn().mockResolvedValue(current),
    refreshReadiness: vi.fn().mockResolvedValue(refreshed),
    createOrAdvance: vi.fn().mockResolvedValue(advanced ?? current)
  } as unknown as DsaPracticeBlockStore;
}

describe("buildStableDsaRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.build.mockReturnValue(recommendation);
  });

  it("creates and snapshots a first cohort when none exists", async () => {
    const store = blockStore(null, null, block(DsaPracticeBlockStatus.PRACTISING));

    const result = await buildStableDsaRecommendation({
      ownerId: "owner-1",
      plan: {} as FrontendDsaPlan,
      profile: {} as CandidateProfile,
      evidence: null,
      statuses: {},
      blockStore: store
    });

    expect(store.createOrAdvance).toHaveBeenCalledWith("owner-1", recommendation);
    expect(result).toEqual(recommendation);
  });

  it("fails closed when the durable current-block read fails", async () => {
    const current = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const store = {
      current,
      refreshReadiness: vi.fn(),
      createOrAdvance: vi.fn()
    } as unknown as DsaPracticeBlockStore;

    await expect(
      buildStableDsaRecommendation({
        ownerId: "owner-1",
        plan: {} as FrontendDsaPlan,
        profile: {} as CandidateProfile,
        evidence: null,
        statuses: {},
        blockStore: store
      })
    ).rejects.toThrow("database unavailable");

    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("fails closed when refreshing durable readiness fails", async () => {
    const store = {
      current: vi.fn().mockResolvedValue(block(DsaPracticeBlockStatus.PRACTISING)),
      refreshReadiness: vi.fn().mockRejectedValue(new Error("readiness unavailable")),
      createOrAdvance: vi.fn()
    } as unknown as DsaPracticeBlockStore;

    await expect(
      buildStableDsaRecommendation({
        ownerId: "owner-1",
        plan: {} as FrontendDsaPlan,
        profile: {} as CandidateProfile,
        evidence: null,
        statuses: {},
        blockStore: store
      })
    ).rejects.toThrow("readiness unavailable");

    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("fails closed when persisting a new cohort fails", async () => {
    const createOrAdvance = vi.fn().mockRejectedValue(new Error("write unavailable"));
    const store = {
      current: vi.fn().mockResolvedValue(null),
      refreshReadiness: vi.fn(),
      createOrAdvance
    } as unknown as DsaPracticeBlockStore;

    await expect(
      buildStableDsaRecommendation({
        ownerId: "owner-1",
        plan: {} as FrontendDsaPlan,
        profile: {} as CandidateProfile,
        evidence: null,
        statuses: {},
        blockStore: store
      })
    ).rejects.toThrow("write unavailable");

    expect(createOrAdvance).toHaveBeenCalledWith("owner-1", recommendation);
  });

  it("does not reshuffle or roll a ready block before it is assessed", async () => {
    const ready = block(DsaPracticeBlockStatus.ASSESSMENT_READY);
    const store = blockStore(ready, ready);

    const result = await buildStableDsaRecommendation({
      ownerId: "owner-1",
      plan: {} as FrontendDsaPlan,
      profile: {} as CandidateProfile,
      evidence: null,
      statuses: { one: "COMPLETED", two: "COMPLETED" },
      blockStore: store
    });

    expect(result).toEqual(recommendation);
    expect(mocks.build).not.toHaveBeenCalled();
    expect(store.createOrAdvance).not.toHaveBeenCalled();
  });

  it("rolls only after the current block has been assessed", async () => {
    const assessed = block(DsaPracticeBlockStatus.ASSESSED);
    const nextRecommendation = {
      ...recommendation,
      questions: [{ slug: "three" }, { slug: "four" }]
    } as DsaRecommendation;
    mocks.build.mockReturnValue(nextRecommendation);
    const store = blockStore(
      assessed,
      assessed,
      block(DsaPracticeBlockStatus.PRACTISING, {
        id: "block-2",
        ordinal: 2,
        questionSlugs: ["three", "four"],
        recommendationSnapshot: snapshot(nextRecommendation)
      })
    );

    const result = await buildStableDsaRecommendation({
      ownerId: "owner-1",
      plan: {} as FrontendDsaPlan,
      profile: {} as CandidateProfile,
      evidence: null,
      statuses: { one: "COMPLETED", two: "COMPLETED" },
      blockStore: store
    });

    expect(mocks.build).toHaveBeenCalledWith(
      expect.not.objectContaining({ blockQuestionSlugs: expect.anything() })
    );
    expect(store.createOrAdvance).toHaveBeenCalledWith("owner-1", nextRecommendation);
    expect(result).toEqual(nextRecommendation);
  });
});
