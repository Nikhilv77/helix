import { z } from "zod";
import {
  RESUME_ROAST_DIMENSIONS,
  ResumeRoastResultSchema,
  type ResumeRoastDimensionKey,
  type ResumeRoastResult,
  type ResumeRoastScorecard,
  type ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import { detectExplicitResumeTechnologies } from "@/features/onboarding/server/resume/technology-detector";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import type { AiService } from "@/server/ai/ai.service";
import type {
  AiCallTrace,
  AiModelClass
} from "@/server/ai/interfaces/system-designer-ai-provider.interface";
import {
  buildResumeRoastPrompt,
  buildResumeRoastScoringPrompt,
  RESUME_ROAST_SCORING_SYSTEM_INSTRUCTION,
  RESUME_ROAST_SYSTEM_INSTRUCTION
} from "./resume-roast.prompt";
import { resumeRoastBandFor, resumeRoastScorecard } from "./resume-roast.rubric";
import type { ResumeRoastEvidenceItem, ResumeRoastSnapshot } from "./resume-signals";

/**
 * End-to-end budget for both model passes, retries included. It stays under
 * the route's 60 s function limit with room to persist the result.
 */
export const RESUME_ROAST_GENERATION_BUDGET_MS = 45_000;
/** A retry only starts when it could still finish a primary + fallback pass. */
const RESUME_ROAST_MIN_RETRY_BUDGET_MS = 20_000;
const RESUME_ROAST_VALIDATION_ATTEMPTS = 2;
/** Low enough for grounding to hold, high enough for jokes that aren't stock. */
const RESUME_ROAST_TEMPERATURE = 0.7;
/** Temperature 0 alone still varies between runs; a fixed seed narrows it. */
const RESUME_ROAST_SCORING_SEED = 7;

/** Safe error: it deliberately contains no resume or model-produced text. */
export class ResumeRoastGenerationError extends Error {
  constructor() {
    super("Resume Roast generation returned unsupported feedback");
    this.name = ResumeRoastGenerationError.name;
  }
}

/** A saved scorecard and verdict, reused so a re-roast keeps the same score. */
export interface ResumeRoastAssessment {
  scorecard: ResumeRoastScorecard;
  verdict: ResumeRoastResult["verdict"];
}

export interface GenerateResumeRoastInput {
  snapshot: ResumeRoastSnapshot;
  target: ResumeRoastTarget;
  /** When present, only the roast pass runs and the score is unchanged. */
  assessment?: ResumeRoastAssessment | null;
  signal?: AbortSignal;
  /** Metadata for each provider attempt (never prompt or response text). */
  onTrace?: (trace: AiCallTrace) => void;
}

// Model-facing schemas are looser than the public contract on counts, so one
// extra anchor or problem is trimmed instead of failing the whole response.
const anchorList = z.array(z.string().trim().min(1).max(500)).max(5);
const draftText = z.string().trim().min(1).max(360);

const DimensionDraftSchema = z
  .object({
    score: z.number().int().min(1).max(5),
    note: draftText,
    evidenceAnchors: anchorList
  })
  .strict();

export const ResumeRoastScoringDraftSchema = z
  .object({
    dimensions: z
      .object({
        roleFit: DimensionDraftSchema,
        impact: DimensionDraftSchema,
        ownership: DimensionDraftSchema,
        technical: DimensionDraftSchema,
        readability: DimensionDraftSchema
      })
      .strict(),
    verdict: draftText
  })
  .strict();

const dimensionKeys = RESUME_ROAST_DIMENSIONS.map((dimension) => dimension.key) as [
  ResumeRoastDimensionKey,
  ...ResumeRoastDimensionKey[]
];

export const ResumeRoastDraftSchema = z
  .object({
    openingRoast: z.string().trim().min(1).max(300),
    spokenSummary: z.string().trim().min(1).max(800),
    strength: z
      .object({
        headline: z.string().trim().min(1).max(120),
        explanation: draftText,
        evidenceAnchors: anchorList.min(1)
      })
      .strict(),
    problems: z
      .array(
        z
          .object({
            joke: z.string().trim().min(1).max(300),
            issue: draftText,
            recruiterImpact: draftText,
            improvement: draftText,
            dimension: z.enum(dimensionKeys),
            evidenceAnchors: anchorList.min(1)
          })
          .strict()
      )
      .max(5),
    rewrite: z
      .object({
        before: z.string().trim().min(1).max(1_500),
        after: z.string().trim().min(1).max(1_500),
        rationale: draftText,
        evidenceAnchor: z.string().trim().min(1).max(500)
      })
      .strict()
      .nullable(),
    actionPlan: z
      .array(z.object({ action: z.string().trim().min(1).max(300), rationale: draftText }).strict())
      .max(5)
  })
  .strict();

type ScoringDraft = z.infer<typeof ResumeRoastScoringDraftSchema>;
type RoastDraft = z.infer<typeof ResumeRoastDraftSchema>;
type RoastSections = Omit<ResumeRoastResult, "verdict" | "scorecard">;

/**
 * Two model passes in parallel: a temperature-0 scoring pass against the
 * rubric (skipped when a saved assessment is supplied) and the roast itself.
 * Each response is validated section by section, so one ungrounded problem
 * is dropped rather than discarding the whole roast.
 */
export class ResumeRoastGenerator {
  constructor(
    private readonly ai: Pick<AiService, "generateStructured">,
    private readonly now: () => number = Date.now,
    private readonly scoringModelClass: AiModelClass = "fast"
  ) {}

  async generate(input: GenerateResumeRoastInput): Promise<ResumeRoastResult> {
    // No evidence means no truthful roast can be generated. Fail before an AI
    // request instead of inviting the model to manufacture feedback.
    if (input.snapshot.evidence.length === 0) throw new ResumeRoastGenerationError();

    const deadline = this.now() + RESUME_ROAST_GENERATION_BUDGET_MS;
    const signalAnchorIds = getResumeRoastSignalAnchorIds(input.snapshot);
    // If one pass fails for good, stop paying for the other.
    const sibling = new AbortController();
    const signal = input.signal ? AbortSignal.any([input.signal, sibling.signal]) : sibling.signal;

    const run = <T>(task: Promise<T>) =>
      task.catch((error: unknown) => {
        sibling.abort();
        throw error;
      });

    const [assessment, sections] = await Promise.all([
      input.assessment
        ? Promise.resolve(input.assessment)
        : run(
            this.withRetry(deadline, async (timeoutMs) =>
              validateResumeRoastScoring(
                await this.ai.generateStructured({
                  operation: "resume.roast.score",
                  systemInstruction: RESUME_ROAST_SCORING_SYSTEM_INSTRUCTION,
                  prompt: buildResumeRoastScoringPrompt(
                    input.snapshot,
                    input.target,
                    signalAnchorIds
                  ),
                  schema: ResumeRoastScoringDraftSchema,
                  modelClass: this.scoringModelClass,
                  // The score must not depend on the dice. Saved scorecards are
                  // also reused for re-roasts of the same resume and target.
                  temperature: 0,
                  seed: RESUME_ROAST_SCORING_SEED,
                  timeoutMs,
                  maxAttempts: 1,
                  signal,
                  ...(input.onTrace ? { onTrace: input.onTrace } : {})
                }),
                input.snapshot,
                input.target,
                signalAnchorIds
              )
            )
          ),
      run(
        this.withRetry(deadline, async (timeoutMs) =>
          validateResumeRoastDraft(
            await this.ai.generateStructured({
              operation: "resume.roast.generate",
              systemInstruction: RESUME_ROAST_SYSTEM_INSTRUCTION,
              prompt: buildResumeRoastPrompt(input.snapshot, input.target, signalAnchorIds),
              schema: ResumeRoastDraftSchema,
              modelClass: "fast",
              temperature: RESUME_ROAST_TEMPERATURE,
              timeoutMs,
              // Provider retries stay disabled here. The bounded outer retry
              // covers invalid JSON/schema and Roast-specific grounding failures.
              maxAttempts: 1,
              signal,
              ...(input.onTrace ? { onTrace: input.onTrace } : {})
            }),
            input.snapshot,
            signalAnchorIds
          )
        )
      )
    ]);

    const result = ResumeRoastResultSchema.safeParse({
      ...sections,
      verdict: assessment.verdict,
      scorecard: assessment.scorecard
    });
    if (!result.success) throw new ResumeRoastGenerationError();
    return result.data;
  }

  private async withRetry<T>(
    deadline: number,
    attempt: (timeoutMs: number) => Promise<T>
  ): Promise<T> {
    for (let index = 1; ; index += 1) {
      const remaining = deadline - this.now();
      try {
        return await attempt(Math.max(1_000, remaining));
      } catch (error) {
        const invalidResponse =
          error instanceof ResumeRoastGenerationError ||
          (error instanceof AiProviderException &&
            error.code === "AI_INVALID_RESPONSE" &&
            // A fallback provider has already consumed the failover path. An
            // immediate second pass would hit that provider again while the
            // primary is cooling down and commonly turns a schema miss into a
            // rate-limit failure.
            !error.operation.endsWith("-fallback"));
        if (
          !invalidResponse ||
          index >= RESUME_ROAST_VALIDATION_ATTEMPTS ||
          deadline - this.now() < RESUME_ROAST_MIN_RETRY_BUDGET_MS
        ) {
          throw error;
        }
      }
    }
  }
}

/**
 * Stable synthetic anchors reference deterministic signal categories, rather
 * than model-invented claims. They are only accepted for a matching snapshot.
 */
export function getResumeRoastSignalAnchorIds(snapshot: ResumeRoastSnapshot): string[] {
  const anchors: string[] = [];
  // A short skills list is not a defect. This allows the model to call out a
  // genuinely hard-to-scan list without manufacturing criticism for 2 skills.
  if (snapshot.signals.skillListSize >= 16) anchors.push("signal:skill-list-size");
  if (snapshot.signals.missingMetricEvidenceIds.length > 0) anchors.push("signal:missing-metrics");
  if (snapshot.signals.longBulletEvidenceIds.length > 0) anchors.push("signal:long-bullets");
  // Two bullets starting "Built" is normal writing; a recruiter only notices
  // the pattern from three onwards.
  for (const repeatedVerb of snapshot.signals.repeatedLeadingVerbs) {
    if (repeatedVerb.count >= 3) anchors.push(`signal:repeated-leading-verb:${repeatedVerb.verb}`);
  }
  return anchors;
}

export function validateResumeRoastScoring(
  value: unknown,
  snapshot: ResumeRoastSnapshot,
  target: ResumeRoastTarget,
  signalAnchorIds = getResumeRoastSignalAnchorIds(snapshot)
): ResumeRoastAssessment {
  const parsed = ResumeRoastScoringDraftSchema.safeParse(value);
  if (!parsed.success) throw new ResumeRoastGenerationError();
  const draft: ScoringDraft = parsed.data;
  const allowed = new Set([...snapshot.evidence.map((item) => item.id), ...signalAnchorIds]);

  // Notes quote resume details ("disabled caching", "veteran-owned client"),
  // so only the verdict, which speaks about the person's chances, is screened.
  if (containsProtectedTraitOrInsult(draft.verdict)) throw new ResumeRoastGenerationError();
  // The number belongs in the scorecard. A verdict that quotes one, or a
  // hiring probability, would contradict the calculated overall.
  if (containsUnsupportedScoreOrProbability(draft.verdict)) throw new ResumeRoastGenerationError();

  const dimensions = Object.fromEntries(
    RESUME_ROAST_DIMENSIONS.map(({ key }) => {
      const dimension = draft.dimensions[key];
      return [
        key,
        {
          score: dimension.score,
          note: withoutInternalIds(dimension.note, "one bullet"),
          // An invented anchor only loses its citation; the judgement stands.
          evidenceAnchors: dedupe(dimension.evidenceAnchors.filter((id) => allowed.has(id))).slice(0, 2)
        }
      ];
    })
  ) as ResumeRoastScorecard["dimensions"];

  const scorecard = resumeRoastScorecard(dimensions, target);
  return {
    scorecard,
    verdict: {
      band: resumeRoastBandFor(scorecard.overall),
      explanation: withoutInternalIds(draft.verdict, "one bullet")
    }
  };
}

export function validateResumeRoastDraft(
  value: unknown,
  snapshot: ResumeRoastSnapshot,
  signalAnchorIds = getResumeRoastSignalAnchorIds(snapshot)
): RoastSections {
  const parsed = ResumeRoastDraftSchema.safeParse(value);
  if (!parsed.success) throw new ResumeRoastGenerationError();
  const draft = readableDraft(parsed.data);

  const evidenceById = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const problemAnchorIds = new Set([...evidenceById.keys(), ...signalAnchorIds]);

  // The frame of the roast must be sound; these failures justify a retry.
  const strengthAnchors = dedupe(draft.strength.evidenceAnchors.filter((id) => evidenceById.has(id)));
  if (strengthAnchors.length === 0) throw new ResumeRoastGenerationError();
  const frameText = [
    draft.openingRoast,
    draft.spokenSummary,
    draft.strength.headline,
    draft.strength.explanation
  ];
  if (frameText.some(containsUnsupportedScoreOrProbability)) throw new ResumeRoastGenerationError();
  if ([draft.openingRoast, draft.spokenSummary].some(containsProtectedTraitOrInsult)) {
    throw new ResumeRoastGenerationError();
  }

  // Individual sections are dropped when they fail, keeping the rest.
  const problems = draft.problems
    .flatMap((problem) => {
      const anchors = dedupe(problem.evidenceAnchors.filter((id) => problemAnchorIds.has(id))).slice(0, 3);
      if (anchors.length === 0) return [];
      const text = [problem.joke, problem.issue, problem.recruiterImpact, problem.improvement];
      if (text.some(containsUnsupportedScoreOrProbability)) return [];
      if (containsProtectedTraitOrInsult(problem.joke)) return [];
      const quote = anchors.map((id) => evidenceById.get(id)?.text).find(Boolean);
      return [
        {
          joke: problem.joke,
          issue: problem.issue,
          recruiterImpact: problem.recruiterImpact,
          improvement: problem.improvement,
          evidenceAnchors: anchors,
          dimension: problem.dimension,
          ...(quote ? { quote } : {})
        }
      ];
    })
    .slice(0, 3);

  const rewrite =
    draft.rewrite && isGroundedRewrite(draft.rewrite, evidenceById, snapshot) ? draft.rewrite : null;

  const improvements = problems.map((problem) => problem.improvement);
  const actionPlan = draft.actionPlan
    .filter(
      (action) =>
        ![action.action, action.rationale].some(containsUnsupportedScoreOrProbability) &&
        !improvements.some((improvement) => repeats(action.action, improvement))
    )
    .slice(0, 3)
    .map((action, index) => ({ priority: index + 1, ...action }));

  return {
    openingRoast: draft.openingRoast,
    spokenSummary: draft.spokenSummary,
    strength: {
      headline: draft.strength.headline,
      explanation: draft.strength.explanation,
      evidenceAnchors: strengthAnchors.slice(0, 3)
    },
    problems,
    rewrite,
    actionPlan
  };
}

/**
 * Validates a complete saved or assembled result, used for results that did
 * not come through the draft path (for example in tests and replays).
 */
export function validateResumeRoastResult(value: unknown): ResumeRoastResult {
  const parsed = ResumeRoastResultSchema.safeParse(value);
  if (!parsed.success) throw new ResumeRoastGenerationError();
  return parsed.data;
}

function readableDraft(draft: RoastDraft): RoastDraft {
  const general = (text: string) => withoutInternalIds(text, "one of your bullets");
  const local = (text: string) => withoutInternalIds(text, "this bullet");
  return {
    ...draft,
    openingRoast: general(draft.openingRoast),
    spokenSummary: general(draft.spokenSummary),
    strength: {
      ...draft.strength,
      headline: general(draft.strength.headline),
      explanation: general(draft.strength.explanation)
    },
    problems: draft.problems.map((problem) => ({
      ...problem,
      joke: local(problem.joke),
      issue: local(problem.issue),
      recruiterImpact: local(problem.recruiterImpact),
      improvement: local(problem.improvement)
    })),
    rewrite: draft.rewrite ? { ...draft.rewrite, rationale: general(draft.rewrite.rationale) } : null,
    actionPlan: draft.actionPlan.map((action) => ({
      action: general(action.action),
      rationale: general(action.rationale)
    }))
  };
}

function isGroundedRewrite(
  rewrite: NonNullable<RoastDraft["rewrite"]>,
  evidenceById: ReadonlyMap<string, ResumeRoastEvidenceItem>,
  snapshot: ResumeRoastSnapshot
): boolean {
  const evidence = evidenceById.get(rewrite.evidenceAnchor);
  if (!evidence || evidence.kind === "education") return false;
  if (normalizeWhitespace(rewrite.before) !== normalizeWhitespace(evidence.text)) return false;
  if (normalizeWhitespace(rewrite.after) === normalizeWhitespace(rewrite.before)) return false;
  if ([rewrite.after, rewrite.rationale].some(containsUnsupportedScoreOrProbability)) return false;

  // Placeholders like "[X]%" are the honest way to suggest a number.
  const after = rewrite.after.replace(/\[[^\]]{1,40}\]/g, " ");
  const beforeNumbers = new Set(extractNumericTokens(rewrite.before));
  const afterNumbers = new Set(extractNumericTokens(after));
  if ([...afterNumbers].some((token) => !beforeNumbers.has(token))) return false;
  // Real numbers are the most valuable part of a bullet; a placeholder must
  // never replace one ("12 partner banks" -> "[N] partner banks").
  if ([...beforeNumbers].some((token) => !afterNumbers.has(token))) return false;
  const afterWords = new Set(after.toLocaleLowerCase("en").match(/[a-z]+/g) ?? []);
  if (numberWords(rewrite.before).some((word) => !afterWords.has(word))) return false;
  if (inflatedClaims(after).some((claim) => !inflatedClaims(rewrite.before).includes(claim))) {
    return false;
  }

  // A rewrite may only name technology the resume already mentions somewhere.
  const known = new Set(
    detectExplicitResumeTechnologies(
      [
        rewrite.before,
        ...snapshot.evidence.map((item) => item.text),
        `Technologies: ${snapshot.topSkills.join(", ")}`
      ].join("\n")
    )
  );
  return detectExplicitResumeTechnologies(after).every((technology) => known.has(technology));
}

