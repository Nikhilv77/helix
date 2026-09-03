import type { ResumeRoastResult, ResumeRoastTarget } from "@/lib/resume-roast/contracts";
import {
  ResumeRoastGenerator,
  ResumeRoastGenerationError,
  validateResumeRoastResult
} from "./resume-roast.generator";
import type { ResumeRoastSnapshot } from "./resume-signals";

const evidenceId = "experience-1-achievement-1";
const evidenceText = "Built API caching that reduced response time by 30%.";
const snapshot: ResumeRoastSnapshot = {
  evidence: [
    { id: evidenceId, kind: "experience-achievement", text: evidenceText },
    { id: "education-1", kind: "education", text: "BSc Computer Science · Trailgrad University" }
  ],
  warnings: [],
  topSkills: ["TypeScript", "PostgreSQL"],
  signals: {
    bulletCount: 1,
    metricBearingBulletCount: 1,
    metricBearingEvidenceIds: [evidenceId],
    missingMetricBulletCount: 0,
    missingMetricEvidenceIds: [],
    repeatedLeadingVerbs: [],
    longBulletEvidenceIds: [],
    averageWordsPerBullet: 8,
    maxWordsPerBullet: 8,
    skillListSize: 2
  }
};
const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};

function result(overrides: Partial<ResumeRoastResult> = {}): ResumeRoastResult {
  return {
    openingRoast: "This bullet brought receipts instead of vibes. Rude, but effective.",
    spokenSummary:
      "This resume actually brought proof, which is deeply inconvenient for a roast. The strongest bullet is specific, measurable, and easy to trust. Keep that same energy everywhere else and James may need a different hobby.",
    strength: {
      headline: "Specific performance evidence",
      explanation: "The bullet names the system and preserves a measurable outcome.",
      evidenceAnchors: [evidenceId]
    },
    problems: [],
    rewrite: {
      before: evidenceText,
      after: "Built API caching, reducing response time by 30%.",
      rationale: "The rewrite leads with ownership while keeping the stated metric.",
      evidenceAnchor: evidenceId
    },
    verdict: {
      band: "difficult-to-roast",
      explanation: "The available evidence is clear and concrete.",
      targetFitScore: 92
    },
    actionPlan: [
      {
        priority: 1,
        action: "Keep this evidence style",
        rationale: "It makes impact easy to scan."
      }
    ],
    ...overrides
  };
}

