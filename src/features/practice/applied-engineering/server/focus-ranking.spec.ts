import { describe, expect, it, vi } from "vitest";
import {
  NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE,
  type AppliedEngineeringAdaptiveEvidence,
  type AppliedEngineeringBaselineEvidence,
  type AppliedEngineeringConfirmedFocus,
  type AppliedEngineeringIncidentRankingCandidate
} from "@/features/practice/applied-engineering/domain";
import { AppliedEngineeringBaselineEvidenceService } from "./baseline-evidence.service";
import { AppliedEngineeringEligibilityService } from "./eligibility.service";
import { AppliedEngineeringFocusService } from "./focus.service";
import { AppliedEngineeringIncidentRankingService } from "./incident-ranking.service";

const FINGERPRINT = `sha256:${"a".repeat(64)}`;

describe("Applied Engineering onboarding evidence", () => {
  it.each([
    ["familiar", "STANDARD", []],
    ["needs-refresh", "GUIDED", ["evidence-selection", "root-cause-reasoning", "customer-impact"]],
    ["unknown", "UNKNOWN", []]
  ] as const)(
    "maps %s production reasoning to %s without treating one pulse as stretch",
    async (familiarity, state, weakSignalKeys) => {
      const findUnique = vi.fn().mockResolvedValue({
        preparationOnboarding: onboarding(familiarity)
      });
      const evidence = await new AppliedEngineeringBaselineEvidenceService({
        candidateProfile: { findUnique }
      }).derive("owner-1");

      expect(evidence).toMatchObject({
        source: "initial-baseline",
        sourceAreaId: "applied-engineering",
        state,
        confidence: 0.24,
        questionId: "engineering-7",
        weakSignalKeys
      });
      expect(evidence.sourceFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(isDeeplyFrozen(evidence)).toBe(true);
      expect(JSON.stringify(evidence)).not.toContain("choiceId");
      expect(JSON.stringify(evidence)).not.toContain("correctOptionId");
      expect(findUnique).toHaveBeenCalledWith({
        where: { ownerId: "owner-1" },
        select: { preparationOnboarding: true }
      });
    }
  );

  it("returns unknown zero-confidence evidence for a missing or invalid signal", async () => {
    const service = baselineService({
      questionIds: { engineering: "engineering-7" },
      skillProfile: { signals: [{ areaId: "dsa", confidence: 0.3 }] }
    });

    await expect(service.derive("owner-1")).resolves.toMatchObject({
      state: "UNKNOWN",
      evidence: "not-enough-evidence",
      confidence: 0,
      familiarity: "unknown",
      weakSignalKeys: [],
      strongSignalKeys: []
    });
  });

  it("creates a stable fingerprint and fails instead of producing anonymous evidence", async () => {
    const first = await baselineService(onboarding("familiar")).derive("owner-1");
    const second = await baselineService(onboarding("familiar")).derive("owner-1");
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint);

    const service = new AppliedEngineeringBaselineEvidenceService({
      candidateProfile: { findUnique: vi.fn().mockResolvedValue(null) }
    });
    await expect(service.derive("missing-owner")).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_PROFILE_NOT_FOUND"
    });
  });
});