/**
 * Wording that upgrades a bullet's scope or scale. A rewrite may keep these
 * when the original said them, never introduce them.
 */
const INFLATED_CLAIMS: ReadonlyArray<readonly [string, RegExp]> = [
  ["architect", /\barchitect(?:ed|ing|s)?\b/i],
  ["spearhead", /\bspearhead(?:ed|ing|s)?\b/i],
  ["lead", /\b(?:led|lead(?:s|ing)?)\b/i],
  ["own", /\b(?:own(?:ed|s|ing)?|ownership)\b/i],
  ["drive", /\b(?:drove|driv(?:e|es|ing|en))\b/i],
  ["head", /\bheaded\b/i],
  ["direct", /\bdirect(?:ed|ing)\b/i],
  ["manage", /\bmanag(?:e|ed|es|ing)\b/i],
  ["mentor", /\bmentor(?:ed|ing|s)?\b/i],
  ["found", /\bfounded\b/i],
  ["pioneer", /\bpioneer(?:ed|ing|s)?\b/i],
  ["champion", /\bchampion(?:ed|ing|s)?\b/i],
  ["orchestrate", /\borchestrat(?:e|ed|es|ing)\b/i],
  ["real-time", /\breal[-\s]?time\b/i],
  ["scalable", /\bscal(?:able|ability)\b/i],
  ["high-performance", /\bhigh[-\s](?:performance|availability|throughput)\b/i],
  ["enterprise", /\benterprise\b/i],
  ["mission-critical", /\bmission[-\s]critical\b/i],
  ["production-grade", /\bproduction[-\s]grade\b/i],
  ["distributed", /\bdistributed\b/i],
  ["large-scale", /\blarge[-\s]scale\b/i],
  ["magnitude", /\b(?:millions|thousands|billions)\b/i],
  ["global", /\bglobal(?:ly)?\b/i],
  ["cross-functional", /\bcross[-\s]functional\b/i]
];

