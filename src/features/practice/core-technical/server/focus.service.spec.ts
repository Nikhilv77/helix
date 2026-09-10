import { describe, expect, it, vi } from "vitest";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import type { CoreTechnicalBaselineEvidence } from "@/features/practice/core-technical/domain/baseline-evidence-contracts";
import { CoreTechnicalFocusService } from "./focus.service";

describe("CoreTechnicalFocusService", () => {
  it("builds a minimized, deeply frozen confirmed-focus snapshot", async () => {
    const profileFind = vi.fn().mockResolvedValue(profile());
    const derive = vi.fn().mockResolvedValue(evidence("STANDARD"));
    const service = new CoreTechnicalFocusService({
      prisma: { candidateProfile: { findUnique: profileFind } },
      baselineEvidence: { derive },
      now: () => new Date("2026-09-07T10:00:00.000Z")
    });

    const focus = await service.confirm("owner-1", confirmation());

    expect(focus).toMatchObject({
      schemaVersion: 1,
      confirmedAt: "2026-09-07T10:00:00.000Z",
      role: "backend",
      seniority: "senior",
      targetCompany: "Example Labs",
      targetDate: "2026-12-01",
      targetJob: "Node.js backend engineer",
      stack: {
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        framework: "express"
      }
    });
    expect(focus.focusFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(focus.resumeEvidence.topicKeys).toEqual(
      expect.arrayContaining([
        "async-scheduling",
        "nodejs-streams-and-io",
        "nodejs-testing-and-diagnostics"
      ])
    );
    expect(JSON.stringify(focus)).not.toContain("Private payments migration");
    expect(isDeeplyFrozen(focus)).toBe(true);
    expect(derive).toHaveBeenCalledWith("owner-1");
    expect(profileFind).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      select: {
        targetRole: true,
        level: true,
        targetCompany: true,
        targetDate: true,
        headline: true,
        resumeAnalysis: true
      }
    });
  });

  it("uses a content fingerprint that is stable across confirmation timestamps", async () => {
    const dependencies = (date: string) => ({
      prisma: { candidateProfile: { findUnique: vi.fn().mockResolvedValue(profile()) } },
      baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("STANDARD")) },
      now: () => new Date(date)
    });
    const first = await new CoreTechnicalFocusService(dependencies("2026-09-07T10:00:00Z")).confirm(
      "owner-1",
      confirmation()
    );
    const second = await new CoreTechnicalFocusService(
      dependencies("2026-09-08T10:00:00Z")
    ).confirm("owner-1", confirmation());
    expect(second.focusFingerprint).toBe(first.focusFingerprint);
    expect(second.confirmedAt).not.toBe(first.confirmedAt);
  });

  it("uses the learner's explicit technology instead of silently inferring another framework", async () => {
    const service = new CoreTechnicalFocusService({
      prisma: { candidateProfile: { findUnique: vi.fn().mockResolvedValue(profile()) } },
      baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("STANDARD")) }
    });

    const nodeFocus = await service.confirm("owner-1", { technology: "nodejs" });
    const expressFocus = await service.confirm("owner-1", { technology: "express" });

    expect(nodeFocus.stack).toMatchObject({ technology: "nodejs", framework: null });
    expect(expressFocus.stack).toMatchObject({ technology: "express", framework: "express" });
  });

  it("fails closed for an unsupported profile role or missing level", async () => {
    const create = (profileValue: ReturnType<typeof profile>) =>
      new CoreTechnicalFocusService({
        prisma: { candidateProfile: { findUnique: vi.fn().mockResolvedValue(profileValue) } },
        baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence("GUIDED")) }
      });
    await expect(
      create({ ...profile(), targetRole: "frontend" }).confirm("owner", confirmation())
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_ROLE_UNSUPPORTED" });
    await expect(
      create({ ...profile(), level: null }).confirm("owner", confirmation())
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_LEVEL_REQUIRED" });
  });

  it("rejects unsupported stacks before reading candidate data", async () => {
    const service = new CoreTechnicalFocusService({
      prisma: { candidateProfile: { findUnique: vi.fn() } },
      baselineEvidence: { derive: vi.fn() }
    });
    await expect(
      service.confirm("owner", { ...confirmation(), runtime: "deno" } as never)
    ).rejects.toBeDefined();
  });
});

function profile(): {
  targetRole: string | null;
  level: string | null;
  targetCompany: string | null;
  targetDate: Date | null;
  headline: string | null;
  resumeAnalysis: unknown;
} {
  return {
    targetRole: "backend",
    level: "5-plus",
    targetCompany: " Example Labs ",
    targetDate: new Date("2026-12-01T12:00:00Z"),
    headline: "Node.js backend engineer",
    resumeAnalysis: {
      headline: "Node.js backend engineer",
      skills: ["JavaScript", "Express", "async processing", "stream backpressure", "testing"],
      projects: [
        {
          name: "Private payments migration",
          summary: "Built observable async workers with stream processing and tests."
        }
      ]
    }
  };
}

function confirmation() {
  return {
    language: "javascript" as const
  };
}

function evidence(state: CoreTechnicalBaselineEvidence["state"]): CoreTechnicalBaselineEvidence {
  const domainTopics = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key);
  const domainMechanisms = [
    ...new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys))
  ];
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: `sha256:${"a".repeat(64)}`,
    state,
    validAnswerCount: state === "UNKNOWN" ? 0 : 3,
    correctAnswerCount: state === "STRETCH" ? 3 : state === "STANDARD" ? 2 : 1,
    questions: (["technical-1", "technical-2", "technical-3"] as const).map((section, index) => ({
      section,
      resolution: state === "UNKNOWN" ? "MISSING" : "RESOLVED",
      questionId: state === "UNKNOWN" ? null : `technical-${index}`,
      questionFingerprint: state === "UNKNOWN" ? null : `sha256:${String(index + 1).repeat(64)}`,
      conceptKeys: [],
      mechanismKeys: [],
      correctness: state === "UNKNOWN" ? "UNKNOWN" : "CORRECT"
    })),
    weakConceptKeys: [],
    strongConceptKeys: [],
    unassessedConceptKeys: domainTopics,
    weakMechanismKeys: [],
    strongMechanismKeys: [],
    unassessedMechanismKeys: domainMechanisms
  };
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