describe("Applied Engineering focus", () => {
  it("derives a minimized, frozen focus from profile, resume, and baseline evidence", async () => {
    const findUnique = vi.fn().mockResolvedValue(profile());
    const derive = vi.fn().mockResolvedValue(evidence("GUIDED"));
    const service = new AppliedEngineeringFocusService({
      database: { candidateProfile: { findUnique } },
      baselineEvidence: { derive },
      now: () => new Date("2026-09-08T10:00:00.000Z")
    });

    const focus = await service.confirm("owner-1", { language: "javascript" });

    expect(focus).toMatchObject({
      confirmedAt: "2026-09-08T10:00:00.000Z",
      role: "backend",
      seniority: "senior",
      targetCompany: "Example Labs",
      targetDate: "2026-12-01",
      targetJob: "Senior Node.js Backend Engineer",
      stack: {
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        framework: "express"
      }
    });
    expect(focus.resumeEvidence.technologyKeys).toEqual(
      expect.arrayContaining(["nodejs", "express", "postgresql", "redis"])
    );
    expect(focus.resumeEvidence.productionSignalKeys).toEqual(
      expect.arrayContaining(["idempotency", "observability", "retry-safety"])
    );
    expect(JSON.stringify(focus)).not.toContain("Private checkout migration");
    expect(focus.focusFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(isDeeplyFrozen(focus)).toBe(true);
    expect(derive).toHaveBeenCalledWith("owner-1");
  });

  it("keeps the content fingerprint stable across confirmation timestamps", async () => {
    const create = (now: string) =>
      new AppliedEngineeringFocusService({
        database: { candidateProfile: { findUnique: vi.fn().mockResolvedValue(profile()) } },
        baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("GUIDED")) },
        now: () => new Date(now)
      });
    const first = await create("2026-09-08T10:00:00Z").confirm("owner", {
      language: "javascript"
    });
    const second = await create("2026-09-09T10:00:00Z").confirm("owner", {
      language: "javascript"
    });

    expect(second.focusFingerprint).toBe(first.focusFingerprint);
    expect(second.confirmedAt).not.toBe(first.confirmedAt);
  });

  it("fails closed for unsupported roles, missing levels, and extra browser focus fields", async () => {
    const create = (profileValue: ReturnType<typeof profile>) =>
      new AppliedEngineeringFocusService({
        database: {
          candidateProfile: { findUnique: vi.fn().mockResolvedValue(profileValue) }
        },
        baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("GUIDED")) }
      });
    await expect(
      create({ ...profile(), targetRole: "frontend" }).confirm("owner", {
        language: "javascript"
      })
    ).rejects.toMatchObject({ code: "APPLIED_ENGINEERING_ROLE_UNSUPPORTED" });
    await expect(
      create({ ...profile(), level: null }).confirm("owner", { language: "javascript" })
    ).rejects.toMatchObject({ code: "APPLIED_ENGINEERING_LEVEL_REQUIRED" });
    await expect(
      create(profile()).confirm("owner", {
        language: "javascript",
        targetJob: "Browser supplied"
      } as never)
    ).rejects.toBeDefined();
  });
});

describe("Applied Engineering incident ranking", () => {
  const published = publishedCatalogue();

  it("keeps unapproved launch artifacts out of deterministic selection", () => {
    const unapproved = NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE.map((candidate) => ({
      ...candidate,
      publicationStatus: "review" as const
    }));
    const service = new AppliedEngineeringIncidentRankingService(unapproved);
    expect(() => service.rankFirstIncident(focus(evidence("GUIDED")))).toThrow(
      "No published Applied Engineering incident"
    );
  });

  it("selects the compatible shipped difficulty and remains deterministic", () => {
    const service = new AppliedEngineeringIncidentRankingService(published);
    const guided = service.rankFirstIncident(focus(evidence("GUIDED")));
    const standard = service.rankFirstIncident(focus(evidence("STANDARD")));

    expect(guided.selectedIncident).toMatchObject({
      incidentKey: "duplicate-work-after-retry",
      difficulty: "guided"
    });
    expect(standard.selectedIncident).toMatchObject({
      incidentKey: "latency-cascade-under-load",
      difficulty: "standard"
    });
    expect(service.rankFirstIncident(focus(evidence("GUIDED")))).toEqual(guided);
    expect(Object.isFrozen(guided)).toBe(true);
  });

  it("uses resume and baseline production signals without allowing them to bypass hard gates", () => {
    const service = new AppliedEngineeringIncidentRankingService(published);
    const result = service.rankFirstIncident(
      focus(evidence("GUIDED"), {
        resumeEvidence: {
          technologyKeys: ["postgresql", "redis"],
          projectKeywords: ["checkout", "payment", "retry"],
          productionSignalKeys: ["idempotency", "retry-safety"]
        }
      })
    );
    expect(result.selectedIncident.scores.resumeProjectRelevance).toBeGreaterThan(0);
    expect(result.selectedIncident.emphasizedSignalKeys).toContain("evidence-selection");

    const excluded = focus(evidence("GUIDED"), {
      excludedIncidentKeys: ["duplicate-work-after-retry"]
    });
    expect(
      new AppliedEngineeringIncidentRankingService(published).rankFirstIncident(excluded)
        .selectedIncident.incidentKey
    ).toBe("latency-cascade-under-load");

    const frameworkLocked = published.map((candidate) => ({
      ...candidate,
      frameworks: ["nestjs"]
    }));
    expect(() =>
      new AppliedEngineeringIncidentRankingService(frameworkLocked).rankFirstIncident(
        focus(evidence("GUIDED"))
      )
    ).toThrow("No published");
  });

  it("does not select a recent incident again during first-story ranking", () => {
    const service = new AppliedEngineeringIncidentRankingService(published);
    expect(
      service.rankFirstIncident(focus(evidence("GUIDED")), {
        recentIncidentKeys: ["duplicate-work-after-retry"]
      }).selectedIncident.incidentKey
    ).toBe("latency-cascade-under-load");
  });

  it("selects an explicit reviewed library incident while keeping server-owned difficulty", () => {
    const service = new AppliedEngineeringIncidentRankingService(published);
    const result = service.rankSelectedIncident(
      focus(evidence("GUIDED")),
      "latency-cascade-under-load",
      { recentIncidentKeys: ["duplicate-work-after-retry"] }
    );

    expect(result.selectedIncident).toMatchObject({
      incidentKey: "latency-cascade-under-load",
      difficulty: "standard"
    });
    expect(result.rankings).toHaveLength(1);
    expect(() => service.rankSelectedIncident(focus(evidence("GUIDED")), "not-published")).toThrow(
      "not available for this focus"
    );
  });

  it("uses verified assessment evidence to select the next unrepeated incident", () => {
    const service = new AppliedEngineeringIncidentRankingService(published);
    const result = service.rankNextIncident(focus(evidence("GUIDED")), adaptiveEvidence());

    expect(result.selectedIncident).toMatchObject({
      incidentKey: "latency-cascade-under-load",
      difficulty: "standard"
    });
    expect(result.selectedIncident.emphasizedSignalKeys).toEqual(
      expect.arrayContaining(["database-performance", "bounded-work"])
    );
    expect(result.reason).toContain("implementation correctness");
  });
});