describe("ResumeRoastGenerator", () => {
  it.each([
    [
      "weak",
      result({
        verdict: {
          band: "needs-serious-work",
          explanation: "The available evidence needs clearer detail.",
          targetFitScore: 28
        }
      })
    ],
    [
      "average",
      result({
        verdict: {
          band: "has-potential",
          explanation: "The available evidence has a useful starting point.",
          targetFitScore: 61
        }
      })
    ],
    [
      "strong",
      result({
        verdict: {
          band: "strong",
          explanation: "The available evidence supports the target well.",
          targetFitScore: 84
        }
      })
    ],
    ["difficult to roast", result()]
  ])(
    "accepts grounded %s fixtures through exactly one model request",
    async (_fixture, response) => {
      const generateStructured = vi.fn().mockResolvedValue(response);
      const generator = new ResumeRoastGenerator({ generateStructured } as never);

      await expect(generator.generate({ snapshot, target })).resolves.toEqual(response);
      expect(generateStructured).toHaveBeenCalledTimes(1);
      expect(generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "resume.roast.generate",
          modelClass: "fast",
          temperature: 0.3,
          timeoutMs: 60_000,
          maxAttempts: 1
        })
      );
      expect(generateStructured.mock.calls[0]?.[0].attachments).toBeUndefined();
    }
  );

  it("forwards cancellation to the single structured request", async () => {
    const generateStructured = vi.fn().mockResolvedValue(result());
    const generator = new ResumeRoastGenerator({ generateStructured } as never);
    const controller = new AbortController();

    await generator.generate({ snapshot, target, signal: controller.signal });
    expect(generateStructured.mock.calls[0]?.[0]).toMatchObject({ signal: controller.signal });
  });

  it("fails safely without calling AI when no resume evidence is available", async () => {
    const generateStructured = vi.fn();
    const generator = new ResumeRoastGenerator({ generateStructured } as never);

    await expect(
      generator.generate({ snapshot: { ...snapshot, evidence: [] }, target })
    ).rejects.toBeInstanceOf(ResumeRoastGenerationError);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("requires a dedicated spoken summary for every new roast", async () => {
    const generateStructured = vi.fn().mockResolvedValue(result({ spokenSummary: undefined }));
    const generator = new ResumeRoastGenerator({ generateStructured } as never);

    await expect(generator.generate({ snapshot, target })).rejects.toBeInstanceOf(
      ResumeRoastGenerationError
    );
  });

  it("rejects schema-invalid action plans and ungrounded anchors", () => {
    expect(() => validateResumeRoastResult(result({ actionPlan: [] }), snapshot)).toThrow(
      ResumeRoastGenerationError
    );
    expect(() =>
      validateResumeRoastResult(
        result({
          actionPlan: [
            ...result().actionPlan,
            { priority: 2, action: "Second", rationale: "Second reason" },
            { priority: 3, action: "Third", rationale: "Third reason" },
            { priority: 4, action: "Fourth", rationale: "Fourth reason" }
          ]
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
    expect(() =>
      validateResumeRoastResult(
        result({ strength: { ...result().strength, evidenceAnchors: ["unknown"] } }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
    expect(() =>
      validateResumeRoastResult(
        result({ problems: [{ ...problem(), evidenceAnchors: ["signal:unknown"] }] }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
  });

  it("rejects rewrite text that is not the anchored bullet or invents a number", () => {
    expect(() =>
      validateResumeRoastResult(
        result({
          rewrite: { ...result().rewrite!, before: "Different bullet", after: "Different bullet" }
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
    expect(() =>
      validateResumeRoastResult(
        result({
          rewrite: {
            ...result().rewrite!,
            after: "Built API caching that reduced response time by 99%."
          }
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
  });

  it("rejects fake ATS or offer scores", () => {
    expect(() =>
      validateResumeRoastResult(
        result({
          verdict: { band: "strong", explanation: "ATS score: 98.", targetFitScore: 84 }
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
    expect(() =>
      validateResumeRoastResult(
        result({
          verdict: {
            band: "strong",
            explanation: "Your offer probability is high.",
            targetFitScore: 84
          }
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
  });

  it("accepts only a bounded structured target-fit score", () => {
    expect(() => validateResumeRoastResult(result(), snapshot)).not.toThrow();
    expect(() =>
      validateResumeRoastResult(
        result({
          verdict: {
            band: "strong",
            explanation: "The available evidence supports the selected target.",
            targetFitScore: 101
          }
        }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
  });

  it("rejects unsupported numerical ratings, matches, and chances but allows business metrics", () => {
    for (const unsafeText of [
      "I give this resume 7/10.",
      "This gets 85 out of 100.",
      "Your match is 85%.",
      "The score is 85%.",
      "Your chance is 85%."
    ]) {
      expect(() =>
        validateResumeRoastResult(
          result({ verdict: { band: "strong", explanation: unsafeText, targetFitScore: 84 } }),
          snapshot
        )
      ).toThrow(ResumeRoastGenerationError);
    }

    expect(() =>
      validateResumeRoastResult(
        result({
          verdict: {
            band: "strong",
            explanation: "The 30% latency reduction and 99.99% availability are concrete evidence.",
            targetFitScore: 84
          }
        }),
        snapshot
      )
    ).not.toThrow();
  });

  it("rejects personal insults and protected-trait humour", () => {
    expect(() =>
      validateResumeRoastResult(result({ openingRoast: "You’re lazy, apparently." }), snapshot)
    ).toThrow(ResumeRoastGenerationError);
    expect(() =>
      validateResumeRoastResult(
        result({ problems: [{ ...problem(), joke: "A joke about age is not useful." }] }),
        snapshot
      )
    ).toThrow(ResumeRoastGenerationError);
  });
});

function problem(): ResumeRoastResult["problems"][number] {
  return {
    joke: "This evidence is wearing a trench coat made of buzzwords.",
    issue: "The bullet needs a clearer result.",
    recruiterImpact: "Readers cannot quickly assess the outcome.",
    improvement: "Lead with a concrete result that is actually supported.",
    evidenceAnchors: [evidenceId]
  };
}
