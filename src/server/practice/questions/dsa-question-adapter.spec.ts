import { dsaPhases, phaseSlug } from "@/lib/dsa/dsa";
import { supportedDsaCodeLanguages } from "@/lib/dsa/dsa-code-templates";
import { normalizeDsaQuestion } from "./dsa-question-adapter";

describe("DSA practice question adapter", () => {
  const normalized = dsaPhases().flatMap((phase) =>
    phase.questions.map((question) => normalizeDsaQuestion(question, phaseSlug(phase.phase)))
  );

  it("normalizes every authored DSA question to a unique canonical identity", () => {
    expect(normalized).toHaveLength(200);
    expect(new Set(normalized.map((question) => question.identity.canonicalId)).size).toBe(200);
    expect(normalized.every((question) => question.schemaVersion === 1)).toBe(true);
    expect(normalized.every((question) => question.identity.contentVersion === 1)).toBe(true);
  });

  it("provides complete teaching and evaluation material", () => {
    for (const question of normalized) {
      expect(question.content.prompt.length).toBeGreaterThan(0);
      expect(question.content.examples.length).toBeGreaterThan(0);
      expect(question.coaching.hints.length).toBeGreaterThan(0);
      expect(question.coaching.approaches.length).toBeGreaterThan(0);
      expect(question.evaluation.authoredTestCount).toBeGreaterThan(0);
      expect(question.evaluation.rubric.reduce((total, item) => total + item.weight, 0)).toBe(100);
    }
  });

  it("advertises only the languages supported by each runner", () => {
    for (const question of normalized) {
      expect(question.code?.supportedLanguages).toEqual(
        supportedDsaCodeLanguages(question.identity.sourceKey)
      );
      expect(Object.keys(question.code?.starterCode ?? {})).toEqual(
        question.code?.supportedLanguages
      );
    }
  });
});
