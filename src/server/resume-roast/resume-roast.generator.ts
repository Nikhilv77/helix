import {
  ResumeRoastResultSchema,
  type ResumeRoastResult,
  type ResumeRoastTarget
} from "@/lib/resume-roast/contracts";
import type { AiService } from "../ai/ai.service";
import { buildResumeRoastPrompt, RESUME_ROAST_SYSTEM_INSTRUCTION } from "./resume-roast.prompt";
import type { ResumeRoastEvidenceItem, ResumeRoastSnapshot } from "./resume-signals";

export const RESUME_ROAST_TIMEOUT_MS = 60_000;

/** Safe error: it deliberately contains no resume or model-produced text. */
export class ResumeRoastGenerationError extends Error {
  constructor() {
    super("Resume Roast generation returned unsupported feedback");
    this.name = ResumeRoastGenerationError.name;
  }
}

export interface GenerateResumeRoastInput {
  snapshot: ResumeRoastSnapshot;
  target: ResumeRoastTarget;
  signal?: AbortSignal;
}

/** One request plus non-negotiable deterministic grounding checks. */
export class ResumeRoastGenerator {
  constructor(private readonly ai: Pick<AiService, "generateStructured">) {}

  async generate(input: GenerateResumeRoastInput): Promise<ResumeRoastResult> {
    // No evidence means no truthful roast can be generated. Fail before an AI
    // request instead of inviting the model to manufacture feedback.
    if (input.snapshot.evidence.length === 0) throw new ResumeRoastGenerationError();

    const signalAnchorIds = getResumeRoastSignalAnchorIds(input.snapshot);
    const result = await this.ai.generateStructured({
      operation: "resume.roast.generate",
      systemInstruction: RESUME_ROAST_SYSTEM_INSTRUCTION,
      prompt: buildResumeRoastPrompt(input.snapshot, input.target, signalAnchorIds),
      schema: ResumeRoastResultSchema,
      modelClass: "fast",
      temperature: 0.3,
      // A complete, evidence-grounded roast is larger than the shared fast
      // request workload, so it gets its own deadline without changing other
      // AI operations.
      timeoutMs: RESUME_ROAST_TIMEOUT_MS,
      // One complete roast is a single cost-controlled operation, never a
      // provider retry loop that could produce divergent feedback.
      maxAttempts: 1,
      ...(input.signal ? { signal: input.signal } : {})
    });

    const validated = validateResumeRoastResult(result, input.snapshot, signalAnchorIds);
    // The public schema keeps this optional so older saved roasts remain
    // readable, but every new generation must include its purpose-written
    // uninterrupted voice script.
    if (!validated.spokenSummary) throw new ResumeRoastGenerationError();
    return validated;
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
  for (const repeatedVerb of snapshot.signals.repeatedLeadingVerbs) {
    anchors.push(`signal:repeated-leading-verb:${repeatedVerb.verb}`);
  }
  return anchors;
}

export function validateResumeRoastResult(
  value: unknown,
  snapshot: ResumeRoastSnapshot,
  signalAnchorIds = getResumeRoastSignalAnchorIds(snapshot)
): ResumeRoastResult {
  const parsed = ResumeRoastResultSchema.safeParse(value);
  if (!parsed.success) throw new ResumeRoastGenerationError();

  const result = parsed.data;
  const evidenceById = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const evidenceIds = new Set(evidenceById.keys());
  const problemAnchorIds = new Set([...evidenceIds, ...signalAnchorIds]);

  if (!result.strength.evidenceAnchors.every((anchor) => evidenceIds.has(anchor))) {
    throw new ResumeRoastGenerationError();
  }
  if (
    !result.problems.every((problem) =>
      problem.evidenceAnchors.every((anchor) => problemAnchorIds.has(anchor))
    )
  ) {
    throw new ResumeRoastGenerationError();
  }

  if (result.rewrite !== null) validateRewrite(result.rewrite, evidenceById);
  validateTextSafety(result);
  return result;
}

function validateRewrite(
  rewrite: NonNullable<ResumeRoastResult["rewrite"]>,
  evidenceById: ReadonlyMap<string, ResumeRoastEvidenceItem>
): void {
  const evidence = evidenceById.get(rewrite.evidenceAnchor);
  if (!evidence || evidence.kind === "education") throw new ResumeRoastGenerationError();
  if (normalizeWhitespace(rewrite.before) !== normalizeWhitespace(evidence.text)) {
    throw new ResumeRoastGenerationError();
  }

  const beforeNumbers = new Set(extractNumericTokens(rewrite.before));
  if (extractNumericTokens(rewrite.after).some((token) => !beforeNumbers.has(token))) {
    throw new ResumeRoastGenerationError();
  }
}

function validateTextSafety(result: ResumeRoastResult): void {
  const allText = [
    result.openingRoast,
    ...(result.spokenSummary ? [result.spokenSummary] : []),
    result.strength.headline,
    result.strength.explanation,
    result.verdict.explanation,
    ...result.problems.flatMap((problem) => [
      problem.joke,
      problem.issue,
      problem.recruiterImpact,
      problem.improvement
    ]),
    ...(result.rewrite
      ? [result.rewrite.before, result.rewrite.after, result.rewrite.rationale]
      : []),
    ...result.actionPlan.flatMap((action) => [action.action, action.rationale])
  ];
  if (allText.some(containsUnsupportedScoreOrProbability)) throw new ResumeRoastGenerationError();

  const humorousText = [
    result.openingRoast,
    ...(result.spokenSummary ? [result.spokenSummary] : []),
    ...result.problems.map((problem) => problem.joke)
  ];
  if (humorousText.some(containsPersonDirectedInsultOrProtectedTrait)) {
    throw new ResumeRoastGenerationError();
  }
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

function containsPersonDirectedInsultOrProtectedTrait(value: string): boolean {
  const protectedTrait =
    /\b(?:age|aged|race|racial|ethnicity|ethnic|religion|religious|gender|sex|sexual orientation|orientation|gay|lesbian|bisexual|trans(?:gender)?|lgbtq?|disability|disabled|pregnan(?:t|cy)|nationality|national origin|caste|marital status|veteran|genetic information)\b/i;
  const personDirectedInsult =
    /\b(?:you(?:['’]re)?|you are|yourself|this candidate is|the candidate is)\b[^.!?]{0,60}\b(?:idiot|stupid|lazy|incompetent|worthless|dumb|moron|failure|useless)\b/i;
  return protectedTrait.test(value) || personDirectedInsult.test(value);
}
