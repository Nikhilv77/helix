import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus,
  type ArchitectureDesignScenarioRankingCandidate
} from "@/lib/practice/architecture-design";
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
  it("selects the approved source catalogue without test-only overrides", () => {
    expect(
      new ArchitectureDesignScenarioRankingService().rankFirstScenario(focus(evidence("GUIDED")))
        .selectedScenario.scenarioKey
    ).toBe(ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE[0]?.key);
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
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.map(({ key, version }) => ({ key, version }))
    );
  });

  it("requires two matching database-published versions and no runner", async () => {
    const catalogue = publishedCatalogue();
    const all = new ArchitectureDesignEligibilityService({
      catalogue,
      publications: { published: async (items) => items }
    });
    await expect(all.forProfile(supported)).resolves.toMatchObject({
      available: true,
      reason: "AVAILABLE",
      publishedScenarioCount: 2
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
  return ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.map((candidate) => ({
    ...candidate,
    publicationStatus: "published" as const
  }));
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