const NUMBER_WORDS = new Set([
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "dozen",
  "dozens",
  "hundred",
  "hundreds",
  "thousand",
  "thousands",
  "million",
  "millions"
]);

function numberWords(text: string): string[] {
  return (text.toLocaleLowerCase("en").match(/[a-z]+/g) ?? []).filter((word) =>
    NUMBER_WORDS.has(word)
  );
}

function inflatedClaims(text: string): string[] {
  return INFLATED_CLAIMS.filter(([, pattern]) => pattern.test(text)).map(([claim]) => claim);
}

const STOP_WORDS = new Set([
  "your",
  "with",
  "that",
  "this",
  "from",
  "into",
  "more",
  "each",
  "every",
  "them",
  "they",
  "about",
  "what",
  "which",
  "their",
  "have",
  "make",
  "some"
]);

function contentWords(text: string): Set<string> {
  return new Set(
    (text.toLocaleLowerCase("en").match(/[a-z][a-z'-]{3,}/g) ?? []).filter(
      (word) => !STOP_WORDS.has(word)
    )
  );
}

/** True when an action mostly restates a fix the reader has already seen. */
function repeats(action: string, improvement: string): boolean {
  const actionWords = contentWords(action);
  if (actionWords.size < 2) return false;
  const improvementWords = contentWords(improvement);
  const shared = [...actionWords].filter((word) => improvementWords.has(word)).length;
  return shared / actionWords.size >= 0.6;
}

const INTERNAL_ID =
  /\b(?:the\s+)?(?:(?:experience|project)-\d+-(?:achievement-\d+|summary|outcome)|education-\d+|achievement-\d+|signal:[a-z:-]+)(?:\s+(?:bullet|item|line|entry))?\b/gi;

/**
 * Anchor IDs are plumbing. If one leaks into text a person reads, replace it
 * with a plain reference; problem cards show the quoted bullet right above.
 */
function withoutInternalIds(text: string, replacement: string): string {
  return text.replace(INTERNAL_ID, replacement).replace(/\s{2,}/g, " ").trim();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function extractNumericTokens(value: string): string[] {
  return (
    value
      .match(
        /(?:[$€£₹]\s*\d+(?:[.,]\d+)?|\b(?:usd|eur|gbp|inr)\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*%?)/gi
      )
      ?.map((token) => normalizeWhitespace(token).replace(/\s+/g, "").toLocaleLowerCase("en")) ?? []
  );
}

function containsUnsupportedScoreOrProbability(value: string): boolean {
  return /\b(?:ats|applicant tracking system)\b|\b\d+(?:[.,]\d+)?\s*(?:\/|out of)\s*\d+(?:[.,]\d+)?\b|\b(?:resume\s*)?(?:score|rating|match(?:\s*score)?|chance|probability|odds|likelihood)\b(?:\s+\w+){0,4}?\s*(?:of|:|is|was|at)?\s*\d+(?:[.,]\d+)?\s*%?|\bI\s+(?:rate|give)\b[^.!?]{0,80}\b(?:\d+(?:[.,]\d+)?\s*(?:\/|out of)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*%?)|\b(?:offer|hire|hired|hiring|interview)\s+(?:probability|chance|odds|likelihood|rate)\b|\b(?:probability|chance|odds|likelihood)\s+(?:of|to)\s+(?:an?\s+)?(?:offer|hire|hired|hiring|interview)\b/i.test(
    value
  );
}

function containsProtectedTraitOrInsult(value: string): boolean {
  const protectedTrait =
    /\b(?:age|aged|race|racial|ethnicity|ethnic|religion|religious|gender|sex|sexual orientation|orientation|gay|lesbian|bisexual|trans(?:gender)?|lgbtq?|disability|disabled|pregnan(?:t|cy)|nationality|national origin|caste|marital status|veteran|genetic information)\b/i;
  const personDirectedInsult =
    /\b(?:you(?:['’]re)?|you are|yourself|this candidate is|the candidate is)\b[^.!?]{0,60}\b(?:idiot|stupid|lazy|incompetent|worthless|dumb|moron|failure|useless)\b/i;
  return protectedTrait.test(value) || personDirectedInsult.test(value);
}
