import { describe, expect, it, vi } from "vitest";
import {
  architectureDesignBaselineEvidenceSchema,
  architectureDesignDimensionSchema
} from "@/lib/practice/architecture-design";
import {
  architectureQuestion,
  type ArchitectureQuestion
} from "@/lib/preparation/architecture-question-bank";
import type { BaselineQuestion } from "@/lib/preparation/preparation-onboarding";
import {
  ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY,
  fingerprintArchitectureDesignBaselineQuestion
} from "./baseline-evidence-registry";
import { ArchitectureDesignBaselineEvidenceService } from "./baseline-evidence.service";

describe("ArchitectureDesignBaselineEvidenceService", () => {
  it("calibrates one resolved correct answer as STANDARD and never STRETCH", async () => {
    const row = baselineRow(0);
    const evidence = await harness([row], onboarding(row, true)).service.derive("owner-1");

    expect(evidence).toMatchObject({
      resolution: "RESOLVED",
      correctness: "CORRECT",
      state: "STANDARD",
      signalConsistency: "CONSISTENT"
    });
    expect(evidence.strongDimensionKeys).toEqual(evidence.dimensionKeys);
    expect(evidence.weakDimensionKeys).toEqual([]);
    expect(architectureDesignBaselineEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(JSON.stringify(evidence)).not.toContain("STRETCH");
  });

  it("calibrates one resolved incorrect answer as GUIDED", async () => {
    const row = baselineRow(1);
    const evidence = await harness([row], onboarding(row, false)).service.derive("owner-1");

    expect(evidence).toMatchObject({
      resolution: "RESOLVED",
      correctness: "INCORRECT",
      state: "GUIDED",
      signalConsistency: "CONSISTENT"
    });
    expect(evidence.weakDimensionKeys).toEqual(evidence.dimensionKeys);
    expect(evidence.strongDimensionKeys).toEqual([]);
  });

  it("treats missing, drifted, unanswered, and invalid private evidence as UNKNOWN", async () => {
    const row = baselineRow(2);
    await expect(
      harness([], onboarding(row, true)).service.derive("owner-1")
    ).resolves.toMatchObject({ resolution: "MISSING", correctness: "UNKNOWN", state: "UNKNOWN" });

    const drifted = {
      ...row,
      question: { ...(row.question as BaselineQuestion), prompt: "Changed unregistered wording" }
    };
    await expect(
      harness([drifted], onboarding(row, true)).service.derive("owner-1")
    ).resolves.toMatchObject({ resolution: "UNRESOLVABLE", state: "UNKNOWN" });

    await expect(
      harness([row], onboarding(row, null)).service.derive("owner-1")
    ).resolves.toMatchObject({ resolution: "RESOLVED", correctness: "UNKNOWN", state: "UNKNOWN" });
    await expect(
      harness([row], onboarding(row, "invalid")).service.derive("owner-1")
    ).resolves.toMatchObject({ resolution: "UNRESOLVABLE", state: "UNKNOWN" });

    const malformed = onboarding(row, true);
    malformed.answers.architecture = { choiceId: 42 };
    await expect(harness([row], malformed).service.derive("owner-1")).resolves.toMatchObject({
      resolution: "UNRESOLVABLE",
      state: "UNKNOWN"
    });
  });

  it("uses the private snapshot as authority and the public signal only as a consistency check", async () => {
    const row = baselineRow(3);
    const source = onboarding(row, true);
    const signal = source.skillProfile.signals[0]!;
    signal.topics[0]!.familiarity = "needs-refresh";

    const evidence = await harness([row], source).service.derive("owner-1");

    expect(evidence.state).toBe("STANDARD");
    expect(evidence.correctness).toBe("CORRECT");
    expect(evidence.signalConsistency).toBe("INCONSISTENT");
  });

  it("returns deeply frozen answer-free evidence and keeps every lookup owner-scoped", async () => {
    const row = baselineRow(4);
    const { service, profileFind, questionFind } = harness([row], onboarding(row, true));

    const evidence = await service.derive("private-owner");
    const keys = allKeys(evidence);

    expect(isDeeplyFrozen(evidence)).toBe(true);
    expect(keys).not.toEqual(
      expect.arrayContaining(["question", "options", "correctOptionId", "choiceId", "answeredAt"])
    );
    expect(JSON.stringify(evidence)).not.toContain((row.question as BaselineQuestion).prompt);
    expect(profileFind).toHaveBeenCalledWith({
      where: { ownerId: "private-owner" },
      select: { preparationOnboarding: true }
    });
    expect(questionFind).toHaveBeenCalledWith({
      where: { ownerId: "private-owner", section: "architecture" },
      select: { section: true, questionId: true, question: true }
    });
  });

  it("registers all baseline questions against valid Architecture dimensions", () => {
    expect(ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY).toHaveLength(50);
    const dimensions = new Set(architectureDesignDimensionSchema.options);
    const covered = new Set(
      ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY.flatMap(({ dimensionKeys }) => dimensionKeys)
    );
    expect(covered).toEqual(dimensions);
    for (const entry of ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY) {
      expect(entry.dimensionKeys.every((key) => dimensions.has(key))).toBe(true);
    }
  });

  it("fingerprints canonical question content without encoding option IDs or the answer key", () => {
    const original = canonicalQuestion(5);
    const changedPrivateIds: BaselineQuestion = {
      ...original,
      options: [...original.options]
        .reverse()
        .map(({ label }, index) => ({ id: `private-${index}`, label })),
      correctOptionId: "private-3"
    };
    expect(fingerprintArchitectureDesignBaselineQuestion(changedPrivateIds)).toBe(
      fingerprintArchitectureDesignBaselineQuestion(original)
    );
  });

  it("does not synthesize anonymous evidence for a missing owner", async () => {
    const service = new ArchitectureDesignBaselineEvidenceService({
      candidateProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      preparationBaselineQuestion: { findMany: vi.fn().mockResolvedValue([]) }
    });
    await expect(service.derive("missing-owner")).rejects.toMatchObject({
      code: "ARCHITECTURE_DESIGN_PROFILE_NOT_FOUND"
    });
  });
});

type SavedRow = { section: string; questionId: string; question: BaselineQuestion };

function canonicalQuestion(index: number): BaselineQuestion {
  const question = architectureQuestion(index) as ArchitectureQuestion;
  return { ...question, section: "architecture", eyebrow: "" };
}

function baselineRow(index: number): SavedRow {
  const original = canonicalQuestion(index);
  const options = [...original.options].reverse().map(({ id, label }, optionIndex) => ({
    id: `choice-${optionIndex + 1}`,
    label,
    correct: id === original.correctOptionId
  }));
  return {
    section: "architecture",
    questionId: `architecture-${index}`,
    question: {
      ...original,
      options: options.map(({ id, label }) => ({ id, label })),
      correctOptionId: options.find(({ correct }) => correct)!.id
    }
  };
}

function onboarding(row: SavedRow, grade: true | false | "invalid" | null) {
  const correctId = row.question.correctOptionId!;
  const wrongId = row.question.options.find(({ id }) => id !== correctId)!.id;
  const choiceId = grade === "invalid" ? "not-an-option" : grade ? correctId : wrongId;
  const familiarity = grade ? "familiar" : grade === false ? "needs-refresh" : "unknown";
  return {
    answers: grade === null ? {} : { architecture: { choiceId, answeredAt: 123 } },
    skillProfile: {
      signals: [
        {
          areaId: "architecture-design",
          score: null,
          confidence: grade === null ? 0 : 0.2,
          evidence: grade === null ? "not-enough-evidence" : "baseline",
          topics: [{ label: "System design judgment", familiarity }]
        }
      ]
    }
  } as {
    answers: Record<string, unknown>;
    skillProfile: {
      signals: Array<{
        areaId: string;
        score: null;
        confidence: number;
        evidence: string;
        topics: Array<{ label: string; familiarity: string }>;
      }>;
    };
  };
}

function harness(rows: SavedRow[], preparationOnboarding: unknown) {
  const profileFind = vi.fn().mockResolvedValue({ preparationOnboarding });
  const questionFind = vi.fn().mockResolvedValue(rows);
  return {
    profileFind,
    questionFind,
    service: new ArchitectureDesignBaselineEvidenceService({
      candidateProfile: { findUnique: profileFind },
      preparationBaselineQuestion: { findMany: questionFind }
    })
  };
}

function allKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
