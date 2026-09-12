import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  type ArchitectureDesignAdaptiveEvidence,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus,
  type ArchitectureDesignScenarioRankingCandidate
} from "@/features/practice/architecture-design/domain";
import { ArchitectureDesignEligibilityService } from "./eligibility.service";
import { ArchitectureDesignFocusService } from "./focus.service";
import { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

const FINGERPRINT = `sha256:${"a".repeat(64)}`;

describe("ArchitectureDesignFocusService", () => {
  it("freezes minimized owner-scoped resume, plan, and baseline evidence", async () => {
    const candidateFind = vi.fn().mockResolvedValue(profile());
    const planFind = vi.fn().mockResolvedValue({
      id: "plan-1",
      sessionBlueprints: [
        {
          id: "blueprint-1",
          blueprint: {
            topics: [
              { key: "distributed-systems", skillKeys: ["reliability", "capacity-planning"] }
            ]
          }
        }
      ]
    });
    const derive = vi.fn().mockResolvedValue(evidence("GUIDED"));
    const service = new ArchitectureDesignFocusService({
      database: {
        candidateProfile: { findUnique: candidateFind },
        personalizedInterviewPlanVersion: { findFirst: planFind }
      },
      baselineEvidence: { derive },
      now: () => new Date("2026-09-08T10:00:00Z")
    });

    const focus = await service.confirm("owner-1", { path: "role-aligned" });

    expect(focus).toMatchObject({
      role: "backend",
      seniority: "senior",
      targetJob: "Senior Platform Engineer",
      targetCompany: "Example Labs",
      confirmedAt: "2026-09-08T10:00:00.000Z",
      planEvidence: {
        blueprintId: "blueprint-1",
        topicKeys: ["distributed-systems"],
        skillKeys: ["capacity-planning", "reliability"]
      }
    });
    expect(focus.resumeEvidence.architectureSkillKeys).toEqual(
      expect.arrayContaining(["distributed-systems", "caching", "messaging", "reliability"])
    );
    expect(JSON.stringify(focus)).not.toContain("Private payments migration");
    expect(focus.focusFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(isDeeplyFrozen(focus)).toBe(true);
    expect(candidateFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1" } })
    );
    expect(planFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1", status: "READY" } })
    );
    expect(derive).toHaveBeenCalledWith("owner-1");
  });

  it("keeps fingerprints stable across time and rejects browser-supplied targeting", async () => {
    const create = (now: string) =>
      new ArchitectureDesignFocusService({
        database: database(profile(), null),
        baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("UNKNOWN")) },
        now: () => new Date(now)
      });
    const first = await create("2026-09-08T10:00:00Z").confirm("owner", {
      path: "role-aligned"
    });
    const second = await create("2026-09-09T10:00:00Z").confirm("owner", {
      path: "role-aligned"
    });

    expect(second.focusFingerprint).toBe(first.focusFingerprint);
    expect(second.confirmedAt).not.toBe(first.confirmedAt);
    await expect(
      create("2026-09-08T10:00:00Z").confirm("owner", {
        path: "role-aligned",
        difficulty: "stretch"
      } as never)
    ).rejects.toBeDefined();
  });

  it("fails closed for unsupported roles and missing levels", async () => {
    const create = (value: ReturnType<typeof profile>) =>
      new ArchitectureDesignFocusService({
        database: database(value, null),
        baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("UNKNOWN")) }
      });
    await expect(
      create({ ...profile(), targetRole: "frontend" }).confirm("owner", {
        path: "role-aligned"
      })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_ROLE_UNSUPPORTED" });
    await expect(
      create({ ...profile(), level: null }).confirm("owner", { path: "role-aligned" })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_LEVEL_REQUIRED" });
  });
});