describe("Applied Engineering eligibility", () => {
  const supportedProfile = { targetRole: "backend" as const, level: "3-5" as const };

  it("becomes available after the owner approves both launch artifacts", async () => {
    const published = vi.fn().mockImplementation(async (items) => items);
    const service = new AppliedEngineeringEligibilityService({
      publications: { published },
      runner: { supportsStack: () => true }
    });

    await expect(service.forProfile(supportedProfile)).resolves.toMatchObject({
      available: true,
      reason: "AVAILABLE",
      publishedIncidentCount: 2,
      incidents: [
        expect.objectContaining({ expectedMinutes: 45, questions: expect.any(Array) }),
        expect.objectContaining({ expectedMinutes: 45, questions: expect.any(Array) })
      ]
    });
    expect(published).toHaveBeenCalledTimes(1);
  });

  it("requires role, level, runner, catalogue approval, and database publication", async () => {
    const allPublished = publishedCatalogue();
    const publications = {
      published: vi.fn().mockImplementation(async (items) => items)
    };
    const available = new AppliedEngineeringEligibilityService({
      publications,
      runner: { supportsStack: () => true },
      catalogue: allPublished
    });
    await expect(available.forProfile(supportedProfile)).resolves.toMatchObject({
      available: true,
      reason: "AVAILABLE",
      publishedIncidentCount: 2,
      incidents: [{ key: "duplicate-work-after-retry" }, { key: "latency-cascade-under-load" }]
    });

    const oneDatabaseVersion = new AppliedEngineeringEligibilityService({
      publications: { published: async (items) => items.slice(0, 1) },
      runner: { supportsStack: () => true },
      catalogue: allPublished
    });
    await expect(oneDatabaseVersion.forProfile(supportedProfile)).resolves.toMatchObject({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      publishedIncidentCount: 1
    });

    await expect(
      available.forProfile({ targetRole: "frontend", level: "3-5" })
    ).resolves.toMatchObject({ reason: "UNSUPPORTED_ROLE" });
    await expect(
      available.forProfile({ targetRole: "backend", level: null })
    ).resolves.toMatchObject({ reason: "LEVEL_REQUIRED" });
    const runnerDown = new AppliedEngineeringEligibilityService({
      publications,
      runner: { supportsStack: () => false },
      catalogue: allPublished
    });
    await expect(runnerDown.forProfile(supportedProfile)).resolves.toMatchObject({
      reason: "RUNNER_UNAVAILABLE"
    });
  });
});

