import type { ResumeRoastTarget } from "@/features/resume-roast/contracts/resume-roast";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import type { AiService } from "@/server/ai/ai.service";
import {
  ResumeRoastGenerator,
  ResumeRoastGenerationError,
  validateResumeRoastDraft,
  validateResumeRoastScoring
} from "./resume-roast.generator";
import type { ResumeRoastSnapshot } from "./resume-signals";

const metricId = "experience-1-achievement-1";
const metricText = "Built API caching that reduced response time by 30%.";
const dutyId = "experience-1-achievement-2";
const dutyText = "Worked on bug fixing and enhancements for the payments service.";
const snapshot: ResumeRoastSnapshot = {
  evidence: [
    { id: metricId, kind: "experience-achievement", text: metricText },
    { id: dutyId, kind: "experience-achievement", text: dutyText },
    { id: "education-1", kind: "education", text: "BSc Computer Science · Trailgrad University" }
  ],
  warnings: [],
  topSkills: ["TypeScript", "PostgreSQL", "Redis"],
  signals: {
    bulletCount: 2,
    metricBearingBulletCount: 1,
    metricBearingEvidenceIds: [metricId],
    missingMetricBulletCount: 1,
    missingMetricEvidenceIds: [dutyId],
    repeatedLeadingVerbs: [],
    longBulletEvidenceIds: [],
    averageWordsPerBullet: 9,
    maxWordsPerBullet: 10,
    skillListSize: 3
  }
};
const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};

function dimension(score: number, note = "Clear enough for this target.", anchors: string[] = []) {
  return { score, note, evidenceAnchors: anchors };
}

function scoringDraft(scores: [number, number, number, number, number] = [4, 3, 4, 4, 4]) {
  const [roleFit, impact, ownership, technical, readability] = scores;
  return {
    dimensions: {
      roleFit: dimension(roleFit, "Clearly backend work on a payments service.", [metricId]),
      impact: dimension(impact, "One real number; the rest are duties.", ["signal:missing-metrics"]),
      ownership: dimension(ownership),
      technical: dimension(technical),
      readability: dimension(readability)
    },
    verdict: "You'd get shortlisted, but the duty bullets make the reader guess at impact."
  };
}

type RoastDraft = {
  openingRoast: string;
  spokenSummary: string;
  strength: { headline: string; explanation: string; evidenceAnchors: string[] };
  problems: Array<{
    joke: string;
    issue: string;
    recruiterImpact: string;
    improvement: string;
    dimension: "roleFit" | "impact" | "ownership" | "technical" | "readability";
    evidenceAnchors: string[];
  }>;
  rewrite: { before: string; after: string; rationale: string; evidenceAnchor: string } | null;
  actionPlan: Array<{ action: string; rationale: string }>;
};

function roastDraft(overrides: Partial<RoastDraft> = {}): RoastDraft {
  return {
    openingRoast: "One bullet brought a number; the other brought a shrug and the word enhancements.",
    spokenSummary:
      "Your caching bullet is the one adult in the room. The rest reads like a ticket queue with a job title, and nobody can tell what got better. Put a number on the payments work and say what you owned, then send it.",
    strength: {
      headline: "Caching with a result",
      explanation: "The API caching bullet names the fix and the 30% it bought.",
      evidenceAnchors: [metricId]
    },
    problems: [
      {
        joke: "\"Bug fixing and enhancements\" is what you write when the work is classified.",
        issue: "The payments bullet lists duties without saying what changed.",
        recruiterImpact: "The reader assumes you closed tickets someone else scoped.",
        improvement: "On the bug fixing bullet, name the worst bug you fixed and what it stopped breaking.",
        dimension: "impact",
        evidenceAnchors: [dutyId, "signal:missing-metrics"]
      }
    ],
    rewrite: {
      before: dutyText,
      after: "Fixed [N] production bugs in the payments service, cutting failed payments by [X]%.",
      rationale: "It says what got better and leaves the numbers for you to fill in.",
      evidenceAnchor: dutyId
    },
    actionPlan: [
      { action: "Move the caching bullet to the top", rationale: "It's the only proof of impact." }
    ],
    ...overrides
  };
}