describe("ArchitectureDesignScenarioRankingService", () => {
  it("selects from the approved source catalogue without test-only overrides", () => {
    expect(
      new ArchitectureDesignScenarioRankingService().rankFirstScenario(focus(evidence("GUIDED")))
        .selectedScenario.scenarioKey
    ).toBe("high-volume-notification-platform");
  });

  it("selects deterministically from compatible published scenarios", () => {
    const service = new ArchitectureDesignScenarioRankingService(publishedCatalogue());
    const first = service.rankFirstScenario(focus(evidence("GUIDED")));

    expect(first.selectedScenario.difficulty).toBe("guided");
    expect(service.rankFirstScenario(focus(evidence("GUIDED")))).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.selectedScenario.emphasizedDimensionKeys.length).toBeGreaterThan(0);
  });

  it("honors exclusions, recent scenarios, role, seniority, and publication gates", () => {
    const published = publishedCatalogue();
    const service = new ArchitectureDesignScenarioRankingService(published);
    const firstKey = service.rankFirstScenario(focus(evidence("GUIDED"))).selectedScenario
      .scenarioKey;
    const other = service.rankFirstScenario(focus(evidence("GUIDED")), {
      recentScenarioKeys: [firstKey]
    });
    expect(other.selectedScenario.scenarioKey).not.toBe(firstKey);

    expect(() =>
      service.rankFirstScenario(
        focus(evidence("GUIDED"), { excludedScenarioKeys: published.map(({ key }) => key) })
      )
    ).toThrow("No published");
    expect(() =>
      new ArchitectureDesignScenarioRankingService(
        published.map((candidate) => ({ ...candidate, seniorities: ["junior"] }))
      ).rankFirstScenario(focus(evidence("GUIDED")))
    ).toThrow("No published");
  });

  it("ranks the complete six-scenario published catalogue", () => {
    const selection = new ArchitectureDesignScenarioRankingService().rankFirstScenario(
      focus(evidence("GUIDED"))
    );

    expect(selection.rankings).toHaveLength(6);
    expect(selection.selectedScenario.scenarioKey).toBe("high-volume-notification-platform");
  });

  it("awards novelty to a different architecture family", () => {
    const candidates = ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.map((candidate) => ({
      ...candidate,
      publicationStatus: "published" as const
    }));
    const service = new ArchitectureDesignScenarioRankingService(candidates);
    const result = service.rankFirstScenario(focus(evidence("GUIDED")), {
      recentScenarioKeys: ["multi-tenant-webhook-delivery"]
    });
    const sameFamily = result.rankings.find(
      ({ scenarioKey }) => scenarioKey === "high-volume-notification-platform"
    );
    const differentFamily = result.rankings.find(
      ({ scenarioKey }) => scenarioKey === "marketplace-checkout-inventory"
    );

    expect(sameFamily?.scores.novelty).toBe(0);
    expect(differentFamily?.scores.novelty).toBe(5);

    const realtime = new ArchitectureDesignScenarioRankingService(candidates).rankNextScenario(
      focus(evidence("GUIDED"), { targetJob: "Realtime Collaboration Backend Engineer" }),
      adaptiveEvidence()
    );
    expect(realtime.selectedScenario.scenarioKey).toBe("collaborative-document-editing");
  });

  it("uses architecture-family novelty for adaptive continuation", () => {
    const candidates = ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.map((candidate) => ({
      ...candidate,
      publicationStatus: "published" as const
    }));
    const result = new ArchitectureDesignScenarioRankingService(candidates).rankNextScenario(
      focus(evidence("GUIDED")),
      adaptiveEvidence()
    );
    const sameFamily = result.rankings.find(
      ({ scenarioKey }) => scenarioKey === "high-volume-notification-platform"
    );
    const differentFamily = result.rankings.find(
      ({ scenarioKey }) => scenarioKey === "marketplace-checkout-inventory"
    );

    expect(sameFamily?.scores.novelty).toBe(0);
    expect(differentFamily?.scores.novelty).toBe(5);
  });

  it("selects checkout after the two launch scenarios and then reports exhaustion", () => {
    const published = publishedCatalogue();
    const launchOnly = published.filter(({ key }) =>
      ["multi-tenant-webhook-delivery", "high-volume-notification-platform"].includes(key)
    );
    const afterLaunch = {
      ...adaptiveEvidence(),
      priorScenarioKeys: ["multi-tenant-webhook-delivery", "high-volume-notification-platform"],
      priorTopicKeys: [
        "webhook-delivery",
        "multi-tenancy",
        "event-platforms",
        "retry-systems",
        "notification-platform",
        "preference-enforcement",
        "provider-routing",
        "campaign-fanout"
      ]
    } satisfies ArchitectureDesignAdaptiveEvidence;

    expect(() =>
      new ArchitectureDesignScenarioRankingService(launchOnly).rankNextScenario(
        focus(evidence("GUIDED")),
        afterLaunch
      )
    ).toThrow("No published");

    const selection = new ArchitectureDesignScenarioRankingService(published).rankNextScenario(
      focus(evidence("GUIDED"), { targetJob: "Payments Backend Engineer" }),
      afterLaunch
    );
    expect(selection.selectedScenario.scenarioKey).toBe("marketplace-checkout-inventory");

    const afterCheckout = {
      ...afterLaunch,
      priorScenarioKeys: [...afterLaunch.priorScenarioKeys, "marketplace-checkout-inventory"]
    };
    expect(
      new ArchitectureDesignScenarioRankingService(published).rankNextScenario(
        focus(evidence("GUIDED")),
        afterCheckout
      ).selectedScenario.scenarioKey
    ).toBe("collaborative-document-editing");

    const afterCollaboration = {
      ...afterCheckout,
      priorScenarioKeys: [...afterCheckout.priorScenarioKeys, "collaborative-document-editing"]
    };
    expect(
      new ArchitectureDesignScenarioRankingService(published).rankNextScenario(
        focus(evidence("GUIDED")),
        afterCollaboration
      ).selectedScenario.scenarioKey
    ).toBe("global-media-processing");

    const afterMedia = {
      ...afterCollaboration,
      priorScenarioKeys: [...afterCollaboration.priorScenarioKeys, "global-media-processing"]
    };
    expect(
      new ArchitectureDesignScenarioRankingService(published).rankNextScenario(
        focus(evidence("GUIDED")),
        afterMedia
      ).selectedScenario.scenarioKey
    ).toBe("search-autocomplete-platform");

    expect(() =>
      new ArchitectureDesignScenarioRankingService(published).rankNextScenario(
        focus(evidence("GUIDED")),
        {
          ...afterMedia,
          priorScenarioKeys: [...afterMedia.priorScenarioKeys, "search-autocomplete-platform"]
        }
      )
    ).toThrow("No published");
  });

  it("uses sanitized storage and CDN evidence to prioritize media without echoing resume text", () => {
    const result = new ArchitectureDesignScenarioRankingService().rankFirstScenario(
      focus(evidence("GUIDED"), {
        targetJob: "Media Platform Backend Engineer",
        resumeEvidence: {
          architectureSkillKeys: ["object-storage", "cdn-delivery"],
          projectKeywords: ["media", "private-client-migration"]
        },
        planEvidence: {
          blueprintId: null,
          topicKeys: ["media-processing"],
          skillKeys: ["workflow-orchestration"]
        }
      })
    );

    expect(result.selectedScenario.scenarioKey).toBe("global-media-processing");
    expect(JSON.stringify(result)).not.toContain("private-client-migration");
  });

  it("uses scenario emphasis rather than universal rubric coverage for weak dimensions", () => {
    const migrationGap = {
      ...evidence("GUIDED"),
      dimensionKeys: ["migration-evolution"],
      weakDimensionKeys: ["migration-evolution"],
      unassessedDimensionKeys: []
    } satisfies ArchitectureDesignBaselineEvidence;
    const result = new ArchitectureDesignScenarioRankingService().rankFirstScenario(
      focus(migrationGap, {
        targetJob: "Backend Engineer",
        targetCompany: null,
        resumeEvidence: { architectureSkillKeys: [], projectKeywords: [] },
        planEvidence: { blueprintId: null, topicKeys: [], skillKeys: [] }
      })
    );

    expect(result.selectedScenario.scenarioKey).toBe("search-autocomplete-platform");
    expect(result.selectedScenario.emphasizedDimensionKeys).toContain("migration-evolution");
  });

  it("keeps first and adaptive difficulty within every seniority bound", () => {
    const service = new ArchitectureDesignScenarioRankingService();
    const strong = {
      ...adaptiveEvidence(),
      assessmentScores: {
        requirementsScope: 90,
        apiDataCapacity: 90,
        architectureTradeoffs: 90,
        reliabilitySecurityOperability: 90,
        communicationEvolution: 90
      }
    } satisfies ArchitectureDesignAdaptiveEvidence;

    for (const role of ["backend", "fullstack"] as const) {
      for (const seniority of ["junior", "mid", "senior"] as const) {
        const confirmed = focus(evidence("GUIDED"), { role, seniority });
        const first = service.rankFirstScenario(confirmed);
        const next = service.rankNextScenario(confirmed, strong);

        expect(first.selectedScenario.difficulty).toBe("guided");
        expect(next.selectedScenario.difficulty).toBe(
          seniority === "senior" ? "stretch" : "standard"
        );
      }
    }
  });
});