function onboarding(familiarity: "familiar" | "needs-refresh" | "unknown") {
  return {
    questionIds: { engineering: "engineering-7" },
    answers: { engineering: { choiceId: "private-choice", answeredAt: 1_700_000_000_000 } },
    skillProfile: {
      source: "initial-baseline",
      signals: [
        {
          areaId: "applied-engineering",
          score: null,
          confidence: 0.24,
          evidence: "baseline",
          topics: [{ label: "Production reasoning", familiarity }]
        }
      ]
    }
  };
}

function baselineService(preparationOnboarding: unknown) {
  return new AppliedEngineeringBaselineEvidenceService({
    candidateProfile: {
      findUnique: vi.fn().mockResolvedValue({ preparationOnboarding })
    }
  });
}

function profile() {
  return {
    targetRole: "backend" as string | null,
    level: "5-plus" as string | null,
    targetCompany: " Example Labs " as string | null,
    targetDate: new Date("2026-12-01T12:00:00Z") as Date | null,
    headline: "Senior Node.js Backend Engineer" as string | null,
    resumeAnalysis: {
      skills: ["JavaScript", "Node.js", "Express", "PostgreSQL", "Redis", "observability"],
      projects: [
        {
          name: "Private checkout migration",
          summary:
            "Built idempotent payment APIs with safe retries, structured traces, and canary rollout."
        }
      ]
    }
  };
}

function evidence(
  state: AppliedEngineeringBaselineEvidence["state"]
): AppliedEngineeringBaselineEvidence {
  const assessed = ["evidence-selection", "root-cause-reasoning", "customer-impact"] as const;
  const weakSignalKeys = state === "GUIDED" ? [...assessed] : [];
  const strongSignalKeys = state === "STANDARD" ? [...assessed] : [];
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    source: "initial-baseline",
    state,
    evidence: state === "UNKNOWN" ? "not-enough-evidence" : "baseline",
    confidence: state === "UNKNOWN" ? 0 : 0.24,
    questionId: state === "UNKNOWN" ? null : "engineering-7",
    familiarity:
      state === "GUIDED" ? "needs-refresh" : state === "STANDARD" ? "familiar" : "unknown",
    weakSignalKeys,
    strongSignalKeys,
    unassessedSignalKeys: [
      "data-integrity",
      "concurrency-control",
      "idempotency",
      "bounded-work",
      "database-performance",
      "caching",
      "retry-safety",
      "failure-isolation",
      "testing-verification",
      "observability",
      "security",
      "rollout-safety",
      "rollback-readiness"
    ],
    sourceTopicLabels: state === "UNKNOWN" ? [] : ["Production reasoning"],
    sourceAreaId: "applied-engineering"
  };
}

function focus(
  baselineEvidence: AppliedEngineeringBaselineEvidence,
  overrides: Partial<AppliedEngineeringConfirmedFocus> = {}
): AppliedEngineeringConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-08T10:00:00.000Z",
    role: "backend",
    seniority: "senior",
    targetJob: "Senior Backend Engineer",
    targetCompany: "Example Labs",
    targetDate: "2026-12-01",
    stack: {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS",
      framework: "express"
    },
    excludedIncidentKeys: [],
    resumeEvidence: {
      technologyKeys: ["nodejs", "postgresql"],
      projectKeywords: ["api", "performance"],
      productionSignalKeys: ["observability"]
    },
    baselineEvidence,
    ...overrides
  };
}

function publishedCatalogue(): AppliedEngineeringIncidentRankingCandidate[] {
  return NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE.map((candidate) => ({
    ...candidate,
    publicationStatus: "published" as const
  }));
}

function adaptiveEvidence(): AppliedEngineeringAdaptiveEvidence {
  return {
    schemaVersion: 1,
    assessmentScores: {
      diagnosisEvidence: 72,
      implementationCorrectness: 42,
      testingVerification: 60,
      productionJudgment: 68,
      ownershipDelivery: 75
    },
    practice: {
      completedCount: 7,
      learnedCount: 1,
      meanVerifiedScore: 6.2,
      hintsUsed: 5,
      acceptedCodeQuestionCount: 1,
      weakTopicKeys: ["bounded-concurrency"],
      weakSignalKeys: ["bounded-work", "database-performance"]
    },
    priorIncidentKeys: ["duplicate-work-after-retry"],
    priorTopicKeys: ["idempotent-request-processing", "transaction-boundaries"]
  };
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