/** A fake model that answers each pass from its own queue. */
function fakeAi(options: { scoring?: unknown[]; roast?: unknown[] } = {}) {
  const scoring = [...(options.scoring ?? [scoringDraft()])];
  const roast = [...(options.roast ?? [roastDraft()])];
  const generateStructured = vi.fn(async (request: { operation: string }) => {
    const queue = request.operation === "resume.roast.score" ? scoring : roast;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return { generateStructured };
}

/** The fakes answer by operation, so they stand in for the generic AI call. */
function generatorFor(ai: { generateStructured: unknown }, now?: () => number) {
  return new ResumeRoastGenerator(ai as unknown as Pick<AiService, "generateStructured">, now);
}

function callsFor(ai: ReturnType<typeof fakeAi>, operation: string) {
  return ai.generateStructured.mock.calls.filter(([request]) => request.operation === operation);
}

describe("ResumeRoastGenerator", () => {
  it("scores at temperature 0 and roasts in parallel, computing the score in code", async () => {
    const ai = fakeAi();
    const result = await generatorFor(ai).generate({ snapshot, target });

    expect(callsFor(ai, "resume.roast.score")).toHaveLength(1);
    expect(callsFor(ai, "resume.roast.generate")).toHaveLength(1);
    expect(callsFor(ai, "resume.roast.score")[0]![0]).toMatchObject({ temperature: 0, maxAttempts: 1 });
    expect(callsFor(ai, "resume.roast.generate")[0]![0]).toMatchObject({
      temperature: 0.7,
      maxAttempts: 1
    });
    // 4,3,4,4,4 with default weights: (120+75+80+60+40)=375 -> 1+275*9/400 = 7.19 -> 7.
    expect(result.scorecard).toMatchObject({ rubricVersion: "rubric-v1", overall: 7 });
    expect(result.verdict).toEqual({
      band: "solid",
      explanation: "You'd get shortlisted, but the duty bullets make the reader guess at impact."
    });
    expect(result.problems[0]).toMatchObject({ dimension: "impact", quote: dutyText });
    expect(result.actionPlan).toEqual([
      {
        priority: 1,
        action: "Move the caching bullet to the top",
        rationale: "It's the only proof of impact."
      }
    ]);
  });

  it("keeps a saved score by skipping the scoring pass", async () => {
    const ai = fakeAi();
    const saved = validateResumeRoastScoring(scoringDraft([5, 5, 5, 5, 4]), snapshot, target);

    const result = await generatorFor(ai).generate({ snapshot, target, assessment: saved });

    expect(callsFor(ai, "resume.roast.score")).toHaveLength(0);
    expect(result.scorecard).toEqual(saved.scorecard);
    expect(result.verdict).toEqual(saved.verdict);
  });

  it("fails before any model call when there is no evidence", async () => {
    const ai = fakeAi();
    await expect(
      generatorFor(ai).generate({ snapshot: { ...snapshot, evidence: [] }, target })
    ).rejects.toBeInstanceOf(ResumeRoastGenerationError);
    expect(ai.generateStructured).not.toHaveBeenCalled();
  });

  it("forwards cancellation to both passes", async () => {
    const ai = fakeAi();
    const controller = new AbortController();
    await generatorFor(ai).generate({ snapshot, target, signal: controller.signal });
    controller.abort();
    for (const [request] of ai.generateStructured.mock.calls) {
      expect((request as unknown as { signal: AbortSignal }).signal.aborted).toBe(true);
    }
  });

  it("retries a roast whose frame is ungrounded, once", async () => {
    const ungrounded = roastDraft({
      strength: { headline: "Vibes", explanation: "It has vibes.", evidenceAnchors: ["made-up"] }
    });
    const ai = fakeAi({ roast: [ungrounded, roastDraft()] });

    await expect(generatorFor(ai).generate({ snapshot, target })).resolves.toMatchObject({
      strength: { evidenceAnchors: [metricId] }
    });
    expect(callsFor(ai, "resume.roast.generate")).toHaveLength(2);

    const alwaysBad = fakeAi({ roast: [ungrounded] });
    await expect(
      generatorFor(alwaysBad).generate({ snapshot, target })
    ).rejects.toBeInstanceOf(ResumeRoastGenerationError);
    expect(callsFor(alwaysBad, "resume.roast.generate")).toHaveLength(2);
  });

  it("does not immediately retry an invalid fallback response", async () => {
    const invalidFallback = new AiProviderException({
      code: "AI_INVALID_RESPONSE",
      message: "schema miss",
      provider: "groq",
      operation: "resume.roast.generate-fallback",
      retryable: true
    });
    const ai = fakeAi({ roast: [invalidFallback] });

    await expect(generatorFor(ai).generate({ snapshot, target })).rejects.toBe(
      invalidFallback
    );
    expect(callsFor(ai, "resume.roast.generate")).toHaveLength(1);
  });

  it("does not start a retry that could not finish inside the budget", async () => {
    let now = 0;
    const invalid = new ResumeRoastGenerationError();
    const ai = {
      generateStructured: vi.fn(async (request: { operation: string }) => {
        if (request.operation === "resume.roast.score") return scoringDraft();
        now += 30_000;
        throw invalid;
      })
    };

    await expect(
      generatorFor(ai, () => now).generate({ snapshot, target })
    ).rejects.toBe(invalid);
    expect(callsFor(ai as never, "resume.roast.generate")).toHaveLength(1);
  });
});

describe("validateResumeRoastScoring", () => {
  it("drops invented anchors but keeps the judgement", () => {
    const draft = scoringDraft();
    draft.dimensions.technical = dimension(4, "Redis and PostgreSQL in real work.", ["made-up", metricId]);
    const { scorecard } = validateResumeRoastScoring(draft, snapshot, target);
    expect(scorecard.dimensions.technical).toEqual({
      score: 4,
      note: "Redis and PostgreSQL in real work.",
      evidenceAnchors: [metricId]
    });
  });

  it("replaces internal IDs that leak into notes", () => {
    const draft = scoringDraft();
    draft.dimensions.impact = dimension(2, `Only ${metricId} has a number.`);
    expect(validateResumeRoastScoring(draft, snapshot, target).scorecard.dimensions.impact.note).toBe(
      "Only one bullet has a number."
    );
  });

  it("rejects a verdict that quotes a score or a hiring chance", () => {
    for (const verdict of ["I'd give this 7/10.", "Your chance of an interview is 80%."]) {
      expect(() =>
        validateResumeRoastScoring({ ...scoringDraft(), verdict }, snapshot, target)
      ).toThrow(ResumeRoastGenerationError);
    }
  });

  it("rejects out-of-range dimension scores", () => {
    expect(() =>
      validateResumeRoastScoring(scoringDraft([6, 3, 3, 3, 3]), snapshot, target)
    ).toThrow(ResumeRoastGenerationError);
  });
});

describe("validateResumeRoastDraft", () => {
  it("drops an ungrounded or unsafe problem and keeps the rest", () => {
    const good = roastDraft().problems[0]!;
    const sections = validateResumeRoastDraft(
      roastDraft({
        problems: [
          { ...good, evidenceAnchors: ["made-up"] },
          { ...good, joke: "Your ATS score is 40%." },
          good
        ]
      }),
      snapshot
    );
    expect(sections.problems).toHaveLength(1);
    expect(sections.problems[0]?.joke).toBe(good.joke);
  });

  it("keeps at most three problems", () => {
    const good = roastDraft().problems[0]!;
    expect(
      validateResumeRoastDraft(roastDraft({ problems: [good, good, good, good] }), snapshot).problems
    ).toHaveLength(3);
  });

  it("rejects fake scores, ratings and hiring chances in the frame", () => {
    for (const openingRoast of [
      "Your ATS score is 42.",
      "I rate this 6/10.",
      "Your odds of an offer are 30%."
    ]) {
      expect(() => validateResumeRoastDraft(roastDraft({ openingRoast }), snapshot)).toThrow(
        ResumeRoastGenerationError
      );
    }
    // Business metrics are fine.
    expect(() =>
      validateResumeRoastDraft(
        roastDraft({ openingRoast: "You cut response time by 30%, then went quiet." }),
        snapshot
      )
    ).not.toThrow();
  });

  it("rejects personal insults and protected-trait humour", () => {
    for (const openingRoast of [
      "You are lazy and it shows.",
      "This reads like your age is the problem."
    ]) {
      expect(() => validateResumeRoastDraft(roastDraft({ openingRoast }), snapshot)).toThrow(
        ResumeRoastGenerationError
      );
    }
  });

  it("replaces internal IDs that leak into readable text", () => {
    const good = roastDraft().problems[0]!;
    const sections = validateResumeRoastDraft(
      roastDraft({
        problems: [{ ...good, improvement: `On the ${dutyId} bullet, name the worst bug you fixed.` }],
        actionPlan: [{ action: `Lead with ${metricId}`, rationale: "It has the only number." }]
      }),
      snapshot
    );
    expect(sections.problems[0]?.improvement).toBe("On this bullet, name the worst bug you fixed.");
    expect(sections.actionPlan[0]?.action).toBe("Lead with one of your bullets");
  });

  it("drops an action that just repeats a problem's fix", () => {
    const sections = validateResumeRoastDraft(
      roastDraft({
        actionPlan: [
          { action: "Name the worst bug you fixed", rationale: "Same thing again." },
          { action: "Move the caching bullet to the top", rationale: "Lead with proof." }
        ]
      }),
      snapshot
    );
    expect(sections.actionPlan).toEqual([
      { priority: 1, action: "Move the caching bullet to the top", rationale: "Lead with proof." }
    ]);
  });

  describe("rewrite grounding", () => {
    const withRewrite = (after: string, before = dutyText, evidenceAnchor = dutyId) =>
      validateResumeRoastDraft(
        roastDraft({ rewrite: { before, after, rationale: "Reads better.", evidenceAnchor } }),
        snapshot
      ).rewrite;

    it("accepts placeholders for numbers the person fills in", () => {
      expect(withRewrite("Fixed [N] payments bugs, cutting failed payments by [X]%.")).not.toBeNull();
    });

    it("drops a rewrite that invents a number", () => {
      expect(withRewrite("Fixed 40 payments bugs in the payments service.")).toBeNull();
    });

    it("drops a rewrite that swaps a real number for a placeholder", () => {
      expect(
        withRewrite("Built API caching that reduced response time by [X]%.", metricText, metricId)
      ).toBeNull();
    });

    it("drops a rewrite that inflates scope or adds claims", () => {
      expect(withRewrite("Led the payments service's bug fixing and enhancements.")).toBeNull();
      expect(withRewrite("Architected real-time fixes for the payments service.")).toBeNull();
    });

    it("drops a rewrite that adds technology the resume never mentions", () => {
      expect(withRewrite("Fixed payments bugs using Kubernetes and Go services.")).toBeNull();
      // Redis is in the skills list, so naming it is grounded.
      expect(withRewrite("Fixed payments bugs, adding Redis locks to stop double charges.")).not.toBeNull();
    });

    it("drops a rewrite that isn't the anchored bullet, is unchanged, or uses education", () => {
      expect(withRewrite("Fixed payments bugs.", "Something else entirely.")).toBeNull();
      expect(withRewrite(dutyText)).toBeNull();
      expect(
        withRewrite(
          "BSc Computer Science",
          "BSc Computer Science · Trailgrad University",
          "education-1"
        )
      ).toBeNull();
    });
  });
});