describe("ArchitectureDesignEligibilityService", () => {
  const supported = { targetRole: "backend" as const, level: "3-5" as const };

  it("remains unavailable until approved source versions are also published in the database", async () => {
    const published = vi.fn().mockResolvedValue([]);
    await expect(
      new ArchitectureDesignEligibilityService({ publications: { published } }).forProfile(
        supported
      )
    ).resolves.toMatchObject({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      publishedScenarioCount: 0
    });
    expect(published).toHaveBeenCalledWith(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
        ({ publicationStatus }) => publicationStatus === "published"
      ).map(({ key, version }) => ({ key, version }))
    );
  });

  it("requires two matching database-published versions and no runner", async () => {
    const catalogue = publishedCatalogue();
    const all = new ArchitectureDesignEligibilityService({
      catalogue,
      publications: { published: async (items) => items }
    });
    const eligibility = await all.forProfile(supported);
    expect(eligibility).toMatchObject({
      available: true,
      reason: "AVAILABLE",
      publishedScenarioCount: 6
    });
    expect(eligibility.scenarios).toHaveLength(6);
    expect(eligibility.scenarios.every(({ questions }) => questions.length === 4)).toBe(true);
    expect(eligibility.scenarios[0]).toMatchObject({
      expectedMinutes: expect.any(Number),
      questions: [
        expect.objectContaining({ order: 1, title: "Requirements and scale" }),
        expect.objectContaining({ order: 2, title: "Contracts and data" }),
        expect.objectContaining({ order: 3, title: "Architecture and failure" }),
        expect.objectContaining({ order: 4, title: "Quality and evolution" })
      ]
    });
    await expect(
      new ArchitectureDesignEligibilityService({
        catalogue,
        publications: { published: async (items) => items.slice(0, 1) }
      }).forProfile(supported)
    ).resolves.toMatchObject({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      publishedScenarioCount: 1
    });
    await expect(all.forProfile({ targetRole: "frontend", level: "3-5" })).resolves.toMatchObject({
      reason: "UNSUPPORTED_ROLE"
    });
    await expect(all.forProfile({ targetRole: "backend", level: null })).resolves.toMatchObject({
      reason: "LEVEL_REQUIRED"
    });
  });
});

