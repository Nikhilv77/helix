import { describe, expect, it, vi } from "vitest";
import {
  CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION,
  CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
  CORE_TECHNICAL_BASELINE_SECTIONS,
  coreTechnicalBaselineEvidenceSchema
} from "@/features/practice/core-technical/domain/baseline-evidence-contracts";
import {
  baselineQuestion,
  type BaselineQuestion
} from "@/features/preparation-onboarding/domain/preparation-onboarding";
import {
  CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY,
  fingerprintCoreTechnicalBaselineQuestion
} from "./baseline-evidence-registry";
import { CoreTechnicalBaselineEvidenceService } from "./baseline-evidence.service";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";

type SavedRow = { section: string; questionId: string; question: unknown };

describe("CoreTechnicalBaselineEvidenceService", () => {
  it.each([
    { correctCount: 0, expected: "GUIDED" },
    { correctCount: 1, expected: "GUIDED" },
    { correctCount: 2, expected: "STANDARD" },
    { correctCount: 3, expected: "STRETCH" }
  ] as const)("calibrates $correctCount correct answers as $expected", async ({ correctCount, expected }) => {
    const rows = baselineRows();
    const answers = Object.fromEntries(rows.map((row, index) => {
      const question = row.question as BaselineQuestion;
      const choiceId = index < correctCount
        ? question.correctOptionId!
        : question.options.find((option) => option.id !== question.correctOptionId)!.id;
      return [row.section, { choiceId, answeredAt: 1_700_000_000_000 + index }];
    }));
    const { service } = harness(rows, { answers });

    const evidence = await service.derive("candidate-1");

    expect(evidence.state).toBe(expected);
    expect(evidence.validAnswerCount).toBe(3);
    expect(evidence.correctAnswerCount).toBe(correctCount);
    expect(evidence.questions).toHaveLength(3);
    expect(coreTechnicalBaselineEvidenceSchema.parse(evidence)).toEqual(evidence);
    if (expected === "STRETCH") {
      expect(evidence.unassessedConceptKeys.length).toBeGreaterThan(0);
      expect(evidence.unassessedConceptKeys).not.toEqual(expect.arrayContaining(evidence.strongConceptKeys));
    }
  });

  it("uses the section, reused ID, and canonical fingerprint as the registry identity", () => {
    const backend = baselineQuestion("technical-1", "backend", "technical-0");
    const fullstack = baselineQuestion("technical-1", "fullstack", "technical-0");

    expect(fingerprintCoreTechnicalBaselineQuestion(backend)).not.toBe(
      fingerprintCoreTechnicalBaselineQuestion(fullstack)
    );
    expect(CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY).toHaveLength((9 + 8) * 3);
    expect(new Set(CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY.map((entry) =>
      `${entry.section}:${entry.questionId}:${entry.questionFingerprint}`
    )).size).toBe(CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY.length);
    const topicKeys = new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key));
    const mechanismKeys = new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys));
    for (const entry of CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY) {
      expect(entry.conceptKeys.every((key) => topicKeys.has(key))).toBe(true);
      expect(entry.mechanismKeys.every((key) => mechanismKeys.has(key))).toBe(true);
    }
  });

  it("does not encode the private answer key in the public question fingerprint", () => {
    const question = baselineQuestion("technical-1", "backend", "technical-0");
    const otherAnswer = question.options.find((option) => option.id !== question.correctOptionId)!.id;
    expect(fingerprintCoreTechnicalBaselineQuestion({ ...question, correctOptionId: otherAnswer })).toBe(
      fingerprintCoreTechnicalBaselineQuestion(question)
    );
  });

  it("matches immutable snapshots after option IDs and order were randomized", async () => {
    const rows = baselineRows().map((row) => {
      const original = row.question as BaselineQuestion;
      const reversed = [...original.options].reverse().map((option, index) => ({
        id: `choice-${index + 1}`,
        label: option.label,
        wasCorrect: option.id === original.correctOptionId
      }));
      return {
        ...row,
        question: {
          ...original,
          options: reversed.map(({ id, label }) => ({ id, label })),
          correctOptionId: reversed.find((option) => option.wasCorrect)!.id
        }
      };
    });
    const answers = Object.fromEntries(rows.map((row, index) => [
      row.section,
      { choiceId: (row.question as BaselineQuestion).correctOptionId!, answeredAt: 100 + index }
    ]));
    const { service } = harness(rows, { answers });

    const evidence = await service.derive("candidate-1");

    expect(evidence.state).toBe("STRETCH");
    expect(evidence.questions.every((question) => question.resolution === "RESOLVED")).toBe(true);
  });

  it("returns UNKNOWN when a private snapshot is missing or its canonical content drifted", async () => {
    const missingRows = baselineRows().slice(0, 2);
    const missing = await harness(missingRows, { answers: correctAnswers(missingRows) }).service.derive("candidate-1");
    expect(missing.state).toBe("UNKNOWN");
    expect(missing.questions[2]).toMatchObject({ section: "technical-3", resolution: "MISSING", correctness: "UNKNOWN" });

    const driftedRows = baselineRows();
    const last = driftedRows[2]!;
    last.question = { ...(last.question as BaselineQuestion), prompt: "Unregistered changed wording" };
    const drifted = await harness(driftedRows, { answers: correctAnswers(driftedRows) }).service.derive("candidate-1");
    expect(drifted.state).toBe("UNKNOWN");
    expect(drifted.questions[2]).toMatchObject({ resolution: "UNRESOLVABLE", correctness: "UNKNOWN" });
  });

  it("returns UNKNOWN for absent or invalid answers and marks resolved unanswered concepts", async () => {
    const rows = baselineRows();
    const answers = correctAnswers(rows);
    delete answers["technical-3"];
    const absent = await harness(rows, { answers }).service.derive("candidate-1");
    expect(absent.state).toBe("UNKNOWN");
    expect(absent.validAnswerCount).toBe(2);
    expect(absent.questions[2]?.correctness).toBe("UNANSWERED");
    expect(absent.unassessedConceptKeys.length).toBeGreaterThan(0);

    const invalid = await harness(rows, {
      answers: { ...correctAnswers(rows), "technical-3": { choiceId: "not-an-option", answeredAt: 123 } }
    }).service.derive("candidate-1");
    expect(invalid.state).toBe("UNKNOWN");
    expect(invalid.questions[2]?.resolution).toBe("UNRESOLVABLE");
  });

  it("returns a deeply frozen safe boundary object and never leaks answer keys or snapshots", async () => {
    const rows = baselineRows();
    const { service, candidateFind, questionFind } = harness(rows, { answers: correctAnswers(rows) });

    const evidence = await service.derive("owner-private");
    const serialized = JSON.stringify(evidence);
    const keys = allKeys(evidence);

    expect(evidence.schemaVersion).toBe(CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION);
    expect(evidence.registryVersion).toBe(CORE_TECHNICAL_BASELINE_REGISTRY_VERSION);
    expect(evidence.sourceFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(isDeeplyFrozen(evidence)).toBe(true);
    expect(keys).not.toContain("correctOptionId");
    expect(keys).not.toContain("choiceId");
    expect(keys).not.toContain("answeredAt");
    expect(keys).not.toContain("question");
    expect(serialized).not.toContain((rows[0]!.question as BaselineQuestion).prompt);
    expect(candidateFind).toHaveBeenCalledWith({
      where: { ownerId: "owner-private" },
      select: { preparationOnboarding: true }
    });
    expect(questionFind).toHaveBeenCalledWith({
      where: { ownerId: "owner-private", section: { in: [...CORE_TECHNICAL_BASELINE_SECTIONS] } },
      select: { section: true, questionId: true, question: true }
    });
  });

  it("creates deterministic fingerprints that change when the private source changes", async () => {
    const rows = baselineRows();
    const firstHarness = harness(rows, { answers: correctAnswers(rows) });
    const secondHarness = harness([...rows].reverse(), { answers: correctAnswers(rows) });
    const first = await firstHarness.service.derive("candidate-1");
    const second = await secondHarness.service.derive("candidate-1");
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint);

    const changedAnswers = correctAnswers(rows);
    changedAnswers["technical-1"] = {
      choiceId: (rows[0]!.question as BaselineQuestion).options[1]!.id,
      answeredAt: 999
    };
    const changed = await harness(rows, { answers: changedAnswers }).service.derive("candidate-1");
    expect(changed.sourceFingerprint).not.toBe(first.sourceFingerprint);
  });

  it("does not turn a missing profile into anonymous evidence", async () => {
    const candidateFind = vi.fn().mockResolvedValue(null);
    const service = new CoreTechnicalBaselineEvidenceService({
      candidateProfile: { findUnique: candidateFind },
      preparationBaselineQuestion: { findMany: vi.fn().mockResolvedValue([]) }
    });
    await expect(service.derive("missing-owner")).rejects.toMatchObject({
      code: "CORE_TECHNICAL_PROFILE_NOT_FOUND"
    });
  });
});

function baselineRows(): SavedRow[] {
  return CORE_TECHNICAL_BASELINE_SECTIONS.map((section, index) => ({
    section,
    questionId: `technical-${index}`,
    question: baselineQuestion(section, "backend", `technical-${index}`)
  }));
}

function correctAnswers(rows: SavedRow[]): Record<string, { choiceId: string; answeredAt: number }> {
  return Object.fromEntries(rows.map((row, index) => [
    row.section,
    { choiceId: (row.question as BaselineQuestion).correctOptionId!, answeredAt: 100 + index }
  ]));
}

function harness(rows: SavedRow[], preparationOnboarding: unknown) {
  const candidateFind = vi.fn().mockResolvedValue({ preparationOnboarding });
  const questionFind = vi.fn().mockResolvedValue(rows);
  return {
    candidateFind,
    questionFind,
    service: new CoreTechnicalBaselineEvidenceService({
      candidateProfile: { findUnique: candidateFind },
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