function profile() {
  return {
    targetRole: "backend" as string | null,
    level: "5-plus" as string | null,
    targetCompany: " Example Labs " as string | null,
    targetDate: new Date("2026-12-01T12:00:00Z") as Date | null,
    headline: "Senior Platform Engineer" as string | null,
    resumeAnalysis: {
      skills: ["Distributed systems", "Redis caching", "Kafka messaging", "reliability"],
      projects: [
        {
          name: "Private payments migration",
          summary: "Scaled multi-tenant payment events with queues, observability, and retries."
        }
      ]
    }
  };
}

function database(profileValue: ReturnType<typeof profile>, plan: unknown) {
  return {
    candidateProfile: { findUnique: vi.fn().mockResolvedValue(profileValue) },
    personalizedInterviewPlanVersion: { findFirst: vi.fn().mockResolvedValue(plan) }
  };
}

function evidence(
  state: ArchitectureDesignBaselineEvidence["state"]
): ArchitectureDesignBaselineEvidence {
  const dimensions = ["requirements-framing", "capacity-estimation"] as const;
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    questionId: state === "UNKNOWN" ? null : "architecture-1",
    questionFingerprint: state === "UNKNOWN" ? null : FINGERPRINT,
    resolution: state === "UNKNOWN" ? "MISSING" : "RESOLVED",
    correctness: state === "GUIDED" ? "INCORRECT" : state === "STANDARD" ? "CORRECT" : "UNKNOWN",
    state,
    dimensionKeys: state === "UNKNOWN" ? [] : [...dimensions],
    weakDimensionKeys: state === "GUIDED" ? [...dimensions] : [],
    strongDimensionKeys: state === "STANDARD" ? [...dimensions] : [],
    unassessedDimensionKeys: ["api-event-contracts", "data-modeling"],
    signalConsistency: state === "UNKNOWN" ? "UNAVAILABLE" : "CONSISTENT"
  };
}

function focus(
  baselineEvidence: ArchitectureDesignBaselineEvidence,
  overrides: Partial<ArchitectureDesignConfirmedFocus> = {}
): ArchitectureDesignConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-08T10:00:00.000Z",
    path: "role-aligned",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Platform Engineer",
    targetCompany: "Example Labs",
    targetDate: "2026-12-01",
    excludedScenarioKeys: [],
    resumeEvidence: {
      architectureSkillKeys: ["distributed-systems", "messaging"],
      projectKeywords: ["webhooks", "queues"]
    },
    planEvidence: {
      blueprintId: null,
      topicKeys: ["webhook-delivery"],
      skillKeys: ["reliability"]
    },
    baselineEvidence,
    ...overrides
  };
}

function publishedCatalogue(): ArchitectureDesignScenarioRankingCandidate[] {
  return ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
    ({ publicationStatus }) => publicationStatus === "published"
  );
}

function adaptiveEvidence(): ArchitectureDesignAdaptiveEvidence {
  return {
    schemaVersion: 1,
    assessmentScores: {
      requirementsScope: 65,
      apiDataCapacity: 65,
      architectureTradeoffs: 65,
      reliabilitySecurityOperability: 65,
      communicationEvolution: 65
    },
    practice: {
      completedCount: 4,
      learnedCount: 0,
      meanVerifiedScore: 7,
      hintsUsed: 1,
      weakDimensionKeys: ["consistency-transactions"],
      strongDimensionKeys: ["requirements-framing"]
    },
    priorScenarioKeys: ["multi-tenant-webhook-delivery"],
    priorTopicKeys: ["webhook-delivery", "multi-tenancy", "event-platforms", "retry-systems"]
  };
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
